from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .common import BaseSchema


class UserBase(BaseModel):
    """Base user schema"""
    email: str
    name: str
    is_active: bool = True


class UserCreate(UserBase):
    """User creation schema"""
    password: str


class UserUpdate(BaseModel):
    """User update schema"""
    email: Optional[str] = None
    name: Optional[str] = None
    is_active: Optional[bool] = None


class User(BaseSchema, UserBase):
    """User response schema"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True 