import datetime
import os
import tempfile
import hashlib
import shutil
from typing import List, Dict, Any
from pathlib import Path
import sys
import json

from celery import current_task
import psycopg2

import logging
import traceback

from app.tasks.celery_app import celery_app
from app.database import prisma
from app.settings import settings
from app.services.openai_client import openai_service
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

def _restore_std_streams() -> None:
    """If Celery's LoggingProxy is active replace it with the original streams."""
    try:
        from kombu.utils.log import LoggingProxy  # type: ignore

        if isinstance(sys.stdout, LoggingProxy):
            sys.stdout = sys.__stdout__  # type: ignore

        if isinstance(sys.stderr, LoggingProxy):
            sys.stderr = sys.__stderr__  # type: ignore

    except Exception:
        # Best-effort only; never crash due to stdout patching.
        pass

@celery_app.task(bind=True)
def process_indexing(
    self,
    repo_id: str,
    user_id: str,
    github_full_name: str,
    branch: str,
    docs_directory: str,
    github_access_token: str,
    soft_reindex: bool = False
):
    """
    Main indexing task that performs:
    1. Sparse shallow clone of repository
    2. Process files in docs directory
    3. Compute content hashes and upload to storage
    4. Split into semantic chunks
    5. Generate embeddings for new chunks
    6. Store everything in database
    7. Send notifications
    
    When soft_reindex is True:
    - Skip cloning repository and reading from disk
    - Use existing files in storage
    - Regenerate chunks and embeddings
    - Update database
    """
    
    import asyncio
    
    # Wrap everything in a try-catch to prevent exceptions from reaching Celery's internal handling
    try:
        _restore_std_streams()
        result = asyncio.run(_run_indexing_internal(self, repo_id, user_id, github_full_name, branch, docs_directory, github_access_token, soft_reindex))
        return result
    except Exception as e:
        logger.error(f"Error: {e}")
        logger.error(traceback.format_exc())
        # Ensure Celery can serialise and later deserialise the failure information
        _set_task_failure_state(self, e)

        # Return a simplified failure payload (the important information lives in the
        # task meta stored by ``_set_task_failure_state``)
        return {
            "status": "failed",
            "error": str(e),
            "repo_id": repo_id,
        }


async def _run_indexing_internal(
    current_task,
    repo_id: str,
    user_id: str,
    github_full_name: str,
    branch: str,
    docs_directory: str,
    github_access_token: str,
    soft_reindex: bool = False
):
    """
    Internal async function that handles the actual indexing work
    """
    temp_dir = None
    try:
        # Ensure stdout/stderr are real file objects for libraries that require fileno()
        _restore_std_streams()
        
        # Update task status and job record
        current_task.update_state(state='PROGRESS', meta={'step': 'starting', 'progress': 0})
        await _update_job_progress(current_task.request.id, user_id, 'running', 0, 'starting')
        
        # Connect to database if not already connected
        if not prisma.is_connected():
            await prisma.connect()
        
        # Initialize files_data list
        files_data = []
        
        if not soft_reindex:
            # Hard re-indexing: Clone repo and process files from disk
            # Create temporary directory for git operations
            temp_dir = tempfile.mkdtemp(prefix="doccelerate_index_")
            
            # Step 1: Clone repository
            current_task.update_state(state='PROGRESS', meta={'step': 'cloning', 'progress': 10})
            await _update_job_progress(current_task.request.id, user_id, 'running', 10, 'cloning')
            repo_path = await _clone_repository(github_full_name, branch, docs_directory, temp_dir, github_access_token)
            
            # Step 2: Process files
            current_task.update_state(state='PROGRESS', meta={'step': 'processing_files', 'progress': 30})
            await _update_job_progress(current_task.request.id, user_id, 'running', 30, 'processing_files')
            files_data = await _process_files(repo_path, docs_directory, repo_id)
        else:
            # Soft re-indexing: Use existing files in storage
            current_task.update_state(state='PROGRESS', meta={'step': 'fetching_existing_files', 'progress': 20})
            await _update_job_progress(current_task.request.id, user_id, 'running', 20, 'fetching_existing_files')
            
            # Get existing files from database
            files = await prisma.file.find_many(
                where={
                    "repo_id": repo_id
                },
                include={
                    "repo": True
                }
            )
            
            if not files:
                raise ValueError(f"No files found for repository {repo_id}. Cannot perform soft re-index.")
            
            # Process existing files and prepare them for re-chunking
            for file in files:
                try:
                    # Get file content from storage
                    storage_key = file.storage_key
                    # The storage_key in database includes 'docs/' prefix, but the bucket is already 'docs',
                    # so we need to remove the 'docs/' prefix from the storage key
                    storage_path = storage_key[5:] if storage_key.startswith('docs/') else storage_key
                    
                    # Get content from storage
                    content = await storage_service.get_file_content('docs', storage_path)
                    if not content:
                        logger.warning(f"Could not fetch content for file {file.path}. Skipping.")
                        continue
                    
                    # Add to files_data with existing metadata
                    files_data.append({
                        'path': file.path,
                        'content': content,
                        'content_hash': file.content_hash,
                        'storage_key': file.storage_key,
                        'repo_id': repo_id
                    })
                except Exception as e:
                    logger.error(f"Error processing file {file.path}: {e}")
            
            current_task.update_state(state='PROGRESS', meta={
                'step': 'files_processed', 
                'progress': 40,
                'files_count': len(files_data)
            })
            await _update_job_progress(current_task.request.id, user_id, 'running', 40, 'files_processed')
        
        # Step 3: Generate chunks and embeddings
        current_task.update_state(state='PROGRESS', meta={'step': 'generating_embeddings', 'progress': 60})
        await _update_job_progress(current_task.request.id, user_id, 'running', 60, 'generating_embeddings')
        chunks_data = await _process_chunks(files_data)
        
        # Step 4: Store in database
        current_task.update_state(state='PROGRESS', meta={'step': 'storing_data', 'progress': 80})
        await _update_job_progress(current_task.request.id, user_id, 'running', 80, 'storing_data')
        await _store_data(repo_id, files_data, chunks_data, soft_reindex)
        
        # Step 5: Calculate and store Merkle tree
        current_task.update_state(state='PROGRESS', meta={'step': 'merkle_tree', 'progress': 90})
        await _update_job_progress(current_task.request.id, user_id, 'running', 90, 'merkle_tree')
        root_hash = await _calculate_merkle_tree(repo_id, files_data)
        
        # Step 6: Update repository with sync info
        if not soft_reindex:
            # For hard re-indexing, update the commit SHA from git
            commit_sha = _get_commit_sha(repo_path)
        else:
            # For soft re-indexing, keep the existing commit SHA
            repo = await prisma.repo.find_unique(where={"id": repo_id})
            commit_sha = repo.last_sync_sha if repo else None
            
        await _update_repo_sync_info(repo_id, commit_sha, root_hash)
        
        # Step 7: Send notification
        current_task.update_state(state='PROGRESS', meta={'step': 'notifying', 'progress': 95})
        await _update_job_progress(current_task.request.id, user_id, 'running', 95, 'notifying')
        _send_repo_indexed_notification(repo_id)
        
        # Complete
        current_task.update_state(state='SUCCESS', meta={'step': 'completed', 'progress': 100})
        await _update_job_progress(current_task.request.id, user_id, 'completed', 100, 'completed')
        
        return {
            'status': 'completed',
            'files_processed': len(files_data),
            'chunks_created': len(chunks_data),
            'repo_id': repo_id,
            'soft_reindex': soft_reindex
        }
        
    except Exception as e:
        # Update job with failure status
        await _update_job_progress(current_task.request.id, user_id, 'failed', None, 'failed', str(e))

        # Return the basic failure structure (detailed info is in task meta)
        return {
            "status": "failed",
            "error": str(e),
            "repo_id": repo_id,
        }
        
    finally:
        # Cleanup
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
        
        # Disconnect from database
        if prisma.is_connected():
            await prisma.disconnect()


async def _clone_repository(github_full_name: str, branch: str, docs_directory: str, temp_dir: str, github_access_token: str) -> str:
    """
    Perform sparse shallow clone of repository
    """
    # Import GitPython lazily after stdout/stderr streams have been reset so
    # the library does not pick up Kombu's LoggingProxy objects (they lack
    # ``fileno``).
    from git import Repo  # noqa: WPS433 (runtime import justified)
    repo_url = f"https://{github_access_token}@github.com/{github_full_name}.git"
    repo_path = os.path.join(temp_dir, "repo")
    
    # Clone with sparse checkout
    repo = Repo.clone_from(
        repo_url,
        repo_path,
        branch=branch,
        depth=1,  # Shallow clone
        single_branch=True
    )
    
    # Configure sparse checkout
    sparse_checkout_path = os.path.join(repo_path, ".git", "info", "sparse-checkout")
    os.makedirs(os.path.dirname(sparse_checkout_path), exist_ok=True)
    with open(sparse_checkout_path, "w") as f:
        f.write(f"{docs_directory}/*\n")
    
    # Enable sparse checkout
    repo.git.config("core.sparseCheckout", "true")
    repo.git.read_tree("-m", "-u", "HEAD")
    
    return repo_path


async def _process_files(repo_path: str, docs_directory: str, repo_id: str) -> List[Dict[str, Any]]:
    """
    Process all files in the docs directory
    """
    files_data = []
    docs_path = os.path.join(repo_path, docs_directory)
    
    if not os.path.exists(docs_path):
        return files_data
    
    for root, dirs, files in os.walk(docs_path):
        for file in files:
            file_path = os.path.join(root, file)
            relative_path = os.path.relpath(file_path, docs_path)
            
            # Skip binary files and hidden files
            if file.startswith('.') or _is_binary_file(file_path):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Calculate content hash
                content_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()
                
                # Upload to Supabase storage using storage service
                storage_key = f"docs/{repo_id}/{relative_path}"
                upload_success = storage_service.upload_document(
                    repo_id=repo_id, 
                    file_path=relative_path, 
                    content=content.encode('utf-8'),
                    force_update=True  # Force update to handle existing files
                )
                
                if not upload_success:
                    logger.warning(f"Warning: Failed to upload {relative_path} to storage")
                
                files_data.append({
                    'path': relative_path,
                    'content': content,
                    'content_hash': content_hash,
                    'storage_key': storage_key
                })
                
            except (UnicodeDecodeError, OSError):
                # Skip files that can't be read as text
                continue
    
    return files_data


def _is_binary_file(file_path: str) -> bool:
    """
    Check if file is binary
    """
    try:
        with open(file_path, 'rb') as f:
            chunk = f.read(1024)
            return b'\0' in chunk
    except OSError:
        return True


async def _process_chunks(files_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Split files into semantic chunks and generate embeddings
    """
    chunks_data = []
    
    for file_data in files_data:
        content = file_data['content']
        
        # Split into chunks using OpenAI service
        chunks = openai_service.split_text_by_tokens(content)
        
        # Calculate line positions for each chunk
        content_lines = content.split('\n')
        chunk_line_positions = []
        
        for i, chunk_content in enumerate(chunks):
            # Find where this chunk starts in the original content
            if i == 0:
                start_pos = 0
            else:
                # Use the previous chunk end to find where this one starts
                prev_chunk = chunks[i-1]
                # Find the position after the previous chunk
                prev_end_pos = content.find(prev_chunk) + len(prev_chunk)
                # The current chunk starts somewhere after the previous one
                # Need to find exact position accounting for potential overlaps
                search_start = max(0, prev_end_pos - 200)  # Look back a bit to handle overlaps
                remaining_content = content[search_start:]
                chunk_start_in_remaining = remaining_content.find(chunk_content)
                if chunk_start_in_remaining == -1:
                    # Fallback if exact match isn't found (could happen with whitespace differences)
                    # Use approximate position
                    start_pos = prev_end_pos
                else:
                    start_pos = search_start + chunk_start_in_remaining
            
            # Get chunk end position
            end_pos = start_pos + len(chunk_content)
            
            # Calculate line numbers
            start_line = 1
            end_line = 1
            
            # Count newlines before start position
            start_text = content[:start_pos]
            start_line = start_text.count('\n') + 1  # 1-based line numbers
            
            # Count newlines before end position
            end_text = content[:end_pos]
            end_line = end_text.count('\n') + 1
            
            # Ensure end_line is at least start_line
            end_line = max(start_line, end_line)
            
            chunk_line_positions.append((start_line, end_line))
        
        # Process chunks with calculated line positions
        for i, chunk_content in enumerate(chunks):
            # Calculate chunk hash
            chunk_hash = hashlib.sha256(chunk_content.encode('utf-8')).hexdigest()
            
            # Get line positions
            start_line, end_line = chunk_line_positions[i]
            
            # Check if chunk already exists using raw SQL
            existing_chunk_result = await prisma.query_raw(
                "SELECT hash, token_count FROM public.chunk WHERE hash = $1 LIMIT 1",
                chunk_hash
            )
            existing_chunk = existing_chunk_result[0] if existing_chunk_result else None
            
            if not existing_chunk:
                # Generate embedding for new chunk using OpenAI service
                embedding = await openai_service.generate_embedding_with_retry(chunk_content)
                
                if embedding is None:
                    # Use fallback embedding if generation failed
                    embedding = openai_service.get_fallback_embedding()
                
                chunks_data.append({
                    'hash': chunk_hash,
                    'content': chunk_content,
                    'embedding': embedding,
                    'token_count': openai_service.count_tokens(chunk_content),
                    'file_path': file_data['path'],
                    'chunk_order': i,
                    'start_line': start_line,
                    'end_line': end_line
                })
            else:
                # Link existing chunk to file
                chunks_data.append({
                    'hash': chunk_hash,
                    'content': None,  # Don't need to store again
                    'embedding': None,  # Don't need to generate again
                    'token_count': existing_chunk['token_count'],
                    'file_path': file_data['path'],
                    'chunk_order': i,
                    'start_line': start_line,
                    'end_line': end_line
                })
    
    return chunks_data


async def _store_data(repo_id: str, files_data: List[Dict[str, Any]], chunks_data: List[Dict[str, Any]], soft_reindex: bool = False) -> None:
    """
    Store files and chunks in database
    
    Args:
        repo_id: Repository ID
        files_data: List of file data dictionaries
        chunks_data: List of chunk data dictionaries
        soft_reindex: Flag indicating if this is a soft re-indexing operation
    """
    # Upsert files
    for file_data in files_data:
        update_data = {
            "content_hash": file_data['content_hash'],
            "storage_key": file_data['storage_key'],
            "updated_at": None  # Will use default
        }
        
        # Only reset has_uncommitted_changes flag if not soft re-indexing
        if not soft_reindex:
            update_data["has_uncommitted_changes"] = False
            
        await prisma.file.upsert(
            where={
                "repo_id_path": {
                    "repo_id": repo_id,
                    "path": file_data['path']
                }
            },
            data={
                "create": {
                    "repo_id": repo_id,
                    "path": file_data['path'],
                    "content_hash": file_data['content_hash'],
                    "storage_key": file_data['storage_key'],
                    "has_uncommitted_changes": False  # Always false for newly created files
                },
                "update": update_data
            }
        )
    
    # Insert new chunks using raw SQL due to vector embedding compatibility issues
    # Note: Using raw SQL instead of Prisma mutations due to vector field limitations
    new_chunks = [chunk for chunk in chunks_data if chunk['content'] is not None]
    for chunk in new_chunks:
        # Use raw SQL to insert chunks with vector embeddings
        await prisma.execute_raw(
            """
            INSERT INTO public.chunk (hash, content, embedding, token_count, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (hash) DO NOTHING
            """,
            chunk['hash'],
            chunk['content'],
            chunk['embedding'],
            chunk['token_count']
        )
    
    # Create file-chunk relationships
    for chunk in chunks_data:
        file_record = await prisma.file.find_first(
            where={
                "repo_id": repo_id,
                "path": chunk['file_path']
            }
        )
        
        if file_record:
            await prisma.file_chunk.upsert(
                where={
                    "file_id_chunk_order": {
                        "file_id": file_record.id,
                        "chunk_order": chunk['chunk_order']
                    }
                },
                data={
                    "create": {
                        "file_id": file_record.id,
                        "chunk_hash": chunk['hash'],
                        "chunk_order": chunk['chunk_order'],
                        "start_line": chunk['start_line'],
                        "end_line": chunk['end_line']
                    },
                    "update": {
                        "chunk_hash": chunk['hash'],
                        "start_line": chunk['start_line'],
                        "end_line": chunk['end_line']
                    }
                }
            )


async def _calculate_merkle_tree(repo_id: str, files_data: List[Dict[str, Any]]) -> str:
    """
    Calculate Merkle tree root hash for the repository
    """
    # Simple implementation: hash of all file hashes sorted by path
    file_hashes = sorted([
        (file_data['path'], file_data['content_hash'])
        for file_data in files_data
    ])
    
    # Create combined hash
    combined = ''.join([f"{path}:{hash}" for path, hash in file_hashes])
    root_hash = hashlib.sha256(combined.encode('utf-8')).hexdigest()
    
    # Store Merkle nodes
    for path, file_hash in file_hashes:
        await prisma.merkle_node.upsert(
            where={
                "repo_id_path": {
                    "repo_id": repo_id,
                    "path": path
                }
            },
            data={
                "create": {
                    "repo_id": repo_id,
                    "path": path,
                    "hash": file_hash,
                    "node_type": "file",
                    "parent_path": os.path.dirname(path) if os.path.dirname(path) else None
                },
                "update": {
                    "hash": file_hash
                }
            }
        )
    
    return root_hash


def _get_commit_sha(repo_path: str) -> str:
    """
    Get the current commit SHA
    """
    from git import Repo  # noqa: WPS433 – runtime import to avoid early reference to LoggingProxy
    repo = Repo(repo_path)
    return repo.head.commit.hexsha


async def _update_repo_sync_info(repo_id: str, commit_sha: str, root_hash: str) -> None:
    """
    Update repository with sync information
    """
    await prisma.repo.update(
        where={"id": repo_id},
        data={
            "last_sync_sha": commit_sha,
            "root_hash": root_hash,
            "updated_at": None  # Will use default
        }
    )


def _send_repo_indexed_notification(repo_id: str) -> None:
    """
    Send NOTIFY repo_indexed notification via Postgres
    """
    try:
        # Clean the database URL to remove pgbouncer and other connection pooling parameters
        database_url = settings.DATABASE_URL
        
        # Parse and clean the URL
        from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
        parsed = urlparse(database_url)
        
        # Remove pgbouncer and other pooling-related query parameters
        if parsed.query:
            query_params = parse_qs(parsed.query)
            # Remove problematic parameters
            query_params.pop('pgbouncer', None)
            query_params.pop('connection_limit', None)
            query_params.pop('pool_timeout', None)
            
            # Rebuild query string
            clean_query = urlencode(query_params, doseq=True)
            clean_parsed = parsed._replace(query=clean_query)
            clean_database_url = urlunparse(clean_parsed)
        else:
            clean_database_url = database_url
        
        # Connect directly to Postgres for NOTIFY
        conn = psycopg2.connect(clean_database_url)
        cur = conn.cursor()
        
        # Send notification
        cur.execute("NOTIFY repo_indexed, %s", (repo_id,))
        conn.commit()
        
        cur.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"Failed to send notification: {e}")
        # Don't fail the main indexing task if notification fails

# Helper to update Celery task state on failure with the expected keys so that
# Celery can deserialize the exception properly when reading the result from
# the backend.  See: https://docs.celeryq.dev/en/stable/userguide/tasks.html#task-state

def _set_task_failure_state(task, exc, step: str = "failed") -> None:
    """Update the given Celery *task* state to FAILURE with a metadata payload
    that contains the keys expected by Celery's result backend (``exc_type``,
    ``exc_message`` and ``exc_module``). Without these keys the backend raises
    ``ValueError('Exception information must include the exception type')``
    when it later tries to decode the stored result.  Any additional metadata
    (like the current *step* or *progress*) can be appended safely.
    """
    task.update_state(
        state="FAILURE",
        meta={
            "exc_type": exc.__class__.__name__,
            "exc_message": str(exc),
            "exc_module": exc.__class__.__module__,
            "step": step,
            "progress": 0,
        },
    )

async def _update_job_progress(task_id: str, user_id: str, status: str, progress: float = None, step: str = None, error_msg: str = None):
    """
    Update job progress in the database
    """
    try:
        # Ensure Prisma is connected
        if not prisma.is_connected():
            await prisma.connect()
        
        update_data = {
            "status": status,
            "updated_at": None  # Will use default
        }
        
        if progress is not None:
            update_data["progress"] = progress / 100.0  # Convert to 0.0-1.0 range
            
        if error_msg:
            update_data["error_msg"] = error_msg
            
        # Update metadata with current step if provided
        if step:
            try:
                existing_job = await prisma.job.find_unique(
                    where={"task_id": task_id}
                )
                if existing_job and existing_job.metadata:
                    # Parse existing metadata from JSON string if needed
                    if isinstance(existing_job.metadata, str):
                        metadata = json.loads(existing_job.metadata)
                    else:
                        metadata = existing_job.metadata
                    
                    # Add current step
                    metadata["current_step"] = step
                    update_data["metadata"] = json.dumps(metadata)
                else:
                    # Create metadata if it doesn't exist
                    update_data["metadata"] = json.dumps({"current_step": step})
                    
                update_data["updated_at"] = datetime.datetime.now()
            except Exception as e:
                logger.error(f"Error updating metadata for task {task_id}: {e}")
                # Continue without metadata update to avoid blocking the job progress

        await prisma.job.update(
            where={"task_id": task_id},
            data=update_data
        )
        
    except Exception as e:
        logger.error(f"Failed to update job progress: {e}")
        # Don't fail the main task if job update fails
