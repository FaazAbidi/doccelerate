"""
Services module for the doccelerate API

This module contains various service classes and utilities for:
- OpenAI integration (embeddings, chat completions)
- Supabase storage operations  
- Database operations
- Operations parsing and suggestion creation
- Two-pass documentation generation
- Dynamic document retrieval using elbow method
- Job management and progress tracking
- Repository management (Git operations)
- File processing and validation
- Text chunking and embedding generation
- Merkle tree calculations
- Real-time notifications
- Indexing orchestration
"""

from .supabase_client import supabase_client
from .storage import storage_service
from .openai_client import openai_service
from .operations_parser import parse_llm_response_to_suggestions, OperationParseError
from .job_service import JobService
from .two_pass_generator import TwoPassDocumentationGenerator
from .elbow_method import ElbowAnalyzer, ElbowBasedRetrieval
from .repository_service import RepositoryService
from .file_processing_service import FileProcessingService
from .chunk_service import ChunkService
from .database_service import DatabaseService
from .merkle_tree_service import MerkleTreeService
from .indexing_orchestrator import IndexingOrchestrator

__all__ = [
    "supabase_client",
    "storage_service",
    "openai_service",
    "parse_llm_response_to_suggestions",
    "OperationParseError",
    "JobService",
    "TwoPassDocumentationGenerator",
    "ElbowAnalyzer",
    "ElbowBasedRetrieval",
    "RepositoryService",
    "FileProcessingService",
    "ChunkService",
    "DatabaseService",
    "MerkleTreeService",
    "IndexingOrchestrator"
] 