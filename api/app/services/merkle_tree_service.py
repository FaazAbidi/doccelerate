"""
Merkle tree service for calculating and storing repository file hashes
"""

import os
import hashlib
import logging
from typing import List, Dict, Any

from app.database import prisma

logger = logging.getLogger(__name__)


class MerkleTreeService:
    """Service for handling Merkle tree operations"""
    
    @staticmethod
    async def calculate_and_store_merkle_tree(
        repo_id: str, 
        files_data: List[Dict[str, Any]]
    ) -> str:
        """
        Calculate Merkle tree root hash for the repository and store nodes
        
        Args:
            repo_id: Repository ID
            files_data: List of file data dictionaries
            
        Returns:
            Root hash of the Merkle tree
        """
        logger.info(f"Calculating Merkle tree for {len(files_data)} files")
        
        # Calculate root hash
        root_hash = MerkleTreeService._calculate_root_hash(files_data)
        
        # Store Merkle nodes
        await MerkleTreeService._store_merkle_nodes(repo_id, files_data)
        
        logger.info(f"Calculated Merkle tree root hash: {root_hash[:8]}...")
        return root_hash
    
    @staticmethod
    def _calculate_root_hash(files_data: List[Dict[str, Any]]) -> str:
        """
        Calculate the root hash of the Merkle tree
        
        This is a simple implementation: hash of all file hashes sorted by path
        
        Args:
            files_data: List of file data dictionaries
            
        Returns:
            Root hash as hexadecimal string
        """
        # Extract and sort file hashes by path
        file_hashes = sorted([
            (file_data['path'], file_data['content_hash'])
            for file_data in files_data
        ])
        
        # Create combined hash
        combined = ''.join([f"{path}:{hash}" for path, hash in file_hashes])
        root_hash = hashlib.sha256(combined.encode('utf-8')).hexdigest()
        
        logger.debug(f"Combined hash string length: {len(combined)} chars")
        return root_hash
    
    @staticmethod
    async def _store_merkle_nodes(
        repo_id: str, 
        files_data: List[Dict[str, Any]]
    ) -> None:
        """
        Store Merkle tree nodes in the database
        
        Args:
            repo_id: Repository ID
            files_data: List of file data dictionaries
        """
        logger.info(f"Storing {len(files_data)} Merkle tree nodes")
        
        # Extract file hashes sorted by path
        file_hashes = sorted([
            (file_data['path'], file_data['content_hash'])
            for file_data in files_data
        ])
        
        # Store each file as a Merkle node
        for path, file_hash in file_hashes:
            try:
                await MerkleTreeService._upsert_merkle_node(repo_id, path, file_hash)
            except Exception as e:
                logger.error(f"Failed to store Merkle node for {path}: {e}")
                raise
        
        logger.info("Successfully stored all Merkle tree nodes")
    
    @staticmethod
    async def _upsert_merkle_node(
        repo_id: str, 
        path: str, 
        file_hash: str
    ) -> None:
        """
        Upsert a single Merkle tree node
        
        Args:
            repo_id: Repository ID
            path: File path
            file_hash: File content hash
        """
        parent_path = os.path.dirname(path) if os.path.dirname(path) else None
        
        await prisma.merkle_node.upsert(
            where={
                "repo_id_path": {
                    "repo_id": repo_id,
                    "path": path
                }
            },
            data={
                "create": {
                    "repo_id": repo_id,
                    "path": path,
                    "hash": file_hash,
                    "node_type": "file",
                    "parent_path": parent_path
                },
                "update": {
                    "hash": file_hash,
                    "parent_path": parent_path
                }
            }
        )
        
        logger.debug(f"Upserted Merkle node: {path}")
    
    @staticmethod
    async def get_repository_merkle_hash(repo_id: str) -> str:
        """
        Get the current Merkle tree root hash for a repository
        
        Args:
            repo_id: Repository ID
            
        Returns:
            Current root hash or None if not found
        """
        try:
            repo = await prisma.repo.find_unique(
                where={"id": repo_id},
                select={"root_hash": True}
            )
            
            if repo and repo.root_hash:
                return repo.root_hash
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get Merkle hash for repository {repo_id}: {e}")
            return None
    
    @staticmethod
    async def compare_merkle_trees(
        repo_id: str, 
        new_files_data: List[Dict[str, Any]]
    ) -> bool:
        """
        Compare new file data with existing Merkle tree
        
        Args:
            repo_id: Repository ID
            new_files_data: New file data to compare
            
        Returns:
            True if trees are identical, False otherwise
        """
        try:
            # Calculate new root hash
            new_root_hash = MerkleTreeService._calculate_root_hash(new_files_data)
            
            # Get existing root hash
            existing_root_hash = await MerkleTreeService.get_repository_merkle_hash(repo_id)
            
            if not existing_root_hash:
                logger.info("No existing Merkle tree found for comparison")
                return False
            
            is_identical = new_root_hash == existing_root_hash
            logger.info(f"Merkle tree comparison: {'identical' if is_identical else 'different'}")
            
            return is_identical
            
        except Exception as e:
            logger.error(f"Failed to compare Merkle trees: {e}")
            return False
