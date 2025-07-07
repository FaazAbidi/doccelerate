"""
Storage service for handling document and file operations
"""

from typing import List, Dict, Any, Optional
from .supabase_client import supabase_client

class StorageService:
    """
    High-level storage service for document management
    """
    
    DOCS_BUCKET = "docs"
    
    def upload_document(self, repo_id: str, file_path: str, content: bytes, force_update: bool = True) -> bool:
        """
        Upload a document file to the docs bucket
        
        Args:
            repo_id: Repository ID
            file_path: Relative file path within the repository
            content: File content as bytes
            force_update: Whether to force update existing files
            
        Returns:
            True if successful, False otherwise
        """
        storage_key = f"{repo_id}/{file_path}"
        
        # If force_update is True, try to delete the file first to avoid conflicts
        if force_update:
            try:
                supabase_client.delete_file(bucket=self.DOCS_BUCKET, path=storage_key)
            except Exception:
                # Ignore errors if file doesn't exist
                pass
        
        return supabase_client.upload_file(
            bucket=self.DOCS_BUCKET,
            path=storage_key,
            content=content,
            upsert=True
        )
    
    def download_document(self, repo_id: str, file_path: str) -> Optional[bytes]:
        """
        Download a document file from the docs bucket
        
        Args:
            repo_id: Repository ID
            file_path: Relative file path within the repository
            
        Returns:
            File content as bytes or None if failed
        """
        storage_key = f"{repo_id}/{file_path}"
        return supabase_client.download_file(
            bucket=self.DOCS_BUCKET,
            path=storage_key
        )
    
    def delete_document(self, repo_id: str, file_path: str) -> bool:
        """
        Delete a document file from the docs bucket
        
        Args:
            repo_id: Repository ID
            file_path: Relative file path within the repository
            
        Returns:
            True if successful, False otherwise
        """
        storage_key = f"{repo_id}/{file_path}"
        return supabase_client.delete_file(
            bucket=self.DOCS_BUCKET,
            path=storage_key
        )
    
    def list_documents(self, repo_id: str, directory: str = "") -> Optional[List[Dict[str, Any]]]:
        """
        List documents in a repository directory
        
        Args:
            repo_id: Repository ID
            directory: Directory path within the repository
            
        Returns:
            List of file information or None if failed
        """
        storage_path = f"{repo_id}/{directory}" if directory else repo_id
        return supabase_client.list_files(
            bucket=self.DOCS_BUCKET,
            path=storage_path
        )
    
    def get_document_url(self, repo_id: str, file_path: str, signed: bool = False, expires_in: int = 3600) -> Optional[str]:
        """
        Get URL for a document file
        
        Args:
            repo_id: Repository ID
            file_path: Relative file path within the repository
            signed: Whether to create a signed URL (for private access)
            expires_in: URL expiration time in seconds (for signed URLs)
            
        Returns:
            Document URL or None if failed
        """
        storage_key = f"{repo_id}/{file_path}"
        
        if signed:
            return supabase_client.create_signed_url(
                bucket=self.DOCS_BUCKET,
                path=storage_key,
                expires_in=expires_in
            )
        else:
            return supabase_client.get_public_url(
                bucket=self.DOCS_BUCKET,
                path=storage_key
            )
    
    async def get_file_content(self, bucket: str, path: str) -> Optional[str]:
        """
        Get file content as a string from storage
        
        Args:
            bucket: Storage bucket name
            path: File path in storage
            
        Returns:
            File content as a string or None if failed
        """
        content = supabase_client.download_file(bucket=bucket, path=path)
        if content:
            try:
                return content.decode('utf-8')
            except UnicodeDecodeError:
                # If it's not valid UTF-8, try with errors="replace"
                return content.decode('utf-8', errors="replace")
        return None
    
    def cleanup_repo_documents(self, repo_id: str) -> bool:
        """
        Delete all documents for a repository
        
        Args:
            repo_id: Repository ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # List all files for the repo
            files = self.list_documents(repo_id)
            if not files:
                return True
            
            # Delete each file
            success = True
            for file_info in files:
                file_path = file_info.get('name', '')
                if file_path:
                    if not self.delete_document(repo_id, file_path):
                        success = False
            
            return success
        except Exception as e:
            print(f"Failed to cleanup documents for repo {repo_id}: {e}")
            return False


# Global instance to be used throughout the application
storage_service = StorageService() 