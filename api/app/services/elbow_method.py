"""
Elbow method implementation for RAG similarity search

This module implements the elbow method to dynamically determine the optimal
number of documents to retrieve based on similarity score analysis.
"""

import logging
import numpy as np
from typing import List, Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)


class ElbowAnalyzer:
    """
    Analyzes similarity scores to find the elbow point using various algorithms
    """
    
    def __init__(self, min_docs: int = 3, max_docs: int = 50, significance_threshold: float = 0.15):
        """
        Initialize the elbow analyzer
        
        Args:
            min_docs: Minimum number of documents to return (safety net)
            max_docs: Maximum number of documents to consider (performance limit) 
            significance_threshold: Minimum similarity score to consider relevant
        """
        self.min_docs = min_docs
        self.max_docs = max_docs
        self.significance_threshold = significance_threshold
    
    def find_elbow_point(self, similarity_scores: List[float]) -> Tuple[int, Dict[str, Any]]:
        """
        Find the elbow point in similarity scores using multiple methods
        
        Args:
            similarity_scores: List of similarity scores in descending order
            
        Returns:
            Tuple of (optimal_count, analysis_metadata)
        """
        if not similarity_scores or len(similarity_scores) < self.min_docs:
            logger.warning(f"Insufficient similarity scores ({len(similarity_scores)}), using minimum: {self.min_docs}")
            return self.min_docs, {"method": "fallback_min", "reason": "insufficient_data"}
        
        # Limit analysis to max_docs for performance
        scores = similarity_scores[:self.max_docs] if len(similarity_scores) > self.max_docs else similarity_scores
        
        # Filter out very low scores
        relevant_scores = [score for score in scores if score >= self.significance_threshold]
        if len(relevant_scores) < self.min_docs:
            logger.info(f"Only {len(relevant_scores)} scores above threshold {self.significance_threshold}, using all available")
            relevant_scores = scores[:self.min_docs] if len(scores) >= self.min_docs else scores
        
        if len(relevant_scores) <= self.min_docs:
            return len(relevant_scores), {"method": "threshold_filter", "scores_above_threshold": len(relevant_scores)}
        
        # Try multiple elbow detection methods
        methods_results = []
        
        # Method 1: Knee/Elbow detection using curvature
        knee_point = self._detect_knee_point(relevant_scores)
        if knee_point > 0:
            methods_results.append(("knee_detection", knee_point))
        
        # Method 2: Rate of change analysis
        rate_change_point = self._detect_rate_change_elbow(relevant_scores)
        if rate_change_point > 0:
            methods_results.append(("rate_change", rate_change_point))
        
        # Method 3: Percentage drop threshold
        percentage_drop_point = self._detect_percentage_drop_elbow(relevant_scores)
        if percentage_drop_point > 0:
            methods_results.append(("percentage_drop", percentage_drop_point))
        
        # Choose the best result
        if methods_results:
            # Use the median of all valid methods for robustness
            all_points = [point for _, point in methods_results]
            optimal_point = int(np.median(all_points))
            
            # Ensure we stay within bounds
            optimal_point = max(self.min_docs, min(optimal_point, len(relevant_scores)))
            
            analysis_metadata = {
                "method": "ensemble",
                "individual_methods": dict(methods_results),
                "chosen_point": optimal_point,
                "total_scores": len(scores),
                "relevant_scores": len(relevant_scores),
                "highest_score": scores[0] if scores else 0.0,
                "lowest_score": scores[-1] if scores else 0.0,
                "elbow_score": relevant_scores[optimal_point-1] if optimal_point <= len(relevant_scores) else 0.0
            }
            
            logger.info(f"Elbow method selected {optimal_point} documents using ensemble approach")
            return optimal_point, analysis_metadata
        
        # Fallback: use adaptive threshold
        adaptive_point = self._adaptive_threshold_fallback(relevant_scores)
        logger.warning(f"All elbow methods failed, using adaptive fallback: {adaptive_point}")
        return adaptive_point, {"method": "adaptive_fallback", "point": adaptive_point}
    
    def _detect_knee_point(self, scores: List[float]) -> int:
        """
        Detect elbow using the knee detection algorithm (perpendicular distance method)
        """
        try:
            if len(scores) < 3:
                return 0
            
            # Create coordinate points (index, score)
            points = np.array([(i, score) for i, score in enumerate(scores)])
            
            # Get first and last points for the line
            first_point = points[0]
            last_point = points[-1]
            
            # Calculate distances from each point to the line between first and last
            distances = []
            for point in points[1:-1]:  # Skip first and last points
                # Calculate perpendicular distance to line
                distance = self._point_to_line_distance(point, first_point, last_point)
                distances.append(distance)
            
            if not distances:
                return 0
            
            # Find the point with maximum distance (the "knee")
            max_distance_idx = np.argmax(distances) + 1  # +1 because we skipped first point
            
            return max_distance_idx + 1  # +1 for 1-based counting
            
        except Exception as e:
            logger.error(f"Knee detection failed: {e}")
            return 0
    
    def _point_to_line_distance(self, point: np.ndarray, line_start: np.ndarray, line_end: np.ndarray) -> float:
        """Calculate perpendicular distance from point to line"""
        # Vector from line_start to line_end
        line_vec = line_end - line_start
        # Vector from line_start to point
        point_vec = point - line_start
        
        # Project point_vec onto line_vec
        line_len = np.linalg.norm(line_vec)
        if line_len == 0:
            return np.linalg.norm(point_vec)
        
        line_unitvec = line_vec / line_len
        proj_length = np.dot(point_vec, line_unitvec)
        proj = proj_length * line_unitvec
        
        # Calculate perpendicular distance
        perpendicular = point_vec - proj
        return np.linalg.norm(perpendicular)
    
    def _detect_rate_change_elbow(self, scores: List[float], sensitivity: float = 2.0) -> int:
        """
        Detect elbow by finding where the rate of decrease significantly changes
        """
        try:
            if len(scores) < 4:
                return 0
            
            # Calculate first and second derivatives (rate of change)
            first_diffs = [scores[i] - scores[i+1] for i in range(len(scores)-1)]
            second_diffs = [first_diffs[i] - first_diffs[i+1] for i in range(len(first_diffs)-1)]
            
            if not second_diffs:
                return 0
            
            # Find significant changes in rate
            mean_second_diff = np.mean(second_diffs)
            std_second_diff = np.std(second_diffs)
            
            if std_second_diff == 0:
                return 0
            
            threshold = mean_second_diff + (sensitivity * std_second_diff)
            
            # Find first point where second derivative exceeds threshold
            for i, diff in enumerate(second_diffs):
                if diff > threshold:
                    return i + 2  # +2 because of derivative calculations
            
            return 0
            
        except Exception as e:
            logger.error(f"Rate change detection failed: {e}")
            return 0
    
    def _detect_percentage_drop_elbow(self, scores: List[float], drop_threshold: float = 0.3) -> int:
        """
        Detect elbow by finding where similarity drops by a significant percentage
        """
        try:
            if len(scores) < 2:
                return 0
            
            first_score = scores[0]
            
            for i in range(1, len(scores)):
                if first_score > 0:
                    percentage_drop = (first_score - scores[i]) / first_score
                    if percentage_drop >= drop_threshold:
                        return i
            
            return 0
            
        except Exception as e:
            logger.error(f"Percentage drop detection failed: {e}")
            return 0
    
    def _adaptive_threshold_fallback(self, scores: List[float]) -> int:
        """
        Adaptive fallback that selects based on score distribution
        """
        if not scores:
            return self.min_docs
        
        # If scores are very uniform, take more documents
        if len(scores) >= 5:
            score_range = scores[0] - scores[-1]
            if score_range < 0.1:  # Very similar scores
                return min(len(scores), self.max_docs // 2)
        
        # Otherwise, use a conservative approach
        return min(len(scores), max(self.min_docs, len(scores) // 3))


class ElbowBasedRetrieval:
    """
    Enhanced retrieval service that uses elbow method for dynamic document selection
    """
    
    def __init__(self, openai_service, min_docs: int = 3, max_docs: int = 50):
        """
        Initialize the elbow-based retrieval service
        
        Args:
            openai_service: The OpenAI service instance for similarity search
            min_docs: Minimum number of documents to retrieve
            max_docs: Maximum number of documents to retrieve
        """
        self.openai_service = openai_service
        self.elbow_analyzer = ElbowAnalyzer(min_docs=min_docs, max_docs=max_docs)
    
    async def search_similar_chunks_with_elbow(
        self,
        query_embedding: List[float],
        repo_id: str,
        initial_limit: int = 100,
        min_similarity: float = 0.05
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Search for similar chunks using elbow method to determine optimal count
        
        Args:
            query_embedding: The embedding vector to search with
            repo_id: Repository ID to limit search scope
            initial_limit: Initial number of results to fetch for analysis
            min_similarity: Minimum similarity threshold for initial retrieval
            
        Returns:
            Tuple of (optimal_chunks, analysis_metadata)
        """
        try:
            # First, get a larger set of potential matches
            logger.info(f"Fetching initial {initial_limit} chunks for elbow analysis")
            
            all_chunks = await self.openai_service.search_similar_chunks(
                query_embedding=query_embedding,
                repo_id=repo_id,
                limit=initial_limit,
                similarity_threshold=min_similarity
            )
            
            if not all_chunks:
                logger.warning("No chunks found in initial retrieval")
                # Try fallback search
                all_chunks = await self.openai_service.search_chunks_fulltext(
                    query_text="",  # We don't have the original query here, but this is fallback
                    repo_id=repo_id,
                    limit=self.elbow_analyzer.min_docs
                )
                
                if all_chunks:
                    return all_chunks, {"method": "fulltext_fallback", "count": len(all_chunks)}
                else:
                    return [], {"method": "no_results", "count": 0}
            
            # Extract similarity scores for elbow analysis
            similarity_scores = [chunk.get('similarity', 0.0) for chunk in all_chunks]
            
            # Apply elbow method to find optimal cutoff
            optimal_count, analysis_metadata = self.elbow_analyzer.find_elbow_point(similarity_scores)
            
            # Return the optimal subset
            optimal_chunks = all_chunks[:optimal_count]
            
            # Add retrieval metadata
            analysis_metadata.update({
                "initial_retrieval_count": len(all_chunks),
                "optimal_count": optimal_count,
                "similarity_range": {
                    "highest": similarity_scores[0] if similarity_scores else 0.0,
                    "lowest": similarity_scores[optimal_count-1] if optimal_count <= len(similarity_scores) else 0.0,
                    "cutoff_score": similarity_scores[optimal_count-1] if optimal_count <= len(similarity_scores) else 0.0
                }
            })
            
            logger.info(f"Elbow method: reduced {len(all_chunks)} to {optimal_count} chunks")
            logger.info(f"Score range: {analysis_metadata['similarity_range']['highest']:.3f} to {analysis_metadata['similarity_range']['cutoff_score']:.3f}")
            
            return optimal_chunks, analysis_metadata
            
        except Exception as e:
            logger.error(f"Elbow-based retrieval failed: {e}")
            # Fallback to traditional method
            fallback_chunks = await self.openai_service.search_similar_chunks(
                query_embedding=query_embedding,
                repo_id=repo_id,
                limit=self.elbow_analyzer.min_docs,
                similarity_threshold=0.3
            )
            return fallback_chunks, {"method": "error_fallback", "error": str(e), "count": len(fallback_chunks)}
