from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.tasks.query import process_query

router = APIRouter()

class QueryRequest(BaseModel):
    query: str

@router.post("/query")
async def run_query(request: QueryRequest):
    if not request.query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    task = process_query.delay(request.query)
    return {"task_id": task.id, "status": "queued"} 