'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'

export interface IndexingNotification {
  repo_id: string
  task_id?: string
  status: 'completed' | 'failed'
  error?: string
}

interface UseRealtimeIndexingProps {
  onIndexingComplete?: (notification: IndexingNotification) => void
  onIndexingFailed?: (notification: IndexingNotification) => void
  enabled?: boolean
}

export function useRealtimeIndexing({ 
  onIndexingComplete, 
  onIndexingFailed,
  enabled = true 
}: UseRealtimeIndexingProps) {
  
  const handleRealtimeEvent = useCallback((payload: any) => {
    console.log('Received indexing notification:', payload)
    
    const notification: IndexingNotification = {
      repo_id: payload.new?.repo_id || payload.payload || 'unknown',
      status: payload.new?.status || 'completed',
      error: payload.new?.error
    }
    
    if (notification.status === 'completed') {
      onIndexingComplete?.(notification)
    } else if (notification.status === 'failed') {
      onIndexingFailed?.(notification)
    }
  }, [onIndexingComplete, onIndexingFailed])

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    
    // Subscribe to the repo_indexed channel
    const channel = supabase
      .channel('repo_indexed')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'repo'
      }, handleRealtimeEvent)
      .on('broadcast', {
        event: 'repo_indexed'
      }, handleRealtimeEvent)
      .subscribe()

    console.log('Subscribed to repo_indexed channel')

    return () => {
      console.log('Unsubscribing from repo_indexed channel')
      supabase.removeChannel(channel)
    }
  }, [enabled, handleRealtimeEvent])
} 