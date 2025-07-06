import asyncio
import traceback
import logging
import json
from typing import Dict, Any, List

from .celery_app import celery_app
from app.database import get_db, prisma
from app.services.openai_client import openai_service
from app.services.diff_parser import parse_llm_response_to_suggestions, DiffParseError

# Set up logging
logger = logging.getLogger(__name__)

async def _update_job_progress(task_id: str, user_id: str, status: str, progress: float = None, step: str = None, error_msg: str = None):
    """Update job progress in database"""
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
            existing_job = await prisma.job.find_unique(
                where={"task_id": task_id}
            )
            if existing_job and existing_job.metadata:
                # Parse existing JSON metadata
                try:
                    metadata = json.loads(existing_job.metadata) if isinstance(existing_job.metadata, str) else existing_job.metadata
                except (json.JSONDecodeError, TypeError):
                    metadata = {}
                
                metadata["current_step"] = step
                update_data["metadata"] = json.dumps(metadata)
            elif step:
                # Create metadata if it doesn't exist
                update_data["metadata"] = json.dumps({"current_step": step})
        
        await prisma.job.update(
            where={"task_id": task_id},
            data=update_data
        )
        
    except Exception as e:
        logger.error(f"Failed to update job progress: {e}")
        # Don't fail the main task if job update fails


def _set_task_failure_state(current_task, error: Exception):
    """Set task failure state with error details"""
    current_task.update_state(
        state='FAILURE',
        meta={
            'step': 'failed',
            'progress': 0,
            'error': str(error),
            'traceback': traceback.format_exc()
        }
    )


@celery_app.task(bind=True, name="app.tasks.process_query")
def process_query(self, query: str, user_id: str, repo_id: str) -> Dict[str, Any]:
    """
    Process a natural language documentation change request.
    
    This task:
    1. Embeds the query text
    2. Searches for relevant chunks using pgvector
    3. Checks if repo needs re-indexing based on Merkle tree
    4. Prompts LLM with context to generate unified diff patches
    5. Parses diffs and creates suggestion records
    6. Sends real-time notifications
    
    Args:
        query: Natural language change request
        user_id: ID of the user making the request
        repo_id: ID of the repository to modify
        
    Returns:
        Dict with processing results
    """
    try:
        result = asyncio.run(_run_query_internal(self, query, user_id, repo_id))
        return result
    except Exception as e:
        logger.error(f"Query processing error: {e}")
        logger.error(traceback.format_exc())
        _set_task_failure_state(self, e)
        
        return {
            "status": "failed",
            "error": str(e),
            "query": query[:100] + "..." if len(query) > 100 else query,
            "repo_id": repo_id
        }


async def _run_query_internal(
    current_task,
    query: str,
    user_id: str,
    repo_id: str
) -> Dict[str, Any]:
    """Internal async function that handles the actual query processing"""
    try:
        # Connect to database
        await prisma.connect()
        
        # Step 1: Starting
        current_task.update_state(state='PROGRESS', meta={'step': 'starting', 'progress': 0})
        await _update_job_progress(current_task.request.id, user_id, 'running', 0, 'starting')
        
        # Step 2: Embed the query
        current_task.update_state(state='PROGRESS', meta={'step': 'embedding_query', 'progress': 10})
        await _update_job_progress(current_task.request.id, user_id, 'running', 10, 'embedding_query')
        
        query_embedding = await openai_service.generate_embedding_with_retry(query)
        if not query_embedding:
            raise Exception("Failed to generate embedding for query")
        
        # Step 3: Search for relevant chunks
        current_task.update_state(state='PROGRESS', meta={'step': 'searching_chunks', 'progress': 25})
        await _update_job_progress(current_task.request.id, user_id, 'running', 25, 'searching_chunks')
        
        relevant_chunks = await openai_service.search_similar_chunks(
            query_embedding=query_embedding,
            repo_id=repo_id,
            limit=15,  # Get more chunks for better context
            similarity_threshold=0.3  # Lower threshold for broader search
        )
        
        # Fallback: try lexical full-text search if vector search returned nothing
        if not relevant_chunks:
            current_task.update_state(state='PROGRESS', meta={'step': 'searching_fulltext', 'progress': 30})
            await _update_job_progress(current_task.request.id, user_id, 'running', 30, 'searching_fulltext')

            relevant_chunks = await openai_service.search_chunks_fulltext(
                query_text=query,
                repo_id=repo_id,
                limit=15
            )
            
        logger.info(f"Relevant chunks: {relevant_chunks}")
        
        if not relevant_chunks:
            # Complete the job and update metadata
            current_task.update_state(state='SUCCESS', meta={'step': 'completed', 'progress': 100})
            await _update_job_progress(current_task.request.id, user_id, 'completed', 100, 'completed')
            
            await _update_job_completion(
                task_id=current_task.request.id,
                user_id=user_id,
                suggestions_created=0,
                message="No relevant documentation found for query"
            )
            return {
                "status": "completed",
                "message": "No relevant documentation found for query",
                "suggestions_created": 0,
                "query": query,
                "repo_id": repo_id
            }
        
        # Step 4: Check if repo needs re-indexing (optional optimization)
        current_task.update_state(state='PROGRESS', meta={'step': 'checking_repo_status', 'progress': 35})
        await _update_job_progress(current_task.request.id, user_id, 'running', 35, 'checking_repo_status')
        
        # For now, we'll process the query regardless of repo sync status
        # In a future optimization, we could check repo.root_hash against Merkle tree
        
        # Step 5: Prepare context for LLM
        current_task.update_state(state='PROGRESS', meta={'step': 'preparing_context', 'progress': 45})
        await _update_job_progress(current_task.request.id, user_id, 'running', 45, 'preparing_context')
        
        # Group chunks by file for better context
        files_context = {}
        for chunk in relevant_chunks:
            file_path = chunk['file_path']
            if file_path not in files_context:
                files_context[file_path] = []
            files_context[file_path].append(chunk)
        
        # Build context with file grouping
        context_chunks = []
        file_paths = []
        for file_path, file_chunks in files_context.items():
            file_paths.append(file_path)
            # Sort chunks by chunk_order for coherent reading
            sorted_chunks = sorted(file_chunks, key=lambda x: x['chunk_order'])
            
            for chunk in sorted_chunks:
                context_chunks.append({
                    'file_path': file_path,
                    'content': chunk['content'],
                    'similarity': chunk['similarity']
                })
        
        # Step 6: Generate patches with LLM
        current_task.update_state(state='PROGRESS', meta={'step': 'generating_patches', 'progress': 60})
        await _update_job_progress(current_task.request.id, user_id, 'running', 60, 'generating_patches')
        
        llm_response = await openai_service.generate_documentation_patches(
            user_query=query,
            relevant_chunks=context_chunks,
            file_paths=file_paths,
            model="gpt-4"
        )
        
        if not llm_response:
            raise Exception("Failed to generate patches from LLM")
        
        # Step 7: Parse diffs and create suggestions
        current_task.update_state(state='PROGRESS', meta={'step': 'creating_suggestions', 'progress': 80})
        await _update_job_progress(current_task.request.id, user_id, 'running', 80, 'creating_suggestions')
        
        try:
            suggestions = await parse_llm_response_to_suggestions(
                llm_response=llm_response,
                repo_id=repo_id,
                user_id=user_id,
                confidence=0.8,
                model_used="gpt-4"
            )
        except DiffParseError as e:
            logger.warning(f"Diff parsing failed: {e}")
            suggestions = []
        
        # Step 8: Send notifications
        current_task.update_state(state='PROGRESS', meta={'step': 'sending_notifications', 'progress': 95})
        await _update_job_progress(current_task.request.id, user_id, 'running', 95, 'sending_notifications')
        
        if suggestions:
            await _send_new_suggestions_notification(repo_id, len(suggestions))
        
        # Update job metadata with completion info
        completion_message = f"Query processed successfully. {len(suggestions)} suggestions created." if suggestions else "Query processed successfully. No suggestions were generated."
        await _update_job_completion(
            task_id=current_task.request.id,
            user_id=user_id,
            suggestions_created=len(suggestions),
            message=completion_message
        )
        
        # Step 9: Complete
        current_task.update_state(state='SUCCESS', meta={'step': 'completed', 'progress': 100})
        await _update_job_progress(current_task.request.id, user_id, 'completed', 100, 'completed')
        
        return {
            "status": "completed",
            "suggestions_created": len(suggestions),
            "files_modified": len(set(s['file_path'] for s in suggestions)),
            "chunks_analyzed": len(relevant_chunks),
            "query": query,
            "repo_id": repo_id,
            "suggestion_ids": [s['id'] for s in suggestions] if suggestions else []
        }
        
    except Exception as e:
        # Update job with failure status
        await _update_job_progress(current_task.request.id, user_id, 'failed', None, 'failed', str(e))
        _set_task_failure_state(current_task, e)
        
        # Update job metadata with failure info
        failure_message = f"Query failed: {str(e)}"
        await _update_job_completion(
            task_id=current_task.request.id,
            user_id=user_id,
            suggestions_created=0,
            message=failure_message
        )
        
        return {
            "status": "failed",
            "error": str(e),
            "query": query[:100] + "..." if len(query) > 100 else query,
            "repo_id": repo_id
        }
        
    finally:
        # Cleanup database connection
        if prisma.is_connected():
            await prisma.disconnect()


async def _send_new_suggestions_notification(repo_id: str, suggestion_count: int) -> None:
    """
    Send NOTIFY new_suggestions notification via Postgres for real-time updates
    """
    try:
        import psycopg2
        from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
        from app.settings import settings
        
        # Clean the database URL to remove pgbouncer and other connection pooling parameters
        database_url = settings.DATABASE_URL
        
        # Parse and clean the URL
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
        
        # Send notification with repo_id and suggestion count
        notification_payload = f"{repo_id},{suggestion_count}"
        cur.execute("NOTIFY new_suggestions, %s", (notification_payload,))
        conn.commit()
        
        cur.close()
        conn.close()
        
        logger.info(f"Sent new_suggestions notification for repo {repo_id} with {suggestion_count} suggestions")
        
    except Exception as e:
        logger.error(f"Failed to send new_suggestions notification: {e}")
        # Don't fail the main query task if notification fails


async def _update_job_completion(task_id: str, user_id: str, suggestions_created: int, message: str) -> None:
    """
    Update job metadata with completion information to trigger real-time notifications
    """
    try:
        # Ensure Prisma is connected
        if not prisma.is_connected():
            await prisma.connect()
        
        # Get existing job metadata
        existing_job = await prisma.job.find_unique(
            where={"task_id": task_id}
        )
        
        if existing_job and existing_job.metadata:
            # Parse existing metadata
            try:
                metadata = json.loads(existing_job.metadata) if isinstance(existing_job.metadata, str) else existing_job.metadata
            except (json.JSONDecodeError, TypeError):
                metadata = {}
        else:
            metadata = {}
        
        # Add completion info to metadata (preserve existing repo_id if it exists)
        metadata.update({
            "completion_message": message,
            "suggestions_created": suggestions_created,
            "completed_at": json.dumps({"timestamp": "now"}),  # This will trigger the UPDATE event
        })
        
        # Ensure repo_id is in metadata (it should already be there from job creation)
        if not metadata.get("repo_id"):
            logger.warning(f"repo_id not found in job metadata for task {task_id}")
        
        logger.debug(f"Job metadata for completion: {metadata}")
        
        await prisma.job.update(
            where={"task_id": task_id},
            data={
                "metadata": json.dumps(metadata)
            }
        )
        
        logger.info(f"Updated job completion metadata for task {task_id}: {suggestions_created} suggestions")
        
    except Exception as e:
        logger.error(f"Failed to update job completion metadata: {e}")
        # Don't fail the main query task if metadata update fails 