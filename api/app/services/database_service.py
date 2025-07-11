"""
Database service for handling database operations during indexing
"""

import logging
from typing import List, Dict, Any

from app.database import prisma

logger = logging.getLogger(__name__)


class DatabaseService:
    """Service for handling database operations during indexing"""
    
    @staticmethod
    async def store_files_and_chunks(
        repo_id: str, 
        files_data: List[Dict[str, Any]], 
        chunks_data: List[Dict[str, Any]], 
        soft_reindex: bool = False
    ) -> None:
        """
        Store files and chunks data in the database
        
        Args:
            repo_id: Repository ID
            files_data: List of file data dictionaries
            chunks_data: List of chunk data dictionaries
            soft_reindex: Whether this is a soft reindex operation
        """
        logger.info(f"Storing {len(files_data)} files and {len(chunks_data)} chunks in database")
        
        # Store files first
        await DatabaseService._store_files(repo_id, files_data, soft_reindex)
        
        # Then store file-chunk relationships
        await DatabaseService._store_file_chunk_relationships(chunks_data)
        
        logger.info("Successfully stored all files and chunks in database")
    
    @staticmethod
    async def _store_files(
        repo_id: str, 
        files_data: List[Dict[str, Any]], 
        soft_reindex: bool
    ) -> None:
        """Store file records in the database"""
        logger.info(f"Storing {len(files_data)} files in database")
        
        for file_data in files_data:
            try:
                if soft_reindex:
                    # For soft reindex, update existing file records
                    await DatabaseService._update_existing_file(repo_id, file_data)
                else:
                    # For hard reindex, upsert file records
                    await DatabaseService._upsert_file(repo_id, file_data)
                    
            except Exception as e:
                logger.error(f"Failed to store file {file_data['path']}: {e}")
                raise
    
    @staticmethod
    async def _upsert_file(repo_id: str, file_data: Dict[str, Any]) -> None:
        """Upsert a file record"""
        await prisma.file.upsert(
            where={
                "repo_id_path": {
                    "repo_id": repo_id,
                    "path": file_data['path']
                }
            },
            data={
                "create": {
                    "repo_id": repo_id,
                    "path": file_data['path'],
                    "content_hash": file_data['content_hash'],
                    "storage_key": file_data['storage_key'],
                },
                "update": {
                    "content_hash": file_data['content_hash'],
                    "storage_key": file_data['storage_key'],
                    "has_uncommitted_changes": False
                }
            }
        )
        
        logger.debug(f"Upserted file: {file_data['path']}")
    
    @staticmethod
    async def _update_existing_file(repo_id: str, file_data: Dict[str, Any]) -> None:
        """Update an existing file record for soft reindex"""
        await prisma.file.update(
            where={
                "repo_id_path": {
                    "repo_id": repo_id,
                    "path": file_data['path']
                }
            },
            data={
                "content_hash": file_data['content_hash'],
                "updated_at": None  # Will use default
            }
        )
        
        logger.debug(f"Updated file: {file_data['path']}")
    
    @staticmethod
    async def _store_file_chunk_relationships(chunks_data: List[Dict[str, Any]]) -> None:
        """Store file-chunk relationships in the database"""
        logger.info(f"Storing {len(chunks_data)} file-chunk relationships")
        
        # Group chunks by file path for efficient processing
        chunks_by_file = {}
        for chunk in chunks_data:
            file_path = chunk['file_path']
            if file_path not in chunks_by_file:
                chunks_by_file[file_path] = []
            chunks_by_file[file_path].append(chunk)
        
        # Process each file's chunks
        for file_path, file_chunks in chunks_by_file.items():
            await DatabaseService._store_chunks_for_file(file_path, file_chunks)
    
    @staticmethod
    async def _store_chunks_for_file(file_path: str, file_chunks: List[Dict[str, Any]]) -> None:
        """Store chunks for a specific file"""
        # Get the file record
        file_record = await prisma.file.find_first(
            where={"path": file_path}
        )
        
        if not file_record:
            logger.error(f"File record not found for path: {file_path}")
            return
        
        # Store each chunk relationship
        for chunk in file_chunks:
            try:
                await prisma.file_chunk.upsert(
                    where={
                        "file_id_chunk_order": {
                            "file_id": file_record.id,
                            "chunk_order": chunk['chunk_order']
                        }
                    },
                    data={
                        "create": {
                            "file_id": file_record.id,
                            "chunk_hash": chunk['hash'],
                            "chunk_order": chunk['chunk_order'],
                            "start_line": chunk['start_line'],
                            "end_line": chunk['end_line']
                        },
                        "update": {
                            "chunk_hash": chunk['hash'],
                            "start_line": chunk['start_line'],
                            "end_line": chunk['end_line']
                        }
                    }
                )
                
            except Exception as e:
                logger.error(f"Failed to store chunk relationship for {file_path}, chunk {chunk['chunk_order']}: {e}")
        
        logger.debug(f"Stored {len(file_chunks)} chunk relationships for file: {file_path}")
    
    @staticmethod
    async def update_repository_sync_info(
        repo_id: str, 
        commit_sha: str, 
        root_hash: str
    ) -> None:
        """
        Update repository with sync information
        
        Args:
            repo_id: Repository ID
            commit_sha: Git commit SHA
            root_hash: Merkle tree root hash
        """
        try:
            await prisma.repo.update(
                where={"id": repo_id},
                data={
                    "last_sync_sha": commit_sha,
                    "root_hash": root_hash,
                    "updated_at": None  # Will use default
                }
            )
            
            logger.info(f"Updated repository sync info: commit={commit_sha[:8]}, root_hash={root_hash[:8]}")
            
        except Exception as e:
            logger.error(f"Failed to update repository sync info: {e}")
            raise
