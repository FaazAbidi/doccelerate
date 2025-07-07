"""
Services module for the doccelerate API

This module contains various service classes and utilities for:
- OpenAI integration (embeddings, chat completions)
- Supabase storage operations  
- Database operations
- Diff parsing and suggestion creation
"""

from .supabase_client import supabase_client
from .storage import storage_service
from .openai_client import openai_service
from .operations_parser import parse_llm_response_to_suggestions, OperationParseError

__all__ = [
    "supabase_client",
    "storage_service",
    "openai_service",
    "parse_llm_response_to_suggestions",
    "OperationParseError"
] 