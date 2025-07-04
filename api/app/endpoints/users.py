from fastapi import APIRouter, HTTPException, Path, Query
from typing import List, Optional
from ..schemas.user import User, UserCreate, UserUpdate
from ..schemas.common import SuccessResponse

router = APIRouter(prefix="/users", tags=["users"])

# Mock database for demonstration
mock_users_db = [
    {
        "id": 1,
        "email": "user@example.com",
        "name": "John Doe",
        "is_active": True,
        "created_at": "2024-01-01T00:00:00",
        "updated_at": None
    }
]


@router.get("/", response_model=List[User])
async def get_users(
    skip: int = Query(0, ge=0, description="Number of users to skip"),
    limit: int = Query(100, ge=1, le=100, description="Number of users to return")
):
    """Get all users with pagination"""
    return mock_users_db[skip:skip + limit]


@router.get("/{user_id}", response_model=User)
async def get_user(user_id: int = Path(..., gt=0)):
    """Get a specific user by ID"""
    user = next((u for u in mock_users_db if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/", response_model=User, status_code=201)
async def create_user(user: UserCreate):
    """Create a new user"""
    new_user = {
        "id": len(mock_users_db) + 1,
        **user.model_dump(),
        "created_at": "2024-01-01T00:00:00",
        "updated_at": None
    }
    # Remove password from response (in real app, hash it first)
    new_user.pop("password", None)
    mock_users_db.append(new_user)
    return new_user


@router.put("/{user_id}", response_model=User)
async def update_user(user_id: int, user_update: UserUpdate):
    """Update an existing user"""
    user = next((u for u in mock_users_db if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update only provided fields
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        user[field] = value
    user["updated_at"] = "2024-01-01T00:00:00"
    
    return user


@router.delete("/{user_id}", response_model=SuccessResponse)
async def delete_user(user_id: int):
    """Delete a user"""
    user = next((u for u in mock_users_db if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    mock_users_db.remove(user)
    return SuccessResponse(message=f"User {user_id} deleted successfully") 