"""
Documentation query processing task

This module handles processing of natural language documentation change requests
using a two-pass approach:
1. Identify files that need to be modified
2. Generate specific operations for each file
"""

import asyncio
import traceback
import logging
from typing import Dict, Any

from .celery_app import celery_app
from app.database import prisma
from app.services.operations_parser import parse_llm_response_to_suggestions, OperationParseError
from app.services.two_pass_generator import TwoPassDocumentationGenerator
from app.services.job_service import JobService

# Set up logging
logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="app.tasks.process_query")
def process_query(self, query: str, user_id: str, repo_id: str) -> Dict[str, Any]:
    """
    Process a natural language documentation change request using two-pass approach.
    
    This task uses a two-pass approach:
    - Pass 1: Identify files that need to be modified
    - Pass 2: Generate specific operations for each file
    
    Args:
        query: Natural language change request
        user_id: ID of the user making the request
        repo_id: ID of the repository to modify
        
    Returns:
        Dict with processing results
    """
    try:
        logger.info("Processing query using two-pass approach")
        result = asyncio.run(_run_query_two_pass(self, query, user_id, repo_id))
        return result
    except Exception as e:
        logger.error(f"Query processing error: {e}")
        logger.error(traceback.format_exc())
        
        return {
            "status": "failed",
            "error": str(e),
            "query": query[:100] + "..." if len(query) > 100 else query,
            "repo_id": repo_id
        }


async def _run_query_two_pass(
    current_task,
    query: str,
    user_id: str,
    repo_id: str
) -> Dict[str, Any]:
    """Two-pass query processing implementation"""
    try:
        # Connect to database
        await prisma.connect()
        
        # Initialize query processor
        query_processor = QueryProcessor(current_task, user_id, repo_id)
        
        # Process the query
        result = await query_processor.process(query)
        
        return result
        
    except Exception as e:
        # Update job with failure status
        await JobService.update_job_progress(
            current_task.request.id, user_id, 'failed', None, 'failed', str(e)
        )

        # Update job metadata with failure info
        failure_message = f"Two-pass query failed: {str(e)}"
        await JobService.update_job_completion(
            task_id=current_task.request.id,
            user_id=user_id,
            suggestions_created=0,
            message=failure_message
        )
        
        return {
            "status": "failed",
            "error": str(e),
            "approach": "two_pass",
            "query": query[:100] + "..." if len(query) > 100 else query,
            "repo_id": repo_id
        }
        
    finally:
        # Cleanup database connection
        if prisma.is_connected():
            await prisma.disconnect()


class QueryProcessor:
    """Handles the query processing workflow"""
    
    def __init__(self, current_task, user_id: str, repo_id: str):
        self.current_task = current_task
        self.user_id = user_id
        self.repo_id = repo_id
        self.task_id = current_task.request.id
        
    async def process(self, query: str) -> Dict[str, Any]:
        """Process the query through the two-pass approach"""
        
        # Step 1: Starting
        await self._update_progress('starting', 0)
        
        # Step 2: Initialize two-pass generator
        await self._update_progress('initializing_two_pass', 10)
        two_pass_generator = TwoPassDocumentationGenerator(self.repo_id)
        
        # Step 3: Two-pass generation
        await self._update_progress('two_pass_generation', 20)
        generation_result = await two_pass_generator.generate_suggestions(query, self.user_id)
        
        if generation_result['status'] == 'failed':
            raise Exception(generation_result.get('error', 'Two-pass generation failed'))
        
        # Handle case with no suggestions
        if generation_result['suggestions_created'] == 0:
            return await self._handle_no_suggestions(query, generation_result)
        
        # Step 4: Create suggestions from operations
        await self._update_progress('creating_suggestions', 60)
        suggestions = await self._create_suggestions_from_operations(
            generation_result.get('operations', [])
        )
        
        # Step 5: Verify suggestions
        await self._update_progress('verifying_suggestions', 80)
        
        # Update job metadata with completion info
        completion_message = self._get_completion_message(suggestions)
        await JobService.update_job_completion(
            task_id=self.task_id,
            user_id=self.user_id,
            suggestions_created=len(suggestions),
            message=completion_message
        )
        
        # Step 6: Complete
        await self._update_progress('completed', 100, 'SUCCESS')
        
        return {
            "status": "completed",
            "suggestions_created": len(suggestions),
            "files_modified": len(generation_result.get('files_to_edit', [])),
            "files_to_edit": generation_result.get('files_to_edit', []),
            "approach": "two_pass",
            "query": query,
            "repo_id": self.repo_id,
            "suggestion_ids": [s['id'] for s in suggestions] if suggestions else []
        }
    
    async def _update_progress(self, step: str, progress: int, state: str = 'PROGRESS'):
        """Update task progress"""
        self.current_task.update_state(state=state, meta={'step': step, 'progress': progress})
        
        status = 'completed' if state == 'SUCCESS' else 'running'
        await JobService.update_job_progress(
            self.task_id, self.user_id, status, progress, step
        )
    
    async def _handle_no_suggestions(self, query: str, generation_result: Dict[str, Any]) -> Dict[str, Any]:
        """Handle the case where no suggestions were generated"""
        await self._update_progress('completed', 100, 'SUCCESS')
        
        message = generation_result.get('message', 'No suggestions generated')
        await JobService.update_job_completion(
            task_id=self.task_id,
            user_id=self.user_id,
            suggestions_created=0,
            message=message
        )
        
        return {
            "status": "completed",
            "message": message,
            "suggestions_created": 0,
            "files_to_edit": generation_result.get('files_to_edit', []),
            "query": query,
            "repo_id": self.repo_id
        }
    
    async def _create_suggestions_from_operations(self, operations: list) -> list:
        """Create suggestion records from operations"""
        suggestions = []
        
        if operations:
            try:
                suggestions = await parse_llm_response_to_suggestions(
                    operations_json=operations,
                    repo_id=self.repo_id,
                    user_id=self.user_id,
                    confidence=0.8,
                    model_used="gpt-4o"  # Two-pass uses gpt-4o for better results
                )
            except OperationParseError as e:
                logger.warning(f"Operations parsing failed in two-pass approach: {e}")
                suggestions = []
        
        return suggestions
    
    def _get_completion_message(self, suggestions: list) -> str:
        """Generate completion message based on results"""
        if suggestions:
            return f"Two-pass query processed successfully. {len(suggestions)} suggestions created."
        else:
            return "Two-pass query processed successfully. No suggestions were generated."