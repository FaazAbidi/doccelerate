"""
Indexing orchestrator for coordinating the complete indexing workflow
"""

import os
import tempfile
import shutil
import logging
from typing import Dict, Any, Optional

from app.services.job_service import JobService
from app.services.repository_service import RepositoryService
from app.services.file_processing_service import FileProcessingService
from app.services.chunk_service import ChunkService
from app.services.database_service import DatabaseService
from app.services.merkle_tree_service import MerkleTreeService

logger = logging.getLogger(__name__)


class IndexingOrchestrator:
    """Main orchestrator for the indexing workflow"""
    
    def __init__(self, current_task, user_id: str, repo_id: str):
        self.current_task = current_task
        self.user_id = user_id
        self.repo_id = repo_id
        self.task_id = current_task.request.id
        
    async def run_indexing(
        self,
        github_full_name: str,
        branch: str,
        docs_directory: str,
        github_access_token: Optional[str] = None,
        soft_reindex: bool = False
    ) -> Dict[str, Any]:
        """
        Run the complete indexing workflow
        
        Args:
            github_full_name: GitHub repository name (e.g., "owner/repo")
            branch: Branch to index
            docs_directory: Directory containing documentation
            github_access_token: Optional GitHub access token
            soft_reindex: Whether to perform soft reindex (use existing files)
            
        Returns:
            Dict with indexing results
        """
        temp_dir = None
        
        try:
            # Step 1: Starting
            await self._update_progress('starting', 0)
            
            # Step 2: Process files (clone or fetch from storage)
            if not soft_reindex:
                files_data, temp_dir = await self._process_hard_reindex(
                    github_full_name, branch, docs_directory, github_access_token
                )
            else:
                files_data = await self._process_soft_reindex()
            
            # Step 3: Generate chunks and embeddings
            await self._update_progress('generating_embeddings', 60)
            chunks_data = await ChunkService.process_chunks_for_files(files_data)
            
            # Step 4: Store in database
            await self._update_progress('storing_data', 80)
            await DatabaseService.store_files_and_chunks(
                self.repo_id, files_data, chunks_data, soft_reindex
            )
            
            # Step 5: Calculate and store Merkle tree
            await self._update_progress('merkle_tree', 90)
            root_hash = await MerkleTreeService.calculate_and_store_merkle_tree(
                self.repo_id, files_data
            )
            
            # Step 6: Update repository with sync info
            commit_sha = await self._get_commit_sha(temp_dir, soft_reindex)
            await DatabaseService.update_repository_sync_info(
                self.repo_id, commit_sha, root_hash
            )
            
            # Step 7: Send notification
            await self._update_progress('notifying', 95)
            
            # Complete
            await self._update_progress('completed', 100, 'SUCCESS')
            
            return {
                'status': 'completed',
                'files_processed': len(files_data),
                'chunks_created': len(chunks_data),
                'repo_id': self.repo_id,
                'soft_reindex': soft_reindex
            }
            
        except Exception as e:
            # Update job with failure status
            await JobService.update_job_progress(
                self.task_id, self.user_id, 'failed', None, 'failed', str(e)
            )
            
            # Return failure structure
            return {
                "status": "failed",
                "error": str(e),
                "repo_id": self.repo_id,
            }
            
        finally:
            # Cleanup temporary directory
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
                logger.info(f"Cleaned up temporary directory: {temp_dir}")
    
    async def _process_hard_reindex(
        self,
        github_full_name: str,
        branch: str,
        docs_directory: str,
        github_access_token: Optional[str]
    ) -> tuple:
        """Process hard reindex (clone repo and process files)"""
        # Create temporary directory for git operations
        temp_dir = tempfile.mkdtemp(prefix="doccelerate_index_")
        logger.info(f"Created temporary directory: {temp_dir}")
        
        # Step 2a: Clone repository
        await self._update_progress('cloning', 10)
        repo_path = await RepositoryService.clone_repository(
            github_full_name, branch, docs_directory, temp_dir, github_access_token
        )
        
        # Step 2b: Process files
        await self._update_progress('processing_files', 30)
        files_data = await FileProcessingService.process_files_from_disk(
            repo_path, docs_directory, self.repo_id
        )
        
        return files_data, temp_dir
    
    async def _process_soft_reindex(self):
        """Process soft reindex (use existing files from storage)"""
        await self._update_progress('fetching_existing_files', 20)
        
        files_data = await FileProcessingService.process_files_from_storage(self.repo_id)
        
        await self._update_progress('files_processed', 40, files_count=len(files_data))
        
        return files_data
    
    async def _get_commit_sha(self, temp_dir: Optional[str], soft_reindex: bool) -> str:
        """Get commit SHA for repository sync info"""
        if not soft_reindex and temp_dir:
            # For hard re-indexing, get the commit SHA from git
            repo_path = os.path.join(temp_dir, "repo")
            return RepositoryService.get_commit_sha(repo_path)
        else:
            # For soft re-indexing, keep the existing commit SHA
            from app.database import prisma
            repo = await prisma.repo.find_unique(where={"id": self.repo_id})
            return repo.last_sync_sha if repo else None
    
    async def _update_progress(
        self, 
        step: str, 
        progress: int, 
        state: str = 'PROGRESS',
        **extra_meta
    ):
        """Update task and job progress"""
        meta = {'step': step, 'progress': progress}
        meta.update(extra_meta)
        
        self.current_task.update_state(state=state, meta=meta)
        
        status = 'completed' if state == 'SUCCESS' else 'running'
        await JobService.update_job_progress(
            self.task_id, self.user_id, status, progress, step
        )
