from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .common import BaseSchema


class DocumentBase(BaseModel):
    """Base document schema"""
    title: str
    content: str
    is_published: bool = False


class DocumentCreate(DocumentBase):
    """Document creation schema"""
    owner_id: int


class DocumentUpdate(BaseModel):
    """Document update schema"""
    title: Optional[str] = None
    content: Optional[str] = None
    is_published: Optional[bool] = None


class Document(BaseSchema, DocumentBase):
    """Document response schema"""
    id: int
    owner_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True 