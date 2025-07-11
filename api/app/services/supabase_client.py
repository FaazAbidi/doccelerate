"""
Supabase client service for storage and database operations

This service provides a clean interface for interacting with Supabase storage,
including file uploads, downloads, and management operations.
"""

import logging
from typing import Optional, List, Dict, Any
import os
import time
import asyncio
from functools import wraps

from supabase import create_client, Client
from app.settings import settings

logger = logging.getLogger(__name__)


class SupabaseService:
    """
    Enhanced Supabase service for handling storage operations and database interactions
    """
    
    def __init__(self):
        try:
            self._client: Client = create_client(
                settings.SUPABASE_URL, 
                settings.SUPABASE_ANON_KEY
            )
            logger.info("Supabase client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            raise
    
    @property
    def client(self) -> Client:
        """Get the Supabase client instance"""
        return self._client
    
    def upload_file(
        self,
        bucket: str, 
        path: str, 
        content: bytes, 
        upsert: bool = True
    ) -> bool:
        """
        Upload a file to Supabase storage
        
        Args:
            bucket: Storage bucket name
            path: File path in storage
            content: File content as bytes
            upsert: Whether to overwrite existing files
            
        Returns:
            True if successful, False otherwise
        """
        try:
            logger.debug(f"Uploading file to {bucket}/{path} ({len(content)} bytes)")
            
            # Set appropriate content type based on file extension
            content_type = self._get_content_type(path)
            
            file_options = {
                "content-type": content_type
            }
            
            # Handle upsert by removing existing file first
            if upsert:
                self._remove_existing_file(bucket, path)
                
            # Upload the file
            self._client.storage.from_(bucket).upload(
                path=path,
                file=content,
                file_options=file_options
            )
            
            logger.info(f"Successfully uploaded file: {bucket}/{path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to upload file {path} to bucket {bucket}: {e}")
            return False
    
    def download_file(self, bucket: str, path: str, max_retries: int = 3) -> Optional[bytes]:
        """
        Download a file from Supabase storage with retry logic
        
        Args:
            bucket: Storage bucket name
            path: File path in storage
            max_retries: Maximum number of retry attempts
            
        Returns:
            File content as bytes or None if failed
        """
        last_exception = None
        
        for attempt in range(max_retries + 1):
            try:
                logger.debug(f"Downloading file from {bucket}/{path} (attempt {attempt + 1}/{max_retries + 1})")
                
                response = self._client.storage.from_(bucket).download(path)
                
                if response:
                    logger.debug(f"Successfully downloaded file: {bucket}/{path} ({len(response)} bytes)")
                    return response
                else:
                    logger.warning(f"File not found or empty: {bucket}/{path}")
                    return None
                    
            except Exception as e:
                last_exception = e
                
                if attempt < max_retries:
                    wait_time = (2 ** attempt) * 0.5  # Exponential backoff: 0.5, 1, 2 seconds
                    logger.warning(f"Attempt {attempt + 1} failed for {path}: {e}. Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"Failed to download file {path} from bucket {bucket} after {max_retries + 1} attempts: {e}")
        
        return None
    
    def delete_file(self, bucket: str, path: str) -> bool:
        """
        Delete a file from Supabase storage
        
        Args:
            bucket: Storage bucket name
            path: File path in storage
            
        Returns:
            True if successful, False otherwise
        """
        try:
            logger.debug(f"Deleting file: {bucket}/{path}")
            
            self._client.storage.from_(bucket).remove([path])
            
            logger.info(f"Successfully deleted file: {bucket}/{path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete file {path} from bucket {bucket}: {e}")
            return False
    
    def list_files(self, bucket: str, path: str = "") -> Optional[List[Dict[str, Any]]]:
        """
        List files in a Supabase storage bucket
        
        Args:
            bucket: Storage bucket name
            path: Directory path to list (empty for root)
            
        Returns:
            List of file information or None if failed
        """
        try:
            logger.debug(f"Listing files in {bucket}/{path}")
            
            response = self._client.storage.from_(bucket).list(path)
            
            if response:
                logger.info(f"Found {len(response)} files in {bucket}/{path}")
                return response
            else:
                logger.info(f"No files found in {bucket}/{path}")
                return []
                
        except Exception as e:
            logger.error(f"Failed to list files in bucket {bucket} at path {path}: {e}")
            return None
    
    def get_public_url(self, bucket: str, path: str) -> Optional[str]:
        """
        Get public URL for a file in Supabase storage
        
        Args:
            bucket: Storage bucket name
            path: File path in storage
            
        Returns:
            Public URL or None if failed
        """
        try:
            response = self._client.storage.from_(bucket).get_public_url(path)
            
            if response:
                logger.debug(f"Generated public URL for {bucket}/{path}")
                return response
            else:
                logger.warning(f"Failed to get public URL for {bucket}/{path}")
                return None
                
        except Exception as e:
            logger.error(f"Failed to get public URL for {path} in bucket {bucket}: {e}")
            return None
    
    def create_signed_url(
        self, 
        bucket: str, 
        path: str, 
        expires_in: int = 3600
    ) -> Optional[str]:
        """
        Create a signed URL for a file in Supabase storage
        
        Args:
            bucket: Storage bucket name
            path: File path in storage
            expires_in: URL expiration time in seconds (default 1 hour)
            
        Returns:
            Signed URL or None if failed
        """
        try:
            response = self._client.storage.from_(bucket).create_signed_url(path, expires_in)
            
            if response and 'signedURL' in response:
                signed_url = response['signedURL']
                logger.debug(f"Generated signed URL for {bucket}/{path} (expires in {expires_in}s)")
                return signed_url
            else:
                logger.warning(f"Failed to create signed URL for {bucket}/{path}")
                return None
                
        except Exception as e:
            logger.error(f"Failed to create signed URL for {path} in bucket {bucket}: {e}")
            return None
    
    def _get_content_type(self, path: str) -> str:
        """Determine content type based on file extension"""
        path_lower = path.lower()
        
        if path_lower.endswith('.md') or path_lower.endswith('.mdx'):
            return "text/markdown"
        elif path_lower.endswith('.json'):
            return "application/json"
        elif path_lower.endswith('.html') or path_lower.endswith('.htm'):
            return "text/html"
        elif path_lower.endswith('.txt'):
            return "text/plain"
        elif path_lower.endswith('.css'):
            return "text/css"
        elif path_lower.endswith('.js'):
            return "application/javascript"
        elif path_lower.endswith('.xml'):
            return "application/xml"
        else:
            return "text/plain"  # Default
    
    def _remove_existing_file(self, bucket: str, path: str) -> None:
        """Remove existing file for upsert operation"""
        try:
            # Try to delete the file first if it exists
            self._client.storage.from_(bucket).remove([path])
            logger.debug(f"Removed existing file for upsert: {bucket}/{path}")
        except Exception:
            # Ignore errors if file doesn't exist
            logger.debug(f"No existing file to remove: {bucket}/{path}")
    
    def file_exists(self, bucket: str, path: str) -> bool:
        """
        Check if a file exists in storage
        
        Args:
            bucket: Storage bucket name
            path: File path in storage
            
        Returns:
            True if file exists, False otherwise
        """
        try:
            # Try to get file info
            files = self.list_files(bucket, os.path.dirname(path))
            if files:
                filename = os.path.basename(path)
                return any(file_info.get('name') == filename for file_info in files)
            return False
            
        except Exception as e:
            logger.error(f"Failed to check if file exists {bucket}/{path}: {e}")
            return False
    
    def get_file_size(self, bucket: str, path: str) -> Optional[int]:
        """
        Get file size in bytes
        
        Args:
            bucket: Storage bucket name
            path: File path in storage
            
        Returns:
            File size in bytes or None if failed
        """
        try:
            files = self.list_files(bucket, os.path.dirname(path))
            if files:
                filename = os.path.basename(path)
                for file_info in files:
                    if file_info.get('name') == filename:
                        return file_info.get('metadata', {}).get('size')
            return None
            
        except Exception as e:
            logger.error(f"Failed to get file size for {bucket}/{path}: {e}")
            return None


# Global instance to be used throughout the application
supabase_client = SupabaseService() 