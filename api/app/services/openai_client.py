"""
OpenAI service for embedding and AI operations
"""

import asyncio
from typing import List, Optional, Dict, Any
from openai import AsyncOpenAI
import tiktoken
import re
import logging

from app.utils.prompts import SYSTEM_PROMPT, generate_user_prompt
from app.settings import settings

logger = logging.getLogger(__name__)

class OpenAIService:
    """
    OpenAI service for handling embeddings and AI model interactions
    """
    
    def __init__(self):
        self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self._embedding_model = "text-embedding-3-small"
        self._embedding_dimensions = 1536
        self._encoding = tiktoken.get_encoding("cl100k_base")
        self._chat_model = "gpt-4"
    
    @property
    def client(self) -> AsyncOpenAI:
        """Get the OpenAI client instance"""
        return self._client
    
    @property
    def embedding_model(self) -> str:
        """Get the default embedding model"""
        return self._embedding_model
    
    @property
    def embedding_dimensions(self) -> int:
        """Get the embedding dimensions for the default model"""
        return self._embedding_dimensions
    
    @property
    def chat_model(self) -> str:
        """Get the default chat model"""
        return self._chat_model
    
    def count_tokens(self, text: str) -> int:
        """
        Count the number of tokens in a text string
        
        Args:
            text: Input text to count tokens for
            
        Returns:
            Number of tokens
        """
        return len(self._encoding.encode(text))
    
    def split_text_by_tokens(self, text: str, max_tokens: int = 1000, overlap_tokens: int = 100) -> List[str]:
        """
        Split text into chunks based on token count with overlap
        
        Args:
            text: Input text to split
            max_tokens: Maximum tokens per chunk
            overlap_tokens: Number of overlapping tokens between chunks
            
        Returns:
            List of text chunks
        """
        tokens = self._encoding.encode(text)
        chunks = []
        
        start = 0
        while start < len(tokens):
            end = min(start + max_tokens, len(tokens))
            
            # Try to find a good breaking point (sentence boundary)
            if end < len(tokens):
                chunk_tokens = tokens[start:end]
                chunk_text = self._encoding.decode(chunk_tokens)
                
                # Look for sentence boundaries in the last 20% of the chunk
                last_part = chunk_text[-len(chunk_text)//5:]
                sentence_ends = ['.', '!', '?', '\n\n']
                
                best_break = -1
                for sent_end in sentence_ends:
                    pos = last_part.rfind(sent_end)
                    if pos > best_break:
                        best_break = pos
                
                if best_break > 0:
                    # Adjust end to the sentence boundary
                    adjusted_end = start + len(self._encoding.encode(chunk_text[:-len(last_part) + best_break + 1]))
                    end = min(adjusted_end, len(tokens))
            
            chunk_tokens = tokens[start:end]
            chunk_text = self._encoding.decode(chunk_tokens)
            chunks.append(chunk_text.strip())
            
            # Move start position with overlap
            start = max(start + max_tokens - overlap_tokens, end)
        
        return chunks
    
    async def generate_embedding(self, text: str, model: Optional[str] = None) -> Optional[List[float]]:
        """
        Generate embedding for a single text
        
        Args:
            text: Input text to embed
            model: OpenAI model to use (defaults to text-embedding-3-small)
            
        Returns:
            Embedding vector or None if failed
        """
        if not text.strip():
            return None
        
        try:
            response = await self._client.embeddings.create(
                input=text,
                model=model or self._embedding_model
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"Failed to generate embedding for text: {e}")
            return None
    
    async def generate_embeddings_batch(self, texts: List[str], model: Optional[str] = None, batch_size: int = 100) -> List[Optional[List[float]]]:
        """
        Generate embeddings for multiple texts in batches
        
        Args:
            texts: List of input texts to embed
            model: OpenAI model to use (defaults to text-embedding-3-small)
            batch_size: Number of texts to process per API call
            
        Returns:
            List of embedding vectors (None for failed embeddings)
        """
        if not texts:
            return []
        
        results = []
        
        # Process in batches to avoid API limits
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            
            try:
                response = await self._client.embeddings.create(
                    input=batch,
                    model=model or self._embedding_model
                )
                
                # Extract embeddings from response
                batch_embeddings = [item.embedding for item in response.data]
                results.extend(batch_embeddings)
                
            except Exception as e:
                print(f"Failed to generate embeddings for batch {i//batch_size + 1}: {e}")
                # Add None for each failed embedding in the batch
                results.extend([None] * len(batch))
            
            # Add a small delay between batches to respect rate limits
            if i + batch_size < len(texts):
                await asyncio.sleep(0.1)
        
        return results
    
    async def generate_embedding_with_retry(self, text: str, max_retries: int = 3, model: Optional[str] = None) -> Optional[List[float]]:
        """
        Generate embedding with retry logic for better reliability
        
        Args:
            text: Input text to embed
            max_retries: Maximum number of retry attempts
            model: OpenAI model to use (defaults to text-embedding-3-small)
            
        Returns:
            Embedding vector or None if all attempts failed
        """
        for attempt in range(max_retries + 1):
            try:
                embedding = await self.generate_embedding(text, model)
                if embedding is not None:
                    return embedding
            except Exception as e:
                if attempt == max_retries:
                    print(f"Failed to generate embedding after {max_retries + 1} attempts: {e}")
                else:
                    print(f"Embedding attempt {attempt + 1} failed, retrying: {e}")
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
        
        return None
    
    def get_fallback_embedding(self) -> List[float]:
        """
        Get a zero vector as fallback for failed embeddings
        
        Returns:
            Zero vector with default embedding dimensions
        """
        return [0.0] * self._embedding_dimensions
    
    async def embed_document_chunks(self, chunks: List[str]) -> List[Dict[str, Any]]:
        """
        Process document chunks and generate embeddings
        
        Args:
            chunks: List of text chunks to embed
            
        Returns:
            List of chunk data with embeddings and metadata
        """
        results = []
        
        # Generate embeddings for all chunks
        embeddings = await self.generate_embeddings_batch(chunks)
        
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            # Use fallback embedding if generation failed
            if embedding is None:
                print(f"Using fallback embedding for chunk {i}")
                embedding = self.get_fallback_embedding()
            
            results.append({
                'content': chunk,
                'embedding': embedding,
                'token_count': self.count_tokens(chunk),
                'chunk_index': i
            })
        
        return results
    
    async def health_check(self) -> bool:
        """
        Check if OpenAI API is accessible
        
        Returns:
            True if API is accessible, False otherwise
        """
        try:
            # Try to generate a simple embedding
            test_embedding = await self.generate_embedding("test")
            return test_embedding is not None
        except Exception as e:
            print(f"OpenAI health check failed: {e}")
            return False
    
    async def generate_documentation_operations(
        self, 
        user_query: str, 
        relevant_chunks: List[Dict[str, Any]], 
        file_paths: List[str],
        model: Optional[str] = None
    ) -> Optional[str]:
        """
        Generate operations JSON for documentation changes based on user query and relevant context
        
        Args:
            user_query: The user's natural language change request
            relevant_chunks: List of relevant chunks with content and file context
            file_paths: List of file paths being modified
            model: OpenAI model to use (defaults to gpt-4)
            
        Returns:
            Raw LLM response with operations JSON or None if failed
        """
        try:
            token_budget = 50_500
            context_parts = []
            current_tokens = 0

            for chunk in relevant_chunks:
                # Include line numbers if available
                chunk_text = (
                    f"File Path: {chunk.get('file_path', '')}\n" +
                    f"File Similarity: {chunk.get('similarity', 0.0)}\n" +
                    f"File Content:\n**START OF FILE**\n{chunk.get('content', '')}\n**END OF FILE**\n"
                )
                chunk_tokens = self.count_tokens(chunk_text)

                # Stop once adding the next chunk would overshoot the budget
                if current_tokens + chunk_tokens > token_budget:
                    logger.warning(f"Token budget exceeded, truncating context at {current_tokens} tokens")
                    break

                context_parts.append(chunk_text)
                current_tokens += chunk_tokens
            
            context = "\n".join(context_parts)

            system_prompt: str = SYSTEM_PROMPT
            user_prompt: str = generate_user_prompt(user_query, context, file_paths)
            
            # Make the API call (lower max_tokens so the total stays < 8k)
            response = await self._client.chat.completions.create(
                model=model or self._chat_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,  # Low temperature for consistent output
                max_tokens=5000   # Plenty for several patches, keeps us safe
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"Failed to generate documentation patches: {e}")
            return None
    
    async def generate_completion_with_retry(
        self, 
        messages: List[Dict[str, str]], 
        max_retries: int = 3, 
        model: Optional[str] = None,
        **kwargs
    ) -> Optional[str]:
        """
        Generate chat completion with retry logic for better reliability
        
        Args:
            messages: List of message objects for the conversation
            max_retries: Maximum number of retry attempts
            model: OpenAI model to use (defaults to gpt-4)
            **kwargs: Additional parameters for the chat completion
            
        Returns:
            Response content or None if all attempts failed
        """
        for attempt in range(max_retries + 1):
            try:
                response = await self._client.chat.completions.create(
                    model=model or self._chat_model,
                    messages=messages,
                    **kwargs
                )
                return response.choices[0].message.content
                
            except Exception as e:
                if attempt == max_retries:
                    print(f"Failed to generate completion after {max_retries + 1} attempts: {e}")
                else:
                    print(f"Completion attempt {attempt + 1} failed, retrying: {e}")
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
        
        return None

    async def search_similar_chunks(
        self, 
        query_embedding: List[float], 
        repo_id: str, 
        limit: int = 10,
        similarity_threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        Search for similar chunks using pgvector cosine similarity
        
        Args:
            query_embedding: The embedding vector to search with
            repo_id: Repository ID to limit search scope
            limit: Maximum number of results to return
            similarity_threshold: Minimum similarity score (0-1)
            
        Returns:
            List of similar chunks with content, similarity scores, and file context
        """
        try:
            from app.database import get_db
            
            # Convert embedding to string format for pgvector
            embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
            
            # Query using raw SQL for pgvector similarity search
            query = """
                SELECT 
                    c.hash,
                    c.content,
                    c.token_count,
                    f.id as file_id,
                    f.path as file_path,
                    f.storage_key,
                    fc.chunk_order,
                    fc.start_line,
                    fc.end_line,
                    1 - (c.embedding <=> $1::vector) as similarity
                FROM public.chunk c
                JOIN public.file_chunk fc ON c.hash = fc.chunk_hash
                JOIN public.file f ON fc.file_id = f.id
                WHERE f.repo_id = $2::uuid
                AND 1 - (c.embedding <=> $1::vector) >= $3
                ORDER BY c.embedding <=> $1::vector
                LIMIT $4;
            """
            
            async with get_db() as db:
                results = await db.query_raw(
                    query,
                    embedding_str,  # $1
                    repo_id,        # $2
                    similarity_threshold,  # $3
                    limit           # $4
                )
                
                # Convert results to list of dictionaries
                similar_chunks = []
                for row in results:
                    similar_chunks.append({
                        'hash': row.get('hash'),
                        'content': row.get('content'),
                        'token_count': row.get('token_count'),
                        'file_id': row.get('file_id'),
                        'file_path': row.get('file_path'),
                        'storage_key': row.get('storage_key'),
                        'chunk_order': row.get('chunk_order'),
                        'start_line': row.get('start_line'),
                        'end_line': row.get('end_line'),
                        'similarity': float(row.get('similarity', 0.0))
                    })
                
                return similar_chunks
                
        except Exception as e:
            print(f"Failed to search similar chunks: {e}")
            return []

    async def search_chunks_fulltext(self, query_text: str, repo_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Fallback full-text search over chunk content when vector similarity search returns no rows.

        Args:
            query_text: The raw natural-language query provided by the user.
            repo_id: Repository scope (UUID string).
            limit: Maximum number of chunks to return.

        Returns:
            List of chunk dictionaries in the same shape as `search_similar_chunks` (similarity is set to 0.0).
        """
        try:
            from app.database import get_db

            sql = """
                WITH ts AS (
                    SELECT websearch_to_tsquery('english', $1) AS q
                )
                SELECT 
                    c.hash,
                    c.content,
                    c.token_count,
                    f.id   AS file_id,
                    f.path AS file_path,
                    f.storage_key,
                    fc.chunk_order,
                    fc.start_line,
                    fc.end_line,
                    ts_rank(to_tsvector('english', c.content), (SELECT q FROM ts)) AS similarity
                FROM public.chunk c
                JOIN public.file_chunk fc ON c.hash = fc.chunk_hash
                JOIN public.file f        ON fc.file_id = f.id,
                ts
                WHERE f.repo_id = $2::uuid
                  AND to_tsvector('english', c.content) @@ (SELECT q FROM ts)
                ORDER BY similarity DESC
                LIMIT $3;
            """

            async with get_db() as db:
                rows = await db.query_raw(sql, query_text, repo_id, limit)

                # If no rows (very strict tsquery), fall back to simple ILIKE keyword match on individual words
                if not rows:
                    def _escape_like(term: str) -> str:
                        # Escape Postgres LIKE meta-chars ('%' and '_')
                        return re.sub(r'([%_])', r'\\\1', term)

                    keywords  = [w.strip('()').lower()              # strip () and case-fold
                                 for w in query_text.split() if len(w) > 2][:5]

                    patterns  = [f"%{_escape_like(k)}%" for k in keywords]

                    # Build dynamic ILIKE clause placeholders ($3, $4, ...)
                    placeholders = [
                        f"c.content ILIKE ${i}::text"
                        for i in range(3, 3 + len(patterns))
                    ]
                    ilike_clause = " OR ".join(placeholders)

                    ilike_sql = f"""
                        SELECT 
                            c.hash,
                            c.content,
                            c.token_count,
                            f.id   AS file_id,
                            f.path AS file_path,
                            f.storage_key,
                            fc.chunk_order,
                            fc.start_line,
                            fc.end_line,
                            0.0 AS similarity
                        FROM public.chunk c
                        JOIN public.file_chunk fc ON c.hash = fc.chunk_hash
                        JOIN public.file f        ON fc.file_id = f.id
                        WHERE f.repo_id = $2::uuid
                          AND ({ilike_clause})
                        LIMIT $1;
                    """
                    params = [limit, repo_id] + patterns
                    rows = await db.query_raw(ilike_sql, *params)

                chunks: List[Dict[str, Any]] = []
                for row in rows:
                    chunks.append({
                        'hash': row.get('hash'),
                        'content': row.get('content'),
                        'token_count': row.get('token_count'),
                        'file_id': row.get('file_id'),
                        'file_path': row.get('file_path'),
                        'storage_key': row.get('storage_key'),
                        'chunk_order': row.get('chunk_order'),
                        'start_line': row.get('start_line'),
                        'end_line': row.get('end_line'),
                        'similarity': float(row.get('similarity', 0.0))
                    })
                return chunks
        except Exception as e:
            print(f"Fallback full-text search failed: {e}")
            return []

# Global instance to be used throughout the application
openai_service = OpenAIService() 