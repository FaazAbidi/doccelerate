"""
Chunk service for handling text chunking and embedding generation
"""

import hashlib
import logging
from typing import List, Dict, Any, Tuple

from app.services.openai_client import openai_service
from app.database import prisma

logger = logging.getLogger(__name__)


class ChunkService:
    """Service for processing text chunks and generating embeddings"""
    
    @staticmethod
    async def process_chunks_for_files(files_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Split files into semantic chunks and generate embeddings
        
        Args:
            files_data: List of file data dictionaries
            
        Returns:
            List of chunk data dictionaries
        """
        chunks_data = []
        
        logger.info(f"Processing chunks for {len(files_data)} files")
        
        for file_data in files_data:
            file_chunks = await ChunkService._process_chunks_for_single_file(file_data)
            chunks_data.extend(file_chunks)
        
        logger.info(f"Generated {len(chunks_data)} total chunks")
        return chunks_data
    
    @staticmethod
    async def _process_chunks_for_single_file(file_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Process chunks for a single file"""
        content = file_data['content']
        file_path = file_data['path']
        
        logger.info(f"Processing chunks for file: {file_path}")
        
        # Split into chunks using OpenAI service
        chunks = openai_service.split_text_by_tokens(content)
        
        # Calculate line positions for each chunk
        chunk_line_positions = ChunkService._calculate_chunk_line_positions(content, chunks)
        
        # Process chunks with calculated line positions
        file_chunks = []
        for i, chunk_content in enumerate(chunks):
            chunk_data = await ChunkService._process_single_chunk(
                chunk_content, i, chunk_line_positions[i], file_data
            )
            if chunk_data:
                file_chunks.append(chunk_data)
        
        logger.info(f"Generated {len(file_chunks)} chunks for file: {file_path}")
        return file_chunks
    
    @staticmethod
    async def _process_single_chunk(
        chunk_content: str, 
        chunk_order: int, 
        line_positions: Tuple[int, int], 
        file_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Process a single chunk and generate embedding if needed"""
        # Calculate chunk hash
        chunk_hash = hashlib.sha256(chunk_content.encode('utf-8')).hexdigest()
        
        # Get line positions
        start_line, end_line = line_positions
        
        # Check if chunk already exists using raw SQL
        existing_chunk_result = await prisma.query_raw(
            "SELECT hash, token_count FROM public.chunk WHERE hash = $1 LIMIT 1",
            chunk_hash
        )
        existing_chunk = existing_chunk_result[0] if existing_chunk_result else None
        
        if not existing_chunk:
            # Generate embedding for new chunk
            embedding = await ChunkService._generate_embedding_for_chunk(chunk_content)
            if not embedding:
                logger.warning(f"Failed to generate embedding for chunk {chunk_order} in {file_data['path']}")
                return None
            
            # Calculate token count
            token_count = openai_service.count_tokens(chunk_content)
            
            # Store chunk in database
            await ChunkService._store_new_chunk(chunk_hash, chunk_content, embedding, token_count)
            
            logger.debug(f"Created new chunk with hash {chunk_hash[:8]}...")
        else:
            logger.debug(f"Using existing chunk with hash {chunk_hash[:8]}...")
        
        return {
            'hash': chunk_hash,
            'content': chunk_content,
            'start_line': start_line,
            'end_line': end_line,
            'chunk_order': chunk_order,
            'file_path': file_data['path']
        }
    
    @staticmethod
    def _calculate_chunk_line_positions(content: str, chunks: List[str]) -> List[Tuple[int, int]]:
        """Calculate line positions for each chunk"""
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
        
        return chunk_line_positions
    
    @staticmethod
    async def _generate_embedding_for_chunk(chunk_content: str) -> List[float]:
        """Generate embedding for a chunk"""
        try:
            embedding = await openai_service.generate_embedding_with_retry(chunk_content)
            return embedding
        except Exception as e:
            logger.error(f"Failed to generate embedding for chunk: {e}")
            return None
    
    @staticmethod
    async def _store_new_chunk(
        chunk_hash: str, 
        chunk_content: str, 
        embedding: List[float], 
        token_count: int
    ) -> None:
        """Store a new chunk in the database using raw SQL for vector compatibility"""
        try:
            # Use raw SQL to insert chunks with vector embeddings
            # Note: Using raw SQL instead of Prisma mutations due to vector field limitations
            await prisma.execute_raw(
                """
                INSERT INTO public.chunk (hash, content, embedding, token_count, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (hash) DO NOTHING
                """,
                chunk_hash,
                chunk_content,
                embedding,
                token_count
            )
        except Exception as e:
            logger.error(f"Failed to store chunk {chunk_hash[:8]}: {e}")
            raise
