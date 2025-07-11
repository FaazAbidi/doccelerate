from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import logging

from app.database import get_db
from app.tasks.index import process_indexing

router = APIRouter()
logger = logging.getLogger(__name__)

class IndexRequest(BaseModel):
    user_id: str
    soft_reindex: bool = False

@router.post("/index")
async def run_index(request: IndexRequest):
    """
    Start indexing process for user's active repository.
    
    This endpoint:
    1. Finds the user's active repository from the database
    2. Creates a job record to track the indexing task
    3. Starts a Celery task for heavy indexing work
    4. Returns task ID for tracking
    
    Parameters:
        - user_id: The user's UUID
        - soft_reindex: When true, performs a "soft" re-index that preserves existing files in storage
          and only regenerates chunks and embeddings. When false (default), performs a full re-index
          including downloading files from GitHub.
    """
    if not request.user_id:
        raise HTTPException(status_code=400, detail="User ID cannot be empty")
    
    # Get user's active repository info from database
    async with get_db() as db:
        profile = await db.profile.find_unique(
            where={"id": request.user_id},
            include={
                "active_repo": True
            }
        )
        
        if not profile:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        if not profile.active_repo:
            raise HTTPException(status_code=400, detail="No active repository set for user")
        
        if not profile.active_branch:
            raise HTTPException(status_code=400, detail="No active branch set for user")
        
        if not profile.active_directory:
            raise HTTPException(status_code=400, detail="No active directory set for user")
        
        # Check if there's already a running indexing job for this user
        existing_job = await db.job.find_first(
            where={
                "user_id": request.user_id,
                "type": "index",
                "status": {"in": ["pending", "running"]}
            }
        )
        
        if existing_job:
            return {
                "task_id": existing_job.task_id,
                "status": existing_job.status,
                "repo": profile.active_repo.github_full_name,
                "branch": profile.active_branch,
                "directory": profile.active_directory,
                "message": "Indexing job already in progress"
            }
    
    # Start the indexing task
    try:
        logger.info(f"Dispatching indexing task: repo_id={profile.active_repo.id}, soft_reindex={request.soft_reindex}")
        task = process_indexing.delay(
            repo_id=profile.active_repo.id,
            user_id=request.user_id,
            github_full_name=profile.active_repo.github_full_name,
            branch=profile.active_branch,
            docs_directory=profile.active_directory,
            github_access_token=profile.github_access_token,
            soft_reindex=request.soft_reindex
        )
        logger.info(f"Task dispatched successfully: task_id={task.id}")
    except Exception as e:
        logger.error(f"Failed to dispatch indexing task: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start indexing: {str(e)}")
    
    # Create job record in database
    async with get_db() as db:
        job_metadata = {
            "repo_id": profile.active_repo.id,
            "repo_name": profile.active_repo.github_full_name,
            "branch": profile.active_branch,
            "directory": profile.active_directory,
            "soft_reindex": request.soft_reindex
        }
        
        await db.job.create(
            data={
                "task_id": task.id,
                "user_id": request.user_id,
                "status": "pending",
                "type": "index",
                "progress": 0.0,
                "metadata": json.dumps(job_metadata)
            }
        )
    
    return {
        "task_id": task.id, 
        "status": "pending",
        "repo": profile.active_repo.github_full_name,
        "branch": profile.active_branch,
        "directory": profile.active_directory
    } 