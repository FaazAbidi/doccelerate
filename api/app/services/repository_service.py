"""
Repository service for Git operations
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class RepositoryService:
    """Service for handling Git repository operations"""
    
    @staticmethod
    async def clone_repository(
        github_full_name: str, 
        branch: str, 
        docs_directory: str, 
        temp_dir: str, 
        github_access_token: Optional[str] = None
    ) -> str:
        """
        Perform sparse shallow clone of repository
        
        Args:
            github_full_name: GitHub repository name (e.g., "owner/repo")
            branch: Branch to clone
            docs_directory: Directory to include in sparse checkout
            temp_dir: Temporary directory for cloning
            github_access_token: Optional GitHub access token for private repos
            
        Returns:
            Path to the cloned repository
        """
        # Import GitPython lazily to avoid issues with LoggingProxy
        from git import Repo
        
        try:
            # Use authenticated URL if token is available, otherwise use anonymous HTTPS
            if github_access_token:
                repo_url = f"https://{github_access_token}@github.com/{github_full_name}.git"
            else:
                repo_url = f"https://github.com/{github_full_name}.git"
            
            repo_path = os.path.join(temp_dir, "repo")
            
            logger.info(f"Cloning repository {github_full_name} from branch {branch}")
            
            # Clone with sparse checkout
            repo = Repo.clone_from(
                repo_url,
                repo_path,
                branch=branch,
                depth=1,  # Shallow clone
                single_branch=True
            )
            
            # Configure sparse checkout
            RepositoryService._configure_sparse_checkout(repo_path, docs_directory)
            
            logger.info(f"Successfully cloned repository to {repo_path}")
            return repo_path
            
        except Exception as e:
            logger.error(f"Failed to clone repository {github_full_name}: {e}")
            raise
    
    @staticmethod
    def _configure_sparse_checkout(repo_path: str, docs_directory: str) -> None:
        """Configure sparse checkout for the repository"""
        from git import Repo
        
        repo = Repo(repo_path)
        
        # Configure sparse checkout
        sparse_checkout_path = os.path.join(repo_path, ".git", "info", "sparse-checkout")
        os.makedirs(os.path.dirname(sparse_checkout_path), exist_ok=True)
        
        with open(sparse_checkout_path, "w") as f:
            f.write(f"{docs_directory}/*\n")
        
        # Enable sparse checkout
        repo.git.config("core.sparseCheckout", "true")
        repo.git.read_tree("-m", "-u", "HEAD")
        
        logger.info(f"Configured sparse checkout for directory: {docs_directory}")
    
    @staticmethod
    def get_commit_sha(repo_path: str) -> str:
        """
        Get the current commit SHA from the repository
        
        Args:
            repo_path: Path to the Git repository
            
        Returns:
            Current commit SHA
        """
        from git import Repo
        
        try:
            repo = Repo(repo_path)
            commit_sha = repo.head.commit.hexsha
            logger.info(f"Retrieved commit SHA: {commit_sha}")
            return commit_sha
        except Exception as e:
            logger.error(f"Failed to get commit SHA from {repo_path}: {e}")
            raise
