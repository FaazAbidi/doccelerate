from fastapi import APIRouter, HTTPException, Path, Query
from typing import List, Optional
from ..schemas.document import Document, DocumentCreate, DocumentUpdate
from ..schemas.common import SuccessResponse

router = APIRouter(prefix="/documents", tags=["documents"])

# Mock database for demonstration
mock_documents_db = [
    {
        "id": 1,
        "title": "Sample Document",
        "content": "This is a sample document content.",
        "is_published": True,
        "owner_id": 1,
        "created_at": "2024-01-01T00:00:00",
        "updated_at": None
    }
]


@router.get("/", response_model=List[Document])
async def get_documents(
    skip: int = Query(0, ge=0, description="Number of documents to skip"),
    limit: int = Query(100, ge=1, le=100, description="Number of documents to return"),
    published_only: bool = Query(False, description="Return only published documents")
):
    """Get all documents with pagination and filtering"""
    documents = mock_documents_db
    if published_only:
        documents = [d for d in documents if d["is_published"]]
    return documents[skip:skip + limit]


@router.get("/{document_id}", response_model=Document)
async def get_document(document_id: int = Path(..., gt=0)):
    """Get a specific document by ID"""
    document = next((d for d in mock_documents_db if d["id"] == document_id), None)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.post("/", response_model=Document, status_code=201)
async def create_document(document: DocumentCreate):
    """Create a new document"""
    new_document = {
        "id": len(mock_documents_db) + 1,
        **document.model_dump(),
        "created_at": "2024-01-01T00:00:00",
        "updated_at": None
    }
    mock_documents_db.append(new_document)
    return new_document


@router.put("/{document_id}", response_model=Document)
async def update_document(document_id: int, document_update: DocumentUpdate):
    """Update an existing document"""
    document = next((d for d in mock_documents_db if d["id"] == document_id), None)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Update only provided fields
    update_data = document_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        document[field] = value
    document["updated_at"] = "2024-01-01T00:00:00"
    
    return document


@router.delete("/{document_id}", response_model=SuccessResponse)
async def delete_document(document_id: int):
    """Delete a document"""
    document = next((d for d in mock_documents_db if d["id"] == document_id), None)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    mock_documents_db.remove(document)
    return SuccessResponse(message=f"Document {document_id} deleted successfully")


@router.get("/user/{user_id}", response_model=List[Document])
async def get_user_documents(user_id: int = Path(..., gt=0)):
    """Get all documents owned by a specific user"""
    user_documents = [d for d in mock_documents_db if d["owner_id"] == user_id]
    return user_documents 