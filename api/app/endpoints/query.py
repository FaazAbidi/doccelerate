from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
import json

from app.tasks.query import process_query
from app.database import get_db

router = APIRouter()

class QueryRequest(BaseModel):
    query: str
    user_id: str
    repo_id: str

class QueryResponse(BaseModel):
    task_id: str
    status: str
    message: str
    repo: str

@router.post("/query", status_code=status.HTTP_202_ACCEPTED, response_model=QueryResponse)
async def run_query(request: QueryRequest):
    """
    Process a natural language documentation change request
    
    Returns 202 Accepted immediately and queues a Celery job to:
    1. Embed the query text
    2. Search for relevant chunks using pgvector
    3. Generate unified diff patches using LLM
    4. Create suggestions in the database
    5. Send real-time notifications
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    if not request.user_id:
        raise HTTPException(status_code=400, detail="User ID is required")
        
    if not request.repo_id:
        raise HTTPException(status_code=400, detail="Repository ID is required")
    
    # Validate that repo exists and user has access
    async with get_db() as db:
        repo = await db.repo.find_unique(
            where={"id": request.repo_id},
            include={"users": True}
        )
        
        if not repo:
            raise HTTPException(status_code=404, detail="Repository not found")
        
        # Check if user owns the repo
        if repo.owner_id != request.user_id:
            raise HTTPException(status_code=403, detail="Access denied to repository")
    
    # Start the query processing task
    task = process_query.delay(
        query=request.query,
        user_id=request.user_id,
        repo_id=request.repo_id
    )
    
    # Create job record in database
    async with get_db() as db:
        job_metadata = {
            "repo_id": request.repo_id,
            "query": request.query[:500],  # Truncate for storage
            "repo_name": repo.github_full_name
        }
        
        await db.job.create(
            data={
                "task_id": task.id,
                "status": "pending",
                "type": "query",
                "progress": 0.0,
                "metadata": json.dumps(job_metadata),
                "users": {
                    "connect": {
                        "id": request.user_id
                    }
                }
            }
        )
    
    return QueryResponse(
        task_id=task.id,
        status="pending",
        message="Query processing started",
        repo=repo.github_full_name
    ) 