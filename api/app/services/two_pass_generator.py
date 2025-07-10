"""
Two-pass documentation generation service
"""

import json
import re
import logging
from typing import List, Dict, Any, Optional

from app.services.openai_client import openai_service
from app.services.operations_parser import parse_operations_json
from app.services.storage import storage_service
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
    a. Only include files with documentation extensions (.md, .mdx, .txt, .rst, .adoc, etc.)
    b. If there is no natural language in the file, it is not used for documentation.
    c. If there is 100 percent code in the file, it is not used for documentation.
    d. Skip asset files like images, SVG files, or other binary/media files.

PRIORITIZATION (prefer files in this order):
1. Files with high similarity scores (> 0.5)
2. Files that directly match the user's request topic
3. Files with relevant headings or section titles

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
            files_to_edit, cached_content = await self.pass_1_file_selection(query)
            
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
            detailed_operations = await self.pass_2_detailed_editing(query, files_to_edit, cached_content)
            
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
    
    async def pass_1_file_selection(self, query: str) -> tuple[List[str], Dict[str, str]]:
        """
        Pass 1: Identify which files need to be modified
        
        Args:
            query: User's change request
            
        Returns:
            Tuple of (list of file paths to edit, dict of file_path -> content)
        """
        try:
            logger.info("Pass 1: Starting file selection")
            
            # Get similar chunks using existing logic
            query_embedding = await self.openai_service.generate_embedding_with_retry(query)
            if not query_embedding:
                logger.error("Pass 1: Failed to generate query embedding")
                return [], {}
            
            relevant_chunks = await self.openai_service.search_similar_chunks(
                query_embedding=query_embedding,
                repo_id=self.repo_id,
                limit=30,  # Get more chunks for better file selection
                similarity_threshold=0.2  # Much lower threshold for testing
            )
            
            logger.info(f"Pass 1: Raw similarity search returned {len(relevant_chunks)} chunks")
            if relevant_chunks:
                for i, chunk in enumerate(relevant_chunks[:5]):  # Log first 5 chunks
                    logger.info(f"Pass 1: Chunk {i}: {chunk['file_path']} (similarity: {chunk.get('similarity', 0.0):.3f})")
            
            # Try fallback search if no good chunks found
            if not relevant_chunks:
                logger.info("Pass 1: No relevant chunks found, trying fallback search")
                relevant_chunks = await self.openai_service.search_chunks_fulltext(
                    query_text=query,
                    repo_id=self.repo_id,
                    limit=30
                )
            
            # Filter out chunks with very low similarity scores (less than 0.1)
            if relevant_chunks:
                filtered_chunks = [chunk for chunk in relevant_chunks if chunk.get('similarity', 0) >= 0.05]
                if filtered_chunks:
                    relevant_chunks = filtered_chunks
                    logger.info(f"Pass 1: Filtered to {len(relevant_chunks)} chunks with similarity >= 0.05")
                else:
                    logger.warning("Pass 1: All chunks have very low similarity scores")
            
            if not relevant_chunks:
                logger.warning("Pass 1: No relevant chunks found after fallback search")
                return [], {}
            
            # Build file summaries for selection (this fetches full content)
            file_summaries = await self._build_file_summaries(relevant_chunks)
            
            # Create file selection prompt
            selection_prompt = self._create_file_selection_prompt(query, file_summaries)
            
            # Ask LLM to select files
            selection_response = await self.openai_service.generate_completion_with_retry(
                messages=[
                    {"role": "system", "content": FILE_SELECTION_SYSTEM_PROMPT},
                    {"role": "user", "content": selection_prompt}
                ],
                model="gpt-4o-mini",
                temperature=0.1,
                max_tokens=1000
            )
            
            if not selection_response:
                logger.error("Pass 1: No response from file selection")
                return [], {}
            
            # Parse the response to get file list
            files_to_edit = self._parse_file_selection_response(selection_response)
            
            # Extract cached content for selected files
            cached_content = {}
            for file_path in files_to_edit:
                if file_path in file_summaries:
                    cached_content[file_path] = file_summaries[file_path]['full_content']
                    logger.info(f"Pass 1: Cached {len(cached_content[file_path])} chars for {file_path}")
            
            logger.info(f"Pass 1: Selected {len(files_to_edit)} files to edit")
            logger.info(f"Pass 1: Files: {files_to_edit}")
            
            return files_to_edit, cached_content
            
        except Exception as e:
            logger.error(f"Pass 1 file selection failed: {e}")
            return [], {}
    
    async def pass_2_detailed_editing(self, query: str, files_to_edit: List[str], cached_content: Dict[str, str]) -> List[Dict[str, Any]]:
        """
        Pass 2: Generate specific operations for each selected file
        
        Args:
            query: User's change request
            files_to_edit: List of file paths to edit
            cached_content: Dict of file_path -> full_content
            
        Returns:
            List of operation dictionaries
        """
        detailed_operations = []
        
        logger.info(f"Pass 2: Starting detailed editing for {len(files_to_edit)} files")
        
        for file_path in files_to_edit:
            try:
                logger.info(f"Pass 2: Generating operations for {file_path}")
                
                # Get full file context
                file_content = cached_content.get(file_path)
                
                if not file_content:
                    logger.warning(f"Pass 2: No content found for {file_path} in cached_content")
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
    
    async def _build_file_summaries(self, chunks: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Build file summaries with full content and similarity scores for selection"""
        file_summaries = {}
        
        for chunk in chunks:
            file_path = chunk['file_path']
            similarity = chunk.get('similarity', 0)
            
            if file_path not in file_summaries:
                file_summaries[file_path] = {
                    'file_path': file_path,
                    'similarity': similarity,  # Use the similarity from this chunk
                    'full_content': None  # Will be populated below
                }
            else:
                # If we already have this file, keep the higher similarity score
                file_summaries[file_path]['similarity'] = max(file_summaries[file_path]['similarity'], similarity)
        
        # Fetch full content for each file
        for file_path, summary in file_summaries.items():
            # Fetch full file content
            summary['full_content'] = await self._get_full_file_content(file_path)
        
        return file_summaries
    
    def _create_file_selection_prompt(self, query: str, file_summaries: Dict[str, Dict[str, Any]]) -> str:
        """Create the file selection prompt"""
        
        # Build file list with similarity scores and full content
        file_list = []
        file_count = 0
        for file_path, summary in file_summaries.items():
            file_count += 1
            full_content = summary['full_content']
            
            file_entry = f"{file_count}.\nFILE PATH: {file_path}\nCONTENT:\n**START OF CONTENT**\n{full_content}\n**END OF CONTENT**"
            file_list.append(file_entry)
        
        prompt = f"""
USER QUERY: "{query}"

AVAILABLE FILES:

{'\n\n'.join(file_list)}

Based on the query, ONLY identify files that NEED TO BE MODIFIED. Consider:
- Files directly related to the requested change
- Files that reference or depend on those CHANGES  
- Files with cross-references that need updating
- Files with examples that need updating
- File that CONTEXTUALLY fits best to edit based on user's query

IMPORTANT:
- ONLY return files that NEED TO BE MODIFIED.
- DO NOT return files that are not related to the user's query.
- DO NOT return files that are NOT used for documentation.
- Some .md files are NOT used for documentation. So EVALUATE the content of the file to determine if it is used for documentation.
- Documentation files SHOULD have natural language. If there is ABSOLUTELY NO natural language, it is not used for documentation.

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
        """Get the complete content of a file from storage"""
        
        try:
            async with get_db() as db:
                # Get file record to find storage key
                file_record = await db.file.find_first(
                    where={
                        "repo_id": self.repo_id,
                        "path": file_path
                    }
                )
                
                if not file_record or not file_record.storage_key:
                    logger.warning(f"No file record or storage key found for {file_path}")
                    return ""
                
                # The storage_key includes 'docs/' prefix, but bucket is 'docs'
                storage_path = file_record.storage_key[5:] if file_record.storage_key.startswith('docs/') else file_record.storage_key
                
                # Get content from storage
                content = await storage_service.get_file_content('docs', storage_path)
                if content and content.strip():
                    logger.info(f"Retrieved {len(content)} chars from storage for {file_path}")
                    return content
                else:
                    logger.warning(f"Storage content is empty for {file_path}")
                    return ""
                
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
            # Detect file format/type
            file_ext = file_path.split('.')[-1] if '.' in file_path else ''
            
            # Create focused prompt for this file
            file_prompt = f"""
TASK: Generate operations to implement the following change request for this specific file.

USER QUERY: "{query}"

FILE PATH: {file_path}
FILE TYPE: {file_ext}
FULL FILE CONTENT:
{file_content}

INSTRUCTIONS:
1. Focus ONLY on changes needed for THIS file
2. Use EXACTLY MATCHING anchor text that exists in the file content above
4. PRESERVE the existing document format, style, and structure:
   - Match the surrounding text's formatting exactly (indentation, bullets, code blocks)
   - For lists, maintain consistent numbering and bullet style
   - For code blocks, maintain the same language and syntax highlighting
   - For headings, maintain the same level and formatting
   - For technical terms, maintain the same capitalization and code formatting
5. When adding new content, analyze and MATCH the style of similar elements
6. Follow the file's established pattern for spacing, line breaks, and paragraph structure

IMPORTANT:
- IF YOU THINK THIS FILE ALREADY SATISFIES THE USER'S QUERY, THEN DO NOT MODIFY THE FILE AND RETURN AN EMPTY ARRAY.
- IF YOU THINK THIS FILE SHOULD NOT BE MODIFIED BASED ON THE USER'S QUERY, THEN DO NOT MODIFY THE FILE AND RETURN AN EMPTY ARRAY.

Generate operations JSON for this file:
"""
            # Use existing system prompt from operations parser
            from app.utils.prompts import SYSTEM_PROMPT
            
            # logger.info(f"Pass 2: File prompt: {file_prompt}")
            # logger.info(f"Pass 2: File content: {file_content}")
            # Generate operations
            operations_response = await self.openai_service.generate_completion_with_retry(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": file_prompt}
                ],
                model="gpt-4o",
                temperature=0.1,
                max_tokens=5000
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