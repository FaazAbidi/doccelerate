"""
Services module for the doccelerate API

This module contains various service classes and utilities for:
- OpenAI integration (embeddings, chat completions)
- Supabase storage operations  
- Database operations
- Operations parsing and suggestion creation
- Two-pass documentation generation
- Job management and progress tracking
"""

from .supabase_client import supabase_client
from .storage import storage_service
from .openai_client import openai_service
from .operations_parser import parse_llm_response_to_suggestions, OperationParseError
from .job_service import JobService
from .two_pass_generator import TwoPassDocumentationGenerator

__all__ = [
    "supabase_client",
    "storage_service",
    "openai_service",
    "parse_llm_response_to_suggestions",
    "OperationParseError",
    "JobService",
    "TwoPassDocumentationGenerator"
] 