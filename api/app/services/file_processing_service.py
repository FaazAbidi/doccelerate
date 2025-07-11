"""
File processing service for handling file operations during indexing
"""

import os
import hashlib
import logging
from typing import List, Dict, Any, Set
from pathlib import Path

from app.services.storage import storage_service

logger = logging.getLogger(__name__)


class FileProcessingService:
    """Service for processing files during indexing"""
    
    # Define allowed documentation file extensions
    DOCUMENTATION_EXTENSIONS: Set[str] = {'.md', '.mdx'}
    
    @staticmethod
    async def process_files_from_disk(
        repo_path: str, 
        docs_directory: str, 
        repo_id: str
    ) -> List[Dict[str, Any]]:
        """
        Process all documentation files from a cloned repository
        
        Args:
            repo_path: Path to the cloned repository
            docs_directory: Directory containing documentation files
            repo_id: Repository ID for storage keys
            
        Returns:
            List of file data dictionaries
        """
        files_data = []
        docs_path = os.path.join(repo_path, docs_directory)
        
        if not os.path.exists(docs_path):
            logger.warning(f"Documentation directory {docs_path} does not exist")
            return files_data

        logger.info(f"Processing files from directory: {docs_path}")
        
        # Walk through the directory
        for root, dirs, files in os.walk(docs_path):
            for file in files:
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, docs_path)
                
                # Check if file has documentation extension
                if not FileProcessingService._is_documentation_file(file_path):
                    continue
                
                # Skip binary files
                if FileProcessingService._is_binary_file(file_path):
                    logger.info(f"Skipping binary file: {relative_path}")
                    continue
                
                try:
                    file_data = await FileProcessingService._process_single_file(
                        file_path, relative_path, repo_id
                    )
                    if file_data:
                        files_data.append(file_data)
                        logger.info(f"Processed documentation file: {relative_path} ({len(file_data['content'])} chars)")
                        
                except (UnicodeDecodeError, OSError) as e:
                    logger.warning(f"Skipping unreadable file {relative_path}: {e}")
                    continue
        
        logger.info(f"Processed {len(files_data)} documentation files")
        return files_data
    
    @staticmethod
    async def process_files_from_storage(repo_id: str) -> List[Dict[str, Any]]:
        """
        Process existing files from storage for soft reindexing
        
        Args:
            repo_id: Repository ID
            
        Returns:
            List of file data dictionaries
        """
        from app.database import prisma
        
        files_data = []
        
        # Get existing files from database
        files = await prisma.file.find_many(
            where={"repo_id": repo_id},
            include={"repo": True}
        )
        
        if not files:
            raise ValueError(f"No files found for repository {repo_id}. Cannot perform soft re-index.")
        
        logger.info(f"Processing {len(files)} existing files from storage")
        
        # Process existing files and prepare them for re-chunking
        for file in files:
            try:
                content = await FileProcessingService._get_file_content_from_storage(file)
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
        
        logger.info(f"Successfully processed {len(files_data)} files from storage")
        return files_data
    
    @staticmethod
    async def _process_single_file(
        file_path: str, 
        relative_path: str, 
        repo_id: str
    ) -> Dict[str, Any]:
        """Process a single file and upload to storage"""
        # Read file content
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Calculate content hash
        content_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()
        
        # Upload to storage
        storage_key = f"docs/{repo_id}/{relative_path}"
        success = storage_service.upload_document(
            repo_id=repo_id,
            file_path=relative_path,
            content=content.encode('utf-8'),
            force_update=True
        )
        
        if not success:
            logger.error(f"Failed to upload {relative_path} to storage")
            return None
        
        return {
            'path': relative_path,
            'content': content,
            'content_hash': content_hash,
            'storage_key': storage_key,
            'repo_id': repo_id
        }
    
    @staticmethod
    async def _get_file_content_from_storage(file) -> str:
        """Get file content from storage"""
        storage_key = file.storage_key
        # The storage_key in database includes 'docs/' prefix, but the bucket is already 'docs',
        # so we need to remove the 'docs/' prefix from the storage key
        storage_path = storage_key[5:] if storage_key.startswith('docs/') else storage_key
        
        # Get content from storage
        content = await storage_service.get_file_content('docs', storage_path)
        return content
    
    @staticmethod
    def _is_documentation_file(file_path: str) -> bool:
        """Check if file is a documentation file based on extension"""
        file_ext = Path(file_path).suffix.lower()
        return file_ext in FileProcessingService.DOCUMENTATION_EXTENSIONS
    
    @staticmethod
    def _is_binary_file(file_path: str) -> bool:
        """Check if file is binary"""
        try:
            with open(file_path, 'rb') as f:
                chunk = f.read(1024)
                return b'\0' in chunk
        except OSError:
            return True
