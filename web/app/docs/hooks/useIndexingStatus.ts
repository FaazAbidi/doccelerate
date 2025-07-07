'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { checkIndexingStatus } from '../actions/checkIndexingStatus'
import { startIndexing, StartIndexingResponse } from '../actions/startIndexing'
import { getJobStatus } from '../actions/getJobStatus'
import { useRealtimeIndexing, IndexingNotification } from './useRealtimeIndexing'

import { IndexingProgress } from '../components/IndexingProgress'

export interface IndexingState {
  phase: 'idle' | 'starting' | 'indexing' | 'completed' | 'failed'
  taskId?: string
  jobId?: string
  progress?: IndexingProgress
  error?: string
  response?: StartIndexingResponse
}

export function useIndexingStatus() {
  const [indexingState, setIndexingState] = useState<IndexingState>({ phase: 'idle' })
  const queryClient = useQueryClient()

  // Query for indexing status with longer stale time to reduce refetches
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['indexing-status'],
    queryFn: checkIndexingStatus,
    refetchOnWindowFocus: false,
    staleTime: 0,      // always treat data as stale so fresh fetch on mount
    gcTime: 0,         // garbage collect cache immediately when unused
    refetchInterval: false,
  })

  // Query for job status when we have a task ID
  const { data: jobStatus } = useQuery({
    queryKey: ['job-status', indexingState.taskId],
    queryFn: () => indexingState.taskId ? getJobStatus(indexingState.taskId) : null,
    enabled: !!indexingState.taskId && indexingState.phase === 'indexing',
    refetchInterval: 10000, // Poll every 10 seconds
    refetchOnWindowFocus: false,
  })

  // Handle recovery from page refresh - check for existing active jobs
  useEffect(() => {
    if (status?.hasActiveJob && status.activeJob && indexingState.phase === 'idle') {
      const activeJob = status.activeJob
      console.log('Recovering from active job:', activeJob)
      
      setIndexingState({
        phase: activeJob.status === 'completed' ? 'completed' : 
               activeJob.status === 'failed' ? 'failed' : 'indexing',
        taskId: activeJob.task_id,
        jobId: activeJob.id,
        progress: {
          step: activeJob.metadata?.current_step || 'processing',
          progress: activeJob.progress || 0,
          status: activeJob.status === 'completed' ? 'SUCCESS' : 
                  activeJob.status === 'failed' ? 'FAILURE' : 'PROGRESS',
          task_id: activeJob.task_id,
          repo: activeJob.metadata?.repo_name,
          branch: activeJob.metadata?.branch,
          directory: activeJob.metadata?.directory,
          metadata: {
            soft_reindex: activeJob.metadata?.soft_reindex || false
          }
        },
        error: activeJob.error_msg,
        response: {
          success: true,
          task_id: activeJob.task_id,
          status: activeJob.status,
          repo: activeJob.metadata?.repo_name,
          branch: activeJob.metadata?.branch,
          directory: activeJob.metadata?.directory,
          message: "Recovered indexing job"
        }
      })
    }
  }, [status?.hasActiveJob, status?.activeJob, indexingState.phase])

  // Update progress based on job status
  useEffect(() => {
    if (jobStatus && indexingState.phase === 'indexing') {
      const progressData: IndexingProgress = {
        step: jobStatus.metadata?.current_step || 'processing',
        progress: jobStatus.progress ? Math.round(jobStatus.progress * 100) : 0,
        status: jobStatus.status === 'completed' ? 'SUCCESS' : 
                jobStatus.status === 'failed' ? 'FAILURE' : 'PROGRESS',
        task_id: jobStatus.task_id,
        repo: jobStatus.metadata?.repo_name,
        branch: jobStatus.metadata?.branch,
        directory: jobStatus.metadata?.directory,
        metadata: {
          soft_reindex: jobStatus.metadata?.soft_reindex || false
        }
      }

      setIndexingState(prev => ({ ...prev, progress: progressData }))

      // Handle completion or failure detected from job status
      if (jobStatus.status === 'completed') {
        setIndexingState(prev => ({ ...prev, phase: 'completed' }))
      } else if (jobStatus.status === 'failed') {
        setIndexingState(prev => ({ 
          ...prev, 
          phase: 'failed', 
          error: jobStatus.error_msg || 'Indexing failed' 
        }))
      }
    }
  }, [jobStatus, indexingState.phase])

  // Handle indexing completion via Realtime
  const handleIndexingComplete = useCallback((notification: IndexingNotification) => {
    console.log('Indexing completed:', notification)
    setIndexingState(prev => ({
      ...prev,
      phase: 'completed',
      progress: {
        step: 'completed',
        progress: 100,
        status: 'SUCCESS',
        task_id: prev.taskId,
        repo: prev.response?.repo,
        branch: prev.response?.branch,
        directory: prev.response?.directory,
      }
    }))
    
    // Refetch status to update UI
    queryClient.invalidateQueries({ queryKey: ['indexing-status'] })
    queryClient.invalidateQueries({ queryKey: ['job-status', indexingState.taskId] })
  }, [queryClient, indexingState.taskId])

  const handleIndexingFailed = useCallback((notification: IndexingNotification) => {
    console.log('Indexing failed:', notification)
    setIndexingState(prev => ({
      ...prev,
      phase: 'failed',
      error: notification.error || 'Indexing failed',
      progress: {
        step: 'failed',
        progress: 0,
        status: 'FAILURE',
        task_id: prev.taskId,
        repo: prev.response?.repo,
        branch: prev.response?.branch,
        directory: prev.response?.directory,
      }
    }))
  }, [])

  // Set up Realtime subscription
  useRealtimeIndexing({
    onIndexingComplete: handleIndexingComplete,
    onIndexingFailed: handleIndexingFailed,
    enabled: indexingState.phase === 'indexing'
  })



  // Memoize progress updates to prevent unnecessary re-renders
  const optimizedProgress = useMemo(() => {
    return indexingState.progress
  }, [indexingState.progress])

  const handleStartIndexing = async (): Promise<StartIndexingResponse | null> => {
    setIndexingState({ phase: 'starting' })
    
    try {
      const response = await startIndexing()
      
      if (response.success && response.task_id) {
        setIndexingState({
          phase: 'indexing',
          taskId: response.task_id,
          response,
          progress: {
            step: 'starting',
            progress: 0,
            status: 'PROGRESS',
            task_id: response.task_id,
            repo: response.repo,
            branch: response.branch,
            directory: response.directory,
          }
        })
      } else {
        setIndexingState({
          phase: 'failed',
          error: response.message || 'Failed to start indexing'
        })
      }
      
      return response
    } catch (error) {
      console.error('Failed to start indexing:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to start indexing. Please try again.'
      setIndexingState({
        phase: 'failed',
        error: errorMessage
      })
      return null
    }
  }

  const handleRetryIndexing = useCallback(() => {
    setIndexingState({ phase: 'idle' })
    queryClient.invalidateQueries({ queryKey: ['indexing-status'] })
  }, [queryClient])

  const handleCancelIndexing = useCallback(() => {
    // TODO: Implement task cancellation if needed
    setIndexingState({ phase: 'idle' })
  }, [])

  return {
    status,
    isLoading,
    indexingState,
    isStartingIndexing: indexingState.phase === 'starting',
    isIndexing: indexingState.phase === 'indexing',
    indexingError: indexingState.error || null,
    indexingProgress: optimizedProgress,
    startIndexing: handleStartIndexing,
    retryIndexing: handleRetryIndexing,
    cancelIndexing: handleCancelIndexing,
    refetch,
  }
} 