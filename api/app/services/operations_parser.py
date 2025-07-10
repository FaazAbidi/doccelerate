"""
Service for parsing operations JSON and creating suggestions
"""

import json
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, validator
from enum import Enum

from app.database import get_db
from app.services.storage import storage_service
import logging

logger = logging.getLogger(__name__)


class OperationType(str, Enum):
    INSERT_AFTER = "insertAfter"
    INSERT_BEFORE = "insertBefore"
    REPLACE = "replace"
    DELETE_BLOCK = "deleteBlock"


class Operation(BaseModel):
    file: str
    op: OperationType
    find: Optional[str] = None
    replace: Optional[str] = None
    insert: Optional[str] = None
    until: Optional[str] = None

    @validator('find', always=True)
    def validate_find_required(cls, v, values):
        if v is None:
            raise ValueError('find is required for all operations')
        return v

    @validator('replace', always=True)
    def validate_replace_for_replace_op(cls, v, values):
        if values.get('op') == OperationType.REPLACE and v is None:
            raise ValueError('replace is required for replace operations')
        return v

    @validator('insert', always=True)
    def validate_insert_for_insert_ops(cls, v, values):
        op = values.get('op')
        if op in [OperationType.INSERT_AFTER, OperationType.INSERT_BEFORE] and v is None:
            raise ValueError('insert is required for insert operations')
        return v

    @validator('until', always=True)
    def validate_until_for_delete_block(cls, v, values):
        if values.get('op') == OperationType.DELETE_BLOCK and v is None:
            raise ValueError('until is required for deleteBlock operations')
        return v


class OperationParseError(Exception):
    """Custom exception for operation parsing errors"""
    pass


class OperationApplyError(Exception):
    """Custom exception for operation application errors"""
    pass


def validate_operations(operations_json: List[Dict[str, Any]]) -> List[Operation]:
    """
    Validate operations JSON against the schema and return parsed operations
    
    Args:
        operations_json: List of operation dictionaries
        
    Returns:
        List of validated Operation objects
        
    Raises:
        OperationParseError: If validation fails
    """
    try:
        operations = []
        for op_data in operations_json:
            operation = Operation(**op_data)
            operations.append(operation)
        return operations
    except Exception as e:
        raise OperationParseError(f"Invalid operations JSON: {e}")


def apply_operation_to_content(content: str, operation: Operation) -> str:
    """
    Apply a single operation to content
    
    Args:
        content: Original file content
        operation: Operation to apply
        
    Returns:
        Modified content
        
    Raises:
        OperationApplyError: If operation cannot be applied
    """
    lines = content.splitlines()
    
    try:
        if operation.op == OperationType.INSERT_AFTER:
            return _apply_insert_after(lines, operation)
        elif operation.op == OperationType.INSERT_BEFORE:
            return _apply_insert_before(lines, operation)
        elif operation.op == OperationType.REPLACE:
            return _apply_replace(lines, operation)
        elif operation.op == OperationType.DELETE_BLOCK:
            return _apply_delete_block(lines, operation)
        else:
            raise OperationApplyError(f"Unknown operation type: {operation.op}")
    except Exception as e:
        raise OperationApplyError(f"Failed to apply operation {operation.op} on file {operation.file}: {e}")


def _apply_insert_after(lines: List[str], operation: Operation) -> str:
    """Apply insertAfter operation"""
    find_text = operation.find
    insert_text = operation.insert
    
    # Rejoin lines to search for multi-line patterns
    full_content = '\n'.join(lines)
    
    # Check if find_text exists in the content
    if find_text not in full_content:
        raise OperationApplyError(f"Could not find anchor text: {find_text}")
    
    # Find the position of the match
    match_start = full_content.find(find_text)
    match_end = match_start + len(find_text)
    
    # Find which line the match ends on
    content_before_match_end = full_content[:match_end]
    lines_before_match_end = content_before_match_end.split('\n')
    target_line_idx = len(lines_before_match_end) - 1
    
    # Insert after the target line
    lines.insert(target_line_idx + 1, insert_text)
    return '\n'.join(lines)


def _apply_insert_before(lines: List[str], operation: Operation) -> str:
    """Apply insertBefore operation"""
    find_text = operation.find
    insert_text = operation.insert
    
    # Rejoin lines to search for multi-line patterns
    full_content = '\n'.join(lines)
    
    # Check if find_text exists in the content
    if find_text not in full_content:
        raise OperationApplyError(f"Could not find anchor text: {find_text}")
    
    # Find the position of the match
    match_start = full_content.find(find_text)
    
    # Find which line the match starts on
    content_before_match_start = full_content[:match_start]
    lines_before_match_start = content_before_match_start.split('\n')
    target_line_idx = len(lines_before_match_start) - 1
    
    # Insert before the target line
    lines.insert(target_line_idx, insert_text)
    return '\n'.join(lines)


def _apply_replace(lines: List[str], operation: Operation) -> str:
    """Apply replace operation"""
    find_text = operation.find
    replace_text = operation.replace
    
    # Rejoin lines to search for multi-line patterns
    full_content = '\n'.join(lines)
    
    # Check if find_text exists in the content
    if find_text not in full_content:
        raise OperationApplyError(f"Could not find text to replace: {find_text}")
    
    # Replace the text
    modified_content = full_content.replace(find_text, replace_text)
    return modified_content


def _apply_delete_block(lines: List[str], operation: Operation) -> str:
    """Apply deleteBlock operation"""
    find_text = operation.find
    until_text = operation.until
    
    # Rejoin lines to search for multi-line patterns
    full_content = '\n'.join(lines)
    
    # Find the start and end positions
    start_pos = full_content.find(find_text)
    if start_pos == -1:
        raise OperationApplyError(f"Could not find start anchor text: {find_text}")
    
    end_pos = full_content.find(until_text, start_pos)
    if end_pos == -1:
        raise OperationApplyError(f"Could not find end anchor text: {until_text}")
    
    # Include the until_text in the deletion
    end_pos += len(until_text)
    
    # Delete the block
    modified_content = full_content[:start_pos] + full_content[end_pos:]
    return modified_content


def apply_operations_to_content(content: str, operations: List[Operation]) -> str:
    """
    Apply multiple operations to content in sequence
    
    Args:
        content: Original file content
        operations: List of operations to apply
        
    Returns:
        Modified content after all operations
        
    Raises:
        OperationApplyError: If any operation fails
    """
    result = content
    
    for operation in operations:
        result = apply_operation_to_content(result, operation)
    
    return result


def validate_operations_apply_to_content(content: str, operations_json: List[Dict[str, Any]]) -> bool:
    """
    Validate that operations can be applied to content without errors
    
    Args:
        content: Original file content
        operations_json: List of operation dictionaries
        
    Returns:
        True if all operations can be applied, False otherwise
    """
    try:
        logger.info(f"Validating operations: {operations_json}")
        operations = validate_operations(operations_json)
        apply_operations_to_content(content, operations)
        return True
    except (OperationParseError, OperationApplyError) as e:
        logger.warning(f"Operations validation failed: {e}")
        return False


async def parse_llm_response_to_suggestions(
    operations_json: List[Dict[str, Any]],
    repo_id: str,
    user_id: str,
    confidence: float = 0.8,
    model_used: str = "gpt-4"
) -> List[Dict[str, Any]]:
    """
    Parse LLM response containing operations JSON and create suggestion records
    
    Args:
        operations_json: List of operation dictionaries from LLM
        repo_id: Repository ID for the suggestions
        user_id: User ID for the reviewer in review_decision
        confidence: Confidence score for the suggestions (0.0-1.0)
        model_used: Name of the model that generated the operations
        
    Returns:
        List of created suggestion data
    """
    try:
        if not operations_json:
            return []
        
        # Validate operations
        operations = validate_operations(operations_json)
        
        # Group operations by file
        operations_by_file = {}
        for operation in operations:
            file_path = operation.file
            if file_path not in operations_by_file:
                operations_by_file[file_path] = []
            operations_by_file[file_path].append(operation.dict())
        
        # Create suggestions for each file
        suggestions = []
        async with get_db() as db:
            for file_path, file_operations in operations_by_file.items():
                # Find the file record
                file_record = await db.file.find_first(
                    where={
                        "repo_id": repo_id,
                        "path": file_path
                    }
                )
                
                if not file_record:
                    logger.warning(f"File {file_path} not found in repository {repo_id}")
                    continue
                
                # Fetch current file content from storage to validate the operations
                try:
                    storage_key = f"{repo_id}/{file_path}"
                    current_content = await storage_service.get_file_content("docs", storage_key)
                    
                    # Validate that operations can be applied
                    if not validate_operations_apply_to_content(current_content, file_operations):
                        logger.warning(f"Operations for {file_path} cannot be applied – skipping suggestion")
                        continue
                        
                except Exception as fetch_err:
                    logger.warning("Could not fetch file content for %s to validate operations: %s", file_path, fetch_err)
                    # Continue without validation if we can't fetch content
                
                # Create suggestion record
                suggestion_data = {
                    "file_id": file_record.id,
                    "operations_json": json.dumps(file_operations),
                    "status": "pending",
                    "confidence": confidence,
                    "model_used": model_used
                }
                
                logger.info(f"Creating suggestion with data: {suggestion_data}")
                logger.info(f"File operations type: {type(file_operations)}")
                logger.info(f"File operations content: {file_operations}")
                
                suggestion = await db.suggestion.create(
                    data=suggestion_data
                )
                
                # Create review_decision record for this suggestion
                await db.review_decision.create(
                    data={
                        "suggestion_id": suggestion.id,
                        "reviewer_id": user_id,
                        "decision": "pending"
                    }
                )
                
                suggestions.append({
                    "id": suggestion.id,
                    "file_id": suggestion.file_id,
                    "file_path": file_path,
                    "operations_json": suggestion.operations_json,
                    "status": suggestion.status,
                    "confidence": suggestion.confidence,
                    "model_used": suggestion.model_used,
                    "created_at": suggestion.created_at.isoformat() if suggestion.created_at else None
                })
        
        return suggestions
        
    except Exception as e:
        raise OperationParseError(f"Failed to parse LLM response and create suggestions: {e}")


def parse_operations_json(raw_response: str) -> List[Dict[str, Any]]:
    """
    Parse LLM response containing operations JSON
    
    Args:
        raw_response: Raw LLM response containing JSON
        
    Returns:
        List of operation dictionaries
        
    Raises:
        OperationParseError: If JSON parsing fails
    """
    try:
        # Try to extract JSON from the response
        # Handle cases where LLM might wrap JSON in markdown code blocks
        cleaned_response = raw_response.strip()
        
        if cleaned_response.startswith("```json"):
            # Remove markdown code blocks
            lines = cleaned_response.splitlines()
            cleaned_response = '\n'.join(lines[1:-1])
        elif cleaned_response.startswith("```"):
            # Remove any other code blocks
            lines = cleaned_response.splitlines()
            cleaned_response = '\n'.join(lines[1:-1])
        
        # Parse JSON
        operations_json = json.loads(cleaned_response)
        
        if not isinstance(operations_json, list):
            raise OperationParseError("Operations JSON must be a list")
        
        return operations_json
        
    except json.JSONDecodeError as e:
        raise OperationParseError(f"Invalid JSON in LLM response: {e}")
    except Exception as e:
        raise OperationParseError(f"Failed to parse operations JSON: {e}") 