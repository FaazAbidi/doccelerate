"""
Database configuration for Prisma ORM
"""
import os
from contextlib import asynccontextmanager
from prisma import Prisma

# Initialize Prisma client
prisma = Prisma()

@asynccontextmanager
async def get_db():
    """
    Database context manager that ensures proper connection handling
    """
    if not prisma.is_connected():
        await prisma.connect()
    try:
        yield prisma
    finally:
        # Connection will be managed by the application lifecycle
        pass

async def connect_db():
    """
    Connect to the database
    """
    if not prisma.is_connected():
        await prisma.connect()

async def disconnect_db():
    """
    Disconnect from the database
    """
    if prisma.is_connected():
        await prisma.disconnect() 
