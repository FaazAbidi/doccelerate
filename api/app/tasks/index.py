"""
Indexing task for processing documentation repositories

This module handles the Celery task for indexing documentation repositories,
orchestrating the complete workflow from cloning to storing embeddings.
"""

import asyncio
import logging
import traceback
import sys

from celery import current_task

from app.tasks.celery_app import celery_app
from app.database import prisma
from app.services.indexing_orchestrator import IndexingOrchestrator

logger = logging.getLogger(__name__)


def _restore_std_streams() -> None:
    """If Celery's LoggingProxy is active replace it with the original streams."""
    try:
        from kombu.utils.log import LoggingProxy
        
        if isinstance(sys.stdout, LoggingProxy):
            sys.stdout = sys.__stdout__
        
        if isinstance(sys.stderr, LoggingProxy):
            sys.stderr = sys.__stderr__
    except Exception:
        # Best-effort only; never crash due to stdout patching
        pass


def _set_task_failure_state(task, exception: Exception) -> None:
    """Set task failure state with proper error information"""
    try:
        task.update_state(
            state='FAILURE',
            meta={
                "error": str(exception),
                "traceback": traceback.format_exc(),
                "progress": 0,
            },
        )
    except Exception as e:
        logger.error(f"Failed to set task failure state: {e}")


@celery_app.task(bind=True)
def process_indexing(
    self,
    repo_id: str,
    user_id: str,
    github_full_name: str,
    branch: str,
    docs_directory: str,
    github_access_token: str = None,
    soft_reindex: bool = False
):
    """
    Main indexing task that performs complete repository documentation indexing.
    
    This task orchestrates the entire indexing workflow:
    1. Repository cloning (or using existing files for soft reindex)
    2. File processing and storage
    3. Text chunking and embedding generation
    4. Database storage of files and chunks
    5. Merkle tree calculation
    6. Repository sync info updates
    7. Real-time notifications
    
    Args:
        repo_id: Repository ID
        user_id: User ID requesting the indexing
        github_full_name: GitHub repository name (e.g., "owner/repo")
        branch: Git branch to index
        docs_directory: Directory containing documentation files
        github_access_token: Optional GitHub access token for private repos
        soft_reindex: Whether to perform soft reindex (skip cloning, use existing files)
        
    Returns:
        Dict with indexing results and statistics
    """
    try:
        # Restore stdout/stderr for proper library compatibility
        _restore_std_streams()
        
        # Run the async indexing workflow
        result = asyncio.run(_run_indexing_workflow(
            self, repo_id, user_id, github_full_name, branch, 
            docs_directory, github_access_token, soft_reindex
        ))
        
        return result
        
    except Exception as e:
        logger.error(f"Indexing task failed: {e}")
        logger.error(traceback.format_exc())
        
        # Set proper task failure state for Celery
        _set_task_failure_state(self, e)
        
        # Return simplified failure payload
        return {
            "status": "failed",
            "error": str(e),
            "repo_id": repo_id,
        }


async def _run_indexing_workflow(
    current_task,
    repo_id: str,
    user_id: str,
    github_full_name: str,
    branch: str,
    docs_directory: str,
    github_access_token: str = None,
    soft_reindex: bool = False
):
    """
    Internal async function that runs the complete indexing workflow
    
    Args:
        current_task: Celery task instance
        repo_id: Repository ID
        user_id: User ID requesting the indexing
        github_full_name: GitHub repository name
        branch: Git branch to index
        docs_directory: Directory containing documentation files
        github_access_token: Optional GitHub access token
        soft_reindex: Whether to perform soft reindex
        
    Returns:
        Dict with indexing results
    """
    try:
        # Ensure stdout/stderr are real file objects for libraries that require fileno()
        _restore_std_streams()
        
        # Connect to database
        if not prisma.is_connected():
            await prisma.connect()
        
        logger.info(f"Starting indexing workflow for repository {github_full_name}")
        logger.info(f"Parameters: branch={branch}, docs_directory={docs_directory}, soft_reindex={soft_reindex}")
        
        # Initialize the indexing orchestrator
        orchestrator = IndexingOrchestrator(current_task, user_id, repo_id)
        
        # Run the complete indexing workflow
        result = await orchestrator.run_indexing(
            github_full_name=github_full_name,
            branch=branch,
            docs_directory=docs_directory,
            github_access_token=github_access_token,
            soft_reindex=soft_reindex
        )
        
        logger.info(f"Indexing workflow completed: {result['status']}")
        return result
        
    except Exception as e:
        logger.error(f"Indexing workflow failed: {e}")
        logger.error(traceback.format_exc())
        raise
