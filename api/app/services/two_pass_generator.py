"""
Two-pass documentation generation service
"""

import json
import re
import logging
from typing import List, Dict, Any, Optional

from app.services.openai_client import openai_service
from app.services.operations_parser import parse_operations_json
from app.database import get_db

logger = logging.getLogger(__name__)

# System prompt for file selection (Pass 1)
FILE_SELECTION_SYSTEM_PROMPT = """
You are a technical documentation expert. Your task is to identify which files need to be modified to implement a user's request.

CRITICAL REQUIREMENTS:
1. Output ONLY a JSON array of file paths
2. NO explanations, no additional text
3. Consider cross-file dependencies and relationships
4. Include both direct and indirect files that need updates
5. Consider the context of the user's request and the files that are most relevant to the user's request
6. If a user SPECIFYING a FILE to edit, only include that file in the output.
7. If a user IS NOT SPECIFYING a FILE to edit, then INCLUDE ALL FILES that are relevant to the user's request.
8. Ignore files that are not used for documentation. Follow these GUIDELINES for determining if a file is used for documentation:
    a. MDX format MUST be there in files that ARE used for documentation.
    b. If there is no natural language in the file, it is not used for documentation.
    c. If there is 100 percent code in the file, it is not used for documentation.

Example outputs:
["docs/api.md", "docs/quickstart.md"]
["context.md", "mcp.md", "examples/context_example.md"]
["readme.md"]

Your response must be a JSON array of strings (file paths).
"""

class TwoPassDocumentationGenerator:
    """
    Service for generating documentation suggestions using a two-pass approach:
    Pass 1: Identify which files need to be modified
    Pass 2: Generate specific operations for each file
    """
    
    def __init__(self, repo_id: str):
        self.repo_id = repo_id
        self.openai_service = openai_service
    
    async def generate_suggestions(self, query: str, user_id: str) -> Dict[str, Any]:
        """
        Generate documentation suggestions using two-pass approach
        
        Args:
            query: User's change request
            user_id: ID of the user making the request
            
        Returns:
            Dict with generation results
        """
        try:
            # Pass 1: File Selection
            files_to_edit = await self.pass_1_file_selection(query)
            
            if not files_to_edit:
                logger.warning("Pass 1: No files selected for editing")
                return {
                    'status': 'completed',
                    'files_to_edit': [],
                    'operations': [],
                    'suggestions_created': 0,
                    'message': 'No files identified for modification'
                }
            
            # Pass 2: Detailed Editing
            detailed_operations = await self.pass_2_detailed_editing(query, files_to_edit)
            
            # Create suggestions from operations
            suggestions_created = len(detailed_operations)
            
            return {
                'status': 'completed',
                'files_to_edit': files_to_edit,
                'operations': detailed_operations,
                'suggestions_created': suggestions_created,
                'files_modified': len(files_to_edit)
            }
            
        except Exception as e:
            logger.error(f"Two-pass generation failed: {e}")
            return {
                'status': 'failed',
                'error': str(e),
                'files_to_edit': [],
                'operations': [],
                'suggestions_created': 0
            }
    
    async def pass_1_file_selection(self, query: str) -> List[str]:
        """
        Pass 1: Identify which files need to be modified
        
        Args:
            query: User's change request
            
        Returns:
            List of file paths to edit
        """
        try:
            logger.info("Pass 1: Starting file selection")
            
            # Get similar chunks using existing logic
            query_embedding = await self.openai_service.generate_embedding_with_retry(query)
            if not query_embedding:
                logger.error("Pass 1: Failed to generate query embedding")
                return []
            
            relevant_chunks = await self.openai_service.search_similar_chunks(
                query_embedding=query_embedding,
                repo_id=self.repo_id,
                limit=20,  # Get more chunks for better file selection
                similarity_threshold=0.3  # Lower threshold for broader context
            )
            
            if not relevant_chunks:
                # Try fallback search
                relevant_chunks = await self.openai_service.search_chunks_fulltext(
                    query_text=query,
                    repo_id=self.repo_id,
                    limit=20
                )
            
            if not relevant_chunks:
                logger.warning("Pass 1: No relevant chunks found")
                return []
            
            # Build file summaries for selection
            file_summaries = self._build_file_summaries(relevant_chunks)
            
            # Create file selection prompt
            selection_prompt = self._create_file_selection_prompt(query, file_summaries)
            
            # Ask LLM to select files
            selection_response = await self.openai_service.generate_completion_with_retry(
                messages=[
                    {"role": "system", "content": FILE_SELECTION_SYSTEM_PROMPT},
                    {"role": "user", "content": selection_prompt}
                ],
                model="gpt-4o-mini",
                temperature=0.1
            )
            
            if not selection_response:
                logger.error("Pass 1: No response from file selection")
                return []
            
            # Parse the response to get file list
            files_to_edit = self._parse_file_selection_response(selection_response)
            
            logger.info(f"Pass 1: Selected {len(files_to_edit)} files to edit")
            logger.info(f"Pass 1: Files: {files_to_edit}")
            
            return files_to_edit
            
        except Exception as e:
            logger.error(f"Pass 1 file selection failed: {e}")
            return []
    
    async def pass_2_detailed_editing(self, query: str, files_to_edit: List[str]) -> List[Dict[str, Any]]:
        """
        Pass 2: Generate specific operations for each selected file
        
        Args:
            query: User's change request
            files_to_edit: List of file paths to edit
            
        Returns:
            List of operation dictionaries
        """
        detailed_operations = []
        
        logger.info(f"Pass 2: Starting detailed editing for {len(files_to_edit)} files")
        
        for file_path in files_to_edit:
            try:
                logger.info(f"Pass 2: Generating operations for {file_path}")
                
                # Get full file context
                file_content = await self._get_full_file_content(file_path)
                
                if not file_content:
                    logger.warning(f"Pass 2: No content found for {file_path}")
                    continue
                
                # Generate operations for this specific file
                file_operations = await self._generate_operations_for_file(
                    query, file_path, file_content
                )
                
                if file_operations:
                    detailed_operations.extend(file_operations)
                    logger.info(f"Pass 2: Generated {len(file_operations)} operations for {file_path}")
                else:
                    logger.warning(f"Pass 2: No operations generated for {file_path}")
                    
            except Exception as e:
                logger.error(f"Pass 2: Failed to generate operations for {file_path}: {e}")
                continue
        
        logger.info(f"Pass 2: Generated total of {len(detailed_operations)} operations")
        return detailed_operations
    
    def _build_file_summaries(self, chunks: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Build concise summaries of each file for selection"""
        file_summaries = {}
        
        for chunk in chunks:
            file_path = chunk['file_path']
            if file_path not in file_summaries:
                file_summaries[file_path] = {
                    'file_path': file_path,
                    'similarity_scores': [],
                    'content_snippets': [],
                    'topics': set()
                }
            
            file_summaries[file_path]['similarity_scores'].append(chunk.get('similarity', 0))
            
            # Extract topics from content
            content = chunk['content']
            # Get headings
            headings = re.findall(r'^#+\s+(.+)$', content, re.MULTILINE)
            file_summaries[file_path]['topics'].update(headings)
            
            # Keep top content snippets
            if len(file_summaries[file_path]['content_snippets']) < 2:
                snippet = content[:150] + "..." if len(content) > 150 else content
                file_summaries[file_path]['content_snippets'].append(snippet)
        
        # Calculate average similarity and format topics
        for file_path, summary in file_summaries.items():
            if summary['similarity_scores']:
                summary['avg_similarity'] = sum(summary['similarity_scores']) / len(summary['similarity_scores'])
            else:
                summary['avg_similarity'] = 0.0
            summary['topics'] = list(summary['topics'])
        
        return file_summaries
    
    def _create_file_selection_prompt(self, query: str, file_summaries: Dict[str, Dict[str, Any]]) -> str:
        """Create the file selection prompt"""
        
        # Build concise file list
        file_list = []
        for file_path, summary in file_summaries.items():
            topics_str = ", ".join(summary['topics'][:3]) if summary['topics'] else "No topics"
            file_entry = f"- {file_path} (similarity: {summary['avg_similarity']:.2f}, topics: {topics_str})"
            file_list.append(file_entry)
        
        prompt = f"""
USER QUERY: "{query}"

AVAILABLE FILES:
{chr(10).join(file_list)}

Based on the query, identify ALL files that need to be modified. Consider:
- Files directly related to the requested change
- Files that reference or depend on those changes  
- Files with cross-references that need updating
- Files with examples that need updating
- File that contextually fits best to edit based on user's query

Return JSON array of file paths:
"""
        
        return prompt
    
    def _parse_file_selection_response(self, response: str) -> List[str]:
        """Parse the LLM response to extract file list"""
        try:
            # Clean the response
            response = response.strip()
            
            # Try to parse as JSON
            files = json.loads(response)
            
            # Validate it's a list of strings
            if isinstance(files, list) and all(isinstance(f, str) for f in files):
                return files
            else:
                logger.error(f"Invalid file selection response format: {response}")
                return []
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse file selection response: {e}")
            logger.error(f"Response was: {response}")
            return []
    
    async def _get_full_file_content(self, file_path: str) -> str:
        """Get the complete content of a file"""
        
        try:
            # Get all chunks for this file ordered by chunk_order
            query = """
            SELECT 
                c.content,
                fc.chunk_order
            FROM public.chunk c
            JOIN public.file_chunk fc ON c.hash = fc.chunk_hash
            JOIN public.file f ON fc.file_id = f.id
            WHERE f.repo_id = $1::uuid
            AND f.path = $2
            ORDER BY fc.chunk_order
            """
            
            async with get_db() as db:
                results = await db.query_raw(query, self.repo_id, file_path)
                
                if not results:
                    return ""
                
                # Combine all chunks in order
                content_parts = [row['content'] for row in results]
                full_content = '\n'.join(content_parts)
                
                return full_content
                
        except Exception as e:
            logger.error(f"Failed to get file content for {file_path}: {e}")
            return ""
    
    async def _generate_operations_for_file(
        self, 
        query: str, 
        file_path: str, 
        file_content: str
    ) -> List[Dict[str, Any]]:
        """Generate operations for a single file"""
        
        try:
            # Create focused prompt for this file
            file_prompt = f"""
TASK: Generate operations to implement the following change request for this specific file.

USER QUERY: "{query}"
FILE: {file_path}

FULL FILE CONTENT:
{file_content}

INSTRUCTIONS:
1. Focus ONLY on changes needed for THIS file
2. Use precise anchor text that exists in the file content above
3. Make minimal, targeted changes that directly address the query
4. Suggest edits that are CONSISTENT with the overall documentation style, formatting, and structure.

Generate operations JSON for this file:
"""
            # Use existing system prompt from operations parser
            from app.utils.prompts import SYSTEM_PROMPT
            
            # Generate operations
            operations_response = await self.openai_service.generate_completion_with_retry(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": file_prompt}
                ],
                model="gpt-4o-mini",
                temperature=0.1,
                max_tokens=3000
            )
            
            if not operations_response:
                logger.error(f"No response for operations generation for {file_path}")
                return []
            
            # Parse operations using existing parser
            operations = parse_operations_json(operations_response)
            return operations
            
        except Exception as e:
            logger.error(f"Failed to generate operations for {file_path}: {e}")
            return [] 