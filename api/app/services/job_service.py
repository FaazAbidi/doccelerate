"""
Job management service for handling query processing jobs
"""

import json
import logging
from typing import Optional

from app.database import prisma

logger = logging.getLogger(__name__)


class JobService:
    """Service for managing job progress, notifications, and completion"""
    
    @staticmethod
    async def update_job_progress(
        task_id: str, 
        user_id: str, 
        status: str, 
        progress: Optional[float] = None, 
        step: Optional[str] = None, 
        error_msg: Optional[str] = None
    ) -> None:
        """Update job progress in database"""
        try:
            # Ensure Prisma is connected
            if not prisma.is_connected():
                await prisma.connect()
            
            update_data = {
                "status": status,
                "updated_at": None  # Will use default
            }
            
            if progress is not None:
                update_data["progress"] = progress / 100.0  # Convert to 0.0-1.0 range
                
            if error_msg:
                update_data["error_msg"] = error_msg
                
            # Update metadata with current step if provided
            if step:
                existing_job = await prisma.job.find_unique(
                    where={"task_id": task_id}
                )
                if existing_job and existing_job.metadata:
                    # Parse existing JSON metadata
                    try:
                        metadata = json.loads(existing_job.metadata) if isinstance(existing_job.metadata, str) else existing_job.metadata
                    except (json.JSONDecodeError, TypeError):
                        metadata = {}
                    
                    metadata["current_step"] = step
                    update_data["metadata"] = json.dumps(metadata)
                elif step:
                    # Create metadata if it doesn't exist
                    update_data["metadata"] = json.dumps({"current_step": step})
            
            await prisma.job.update(
                where={"task_id": task_id},
                data=update_data
            )
            
        except Exception as e:
            logger.error(f"Failed to update job progress: {e}")
            # Don't fail the main task if job update fails

    @staticmethod
    async def update_job_completion(
        task_id: str, 
        user_id: str, 
        suggestions_created: int, 
        message: str
    ) -> None:
        """Update job metadata with completion information"""
        try:
            # Ensure Prisma is connected
            if not prisma.is_connected():
                await prisma.connect()
            
            # Get existing job metadata
            existing_job = await prisma.job.find_unique(
                where={"task_id": task_id}
            )
            
            if existing_job and existing_job.metadata:
                # Parse existing metadata
                try:
                    metadata = json.loads(existing_job.metadata) if isinstance(existing_job.metadata, str) else existing_job.metadata
                except (json.JSONDecodeError, TypeError):
                    metadata = {}
            else:
                metadata = {}
            
            # Add completion info to metadata (preserve existing repo_id if it exists)
            metadata.update({
                "completion_message": message,
                "suggestions_created": suggestions_created,
                "completed_at": json.dumps({"timestamp": "now"}),  # This will trigger the UPDATE event
            })
            
            # Ensure repo_id is in metadata (it should already be there from job creation)
            if not metadata.get("repo_id"):
                logger.warning(f"repo_id not found in job metadata for task {task_id}")
            
            logger.debug(f"Job metadata for completion: {metadata}")
            
            await prisma.job.update(
                where={"task_id": task_id},
                data={
                    "metadata": json.dumps(metadata)
                }
            )
            
            logger.info(f"Updated job completion metadata for task {task_id}: {suggestions_created} suggestions")
            
        except Exception as e:
            logger.error(f"Failed to update job completion metadata: {e}")
            # Don't fail the main query task if metadata update fails
