"""
Supabase client service for storage and database operations
"""

from supabase import create_client, Client
from app.settings import settings

class SupabaseService:
    """
    Supabase service for handling storage operations and database interactions
    """
    
    def __init__(self):
        self._client: Client = create_client(
            settings.SUPABASE_URL, 
            settings.SUPABASE_ANON_KEY
        )
    
    @property
    def client(self) -> Client:
        """Get the Supabase client instance"""
        return self._client
    
    def upload_file(self, bucket: str, path: str, content: bytes, upsert: bool = True) -> bool:
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
            # Set appropriate content type based on file extension
            content_type = "text/plain"  # Default
            if path.endswith('.md'):
                content_type = "text/markdown"
            elif path.endswith('.json'):
                content_type = "application/json"
            elif path.endswith('.html'):
                content_type = "text/html"
            
            file_options = {
                "content-type": content_type
            }
            
            # Simple upload - Supabase storage will handle overwrites automatically
            self._client.storage.from_(bucket).upload(
                path=path,
                file=content,
                file_options=file_options
            )
            return True
        except Exception as e:
            print(f"Failed to upload file {path} to bucket {bucket}: {e}")
            return False
    
    def download_file(self, bucket: str, path: str) -> bytes | None:
        """
        Download a file from Supabase storage
        
        Args:
            bucket: Storage bucket name
            path: File path in storage
            
        Returns:
            File content as bytes or None if failed
        """
        try:
            response = self._client.storage.from_(bucket).download(path)
            return response
        except Exception as e:
            print(f"Failed to download file {path} from bucket {bucket}: {e}")
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
            self._client.storage.from_(bucket).remove([path])
            return True
        except Exception as e:
            print(f"Failed to delete file {path} from bucket {bucket}: {e}")
            return False
    
    def list_files(self, bucket: str, path: str = "") -> list | None:
        """
        List files in a Supabase storage bucket
        
        Args:
            bucket: Storage bucket name
            path: Directory path to list (empty for root)
            
        Returns:
            List of files or None if failed
        """
        try:
            response = self._client.storage.from_(bucket).list(path)
            return response
        except Exception as e:
            print(f"Failed to list files in bucket {bucket} at path {path}: {e}")
            return None
    
    def get_public_url(self, bucket: str, path: str) -> str | None:
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
            return response
        except Exception as e:
            print(f"Failed to get public URL for {path} in bucket {bucket}: {e}")
            return None
    
    def create_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str | None:
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
            return response.get('signedURL')
        except Exception as e:
            print(f"Failed to create signed URL for {path} in bucket {bucket}: {e}")
            return None


# Global instance to be used throughout the application
supabase_client = SupabaseService() 