"""
Service for parsing unified diffs and creating suggestions
"""

import re
from typing import List, Dict, Any, Optional, Tuple
from app.database import get_db


class DiffParseError(Exception):
    """Custom exception for diff parsing errors"""
    pass


async def parse_llm_response_to_suggestions(
    llm_response: str,
    repo_id: str,
    user_id: str,
    confidence: float = 0.8,
    model_used: str = "gpt-4"
) -> List[Dict[str, Any]]:
    """
    Parse LLM response containing unified diffs and create suggestion records
    
    Args:
        llm_response: Raw LLM response with unified diff patches
        repo_id: Repository ID for the suggestions
        user_id: User ID for the reviewer in review_decision
        confidence: Confidence score for the suggestions (0.0-1.0)
        model_used: Name of the model that generated the patches
        
    Returns:
        List of created suggestion data
    """
    try:
        # Parse the response into individual file patches
        file_patches = _parse_unified_diffs(llm_response)
        
        if not file_patches:
            return []
        
        # Create suggestions for each file patch
        suggestions = []
        async with get_db() as db:
            for file_path, unified_diff in file_patches:
                # Find the file record
                file_record = await db.file.find_first(
                    where={
                        "repo_id": repo_id,
                        "path": file_path
                    }
                )
                
                if not file_record:
                    print(f"Warning: File {file_path} not found in repository {repo_id}")
                    continue
                
                # Create suggestion record
                suggestion = await db.suggestion.create(
                    data={
                        "file_id": file_record.id,
                        "patch_unified_diff": unified_diff,
                        "status": "pending",
                        "confidence": confidence,
                        "model_used": model_used
                    }
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
                    "patch_unified_diff": suggestion.patch_unified_diff,
                    "status": suggestion.status,
                    "confidence": suggestion.confidence,
                    "model_used": suggestion.model_used,
                    "created_at": suggestion.created_at.isoformat() if suggestion.created_at else None
                })
        
        return suggestions
        
    except Exception as e:
        raise DiffParseError(f"Failed to parse LLM response and create suggestions: {e}")


def _parse_unified_diffs(llm_response: str) -> List[Tuple[str, str]]:
    """
    Parse unified diff patches from LLM response
    
    Args:
        llm_response: Raw LLM response containing unified diffs
        
    Returns:
        List of tuples (file_path, unified_diff)
    """
    patches = []
    
    # Regular expression to match diff headers
    # Matches: --- a/path/to/file.md
    diff_header_pattern = r'^--- a/(.+?)$'
    
    lines = llm_response.strip().split('\n')
    current_patch = []
    current_file_path = None
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check if this line starts a new diff
        match = re.match(diff_header_pattern, line)
        if match:
            # Save previous patch if exists
            if current_file_path and current_patch:
                unified_diff = '\n'.join(current_patch)
                patches.append((current_file_path, unified_diff))
            
            # Start new patch
            current_file_path = match.group(1)
            current_patch = [line]
            
            # Look for the +++ line
            if i + 1 < len(lines) and lines[i + 1].startswith('+++ b/'):
                i += 1
                current_patch.append(lines[i])
            
        elif current_file_path:
            # We're inside a patch, add the line
            current_patch.append(line)
        
        # If we hit another --- line or end of content, finalize current patch
        elif current_file_path and current_patch and (
            line.startswith('--- a/') or i == len(lines) - 1
        ):
            unified_diff = '\n'.join(current_patch)
            patches.append((current_file_path, unified_diff))
            current_file_path = None
            current_patch = []
            continue  # Don't increment i, process this line again
        
        i += 1
    
    # Handle the last patch
    if current_file_path and current_patch:
        unified_diff = '\n'.join(current_patch)
        patches.append((current_file_path, unified_diff))
    
    return patches


def _validate_unified_diff(unified_diff: str) -> bool:
    """
    Validate that a string is a proper unified diff format
    
    Args:
        unified_diff: The diff content to validate
        
    Returns:
        True if valid unified diff format, False otherwise
    """
    lines = unified_diff.strip().split('\n')
    
    if len(lines) < 3:
        return False
    
    # Check for proper headers
    if not (lines[0].startswith('--- ') and lines[1].startswith('+++ ')):
        return False
    
    # Check for at least one hunk header
    has_hunk = False
    for line in lines[2:]:
        if line.startswith('@@') and line.endswith('@@'):
            has_hunk = True
            break
    
    return has_hunk


def _extract_file_path_from_diff_header(header_line: str) -> Optional[str]:
    """
    Extract file path from a diff header line
    
    Args:
        header_line: Line like "--- a/docs/example.md" or "+++ b/docs/example.md"
        
    Returns:
        File path or None if not found
    """
    # Match patterns like "--- a/path" or "+++ b/path"
    match = re.match(r'^[+-]{3} [ab]/(.+)$', header_line)
    if match:
        return match.group(1)
    
    return None


async def create_suggestions_from_patches(
    patches: List[Tuple[str, str]],
    repo_id: str,
    user_id: str,
    confidence: float = 0.8,
    model_used: str = "gpt-4"
) -> List[Dict[str, Any]]:
    """
    Create suggestion records from parsed patches
    
    Args:
        patches: List of (file_path, unified_diff) tuples
        repo_id: Repository ID
        user_id: User ID for the reviewer in review_decision
        confidence: Confidence score for suggestions
        model_used: Model name that generated the patches
        
    Returns:
        List of created suggestion data
    """
    suggestions = []
    
    async with get_db() as db:
        for file_path, unified_diff in patches:
            # Validate the diff format
            if not _validate_unified_diff(unified_diff):
                print(f"Warning: Invalid diff format for {file_path}, skipping")
                continue
            
            # Find the file record
            file_record = await db.file.find_first(
                where={
                    "repo_id": repo_id,
                    "path": file_path
                }
            )
            
            if not file_record:
                print(f"Warning: File {file_path} not found in repository {repo_id}")
                continue
            
            # Create suggestion
            suggestion = await db.suggestion.create(
                data={
                    "file_id": file_record.id,
                    "patch_unified_diff": unified_diff,
                    "status": "pending",
                    "confidence": confidence,
                    "model_used": model_used
                }
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
                "patch_unified_diff": suggestion.patch_unified_diff,
                "status": suggestion.status,
                "confidence": suggestion.confidence,
                "model_used": suggestion.model_used,
                "created_at": suggestion.created_at.isoformat() if suggestion.created_at else None
            })
    
    return suggestions 