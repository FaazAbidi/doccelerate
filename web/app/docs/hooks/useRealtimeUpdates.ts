'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { getJobByTaskId, getActiveJobs } from '../actions/getJobStatus'

interface RealtimeUpdateCallbacks {
  onFileUpdated?: (filePath: string) => void
  onFileAdded?: (filePath: string) => void
  onFileDeleted?: (filePath: string) => void
  onDirectoryTreeChanged?: () => void
  onNewSuggestions?: (repoId: string, suggestionCount: number) => void
  onQueryCompleted?: (repoId: string, taskId: string, suggestionsCreated: number, message?: string) => void
}

interface UseRealtimeUpdatesProps {
  callbacks: RealtimeUpdateCallbacks
  currentQueryTaskId?: string | null // Track specific query task
}

export function useRealtimeUpdates({ callbacks, currentQueryTaskId }: UseRealtimeUpdatesProps) {
  const { data: session } = useSession()

  // Check for any active query jobs (for recovery after page reload)
  const { data: activeQueryJobs } = useQuery({
    queryKey: ['active-query-jobs'],
    queryFn: () => getActiveJobs('query'),
    enabled: !!session?.user?.id,
    refetchInterval: !currentQueryTaskId ? 5000 : false, // Only poll if we don't have a specific task_id
    refetchOnWindowFocus: true, // Check when user comes back to the page
    staleTime: 0, // Always fetch fresh data for recovery
  })

  // Poll for the specific query job status every 2 seconds when we have a task_id
  const { data: currentJob } = useQuery({
    queryKey: ['query-job-status', currentQueryTaskId],
    queryFn: () => currentQueryTaskId ? getJobByTaskId(currentQueryTaskId) : null,
    enabled: !!session?.user?.id && !!currentQueryTaskId,
    refetchInterval: 2000, // Poll every 2 seconds for active query
    refetchOnWindowFocus: false,
  })

  // Handle job completion
  useEffect(() => {
    if (!currentJob || !callbacks.onQueryCompleted || !currentQueryTaskId) return

    console.log(`🔍 Checking job ${currentQueryTaskId}: status=${currentJob.status}`)

    // Only trigger callback when job is completed or failed
    if (currentJob.status === 'completed' || currentJob.status === 'failed') {
      console.log('✅ Job completed, triggering callback')

      if (currentJob.status === 'completed') {
        // Extract suggestion count from metadata
        const suggestionsCreated = currentJob.metadata?.suggestions_created || 0
        const repoId = currentJob.metadata?.repo_id || 'unknown'
        
        let message: string
        if (suggestionsCreated === 0) {
          message = 'Query completed but no suggestions were found. Try rephrasing your request or check if the repository contains relevant content.'
        } else {
          message = `Query completed! Found ${suggestionsCreated} suggestion${suggestionsCreated === 1 ? '' : 's'}.`
        }

        console.log('🎯 Triggering onQueryCompleted callback:', { repoId, taskId: currentJob.task_id, suggestionsCreated, message })
        callbacks.onQueryCompleted(repoId, currentJob.task_id, suggestionsCreated, message)
        
        // If suggestions were created, trigger the new suggestions callback
        if (suggestionsCreated > 0 && callbacks.onNewSuggestions) {
          callbacks.onNewSuggestions(repoId, suggestionsCreated)
        }
      } else if (currentJob.status === 'failed') {
        const repoId = currentJob.metadata?.repo_id || 'unknown'
        const errorMessage = currentJob.error_msg || 'Query failed due to an unexpected error.'
        
        console.log('❌ Triggering onQueryCompleted callback for failed job:', { repoId, taskId: currentJob.task_id, errorMessage })
        callbacks.onQueryCompleted(repoId, currentJob.task_id, 0, errorMessage)
      }
    }
  }, [currentJob, callbacks, currentQueryTaskId])

  // Cleanup function for manual unsubscribe (for compatibility)
  const cleanup = () => {
    // No longer needed since we're using React Query
  }

  return { 
    cleanup,
    hasActiveQueryJobs: activeQueryJobs && activeQueryJobs.length > 0,
    activeQueryJobs: activeQueryJobs || []
  }
} 