'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useIndexingStatus } from './hooks/useIndexingStatus'
import { useRealtimeUpdates } from './hooks/useRealtimeUpdates'
import { useAISuggestions } from './hooks/useAISuggestions'
import { IndexingPrompt } from './components/IndexingPrompt'
import { IndexingProgress } from './components/IndexingProgress'
import { PageLoader } from '../components/PageLoader'
import { DirectoryTreeSidebar } from './components/DirectoryTreeSidebar'
import { FileEditor } from './components/FileEditor'
import { AIChatbox } from './components/AIChatbox'
import { AINavigationControls } from './components/AINavigationControls'
import { sendAIQuery } from './actions/sendAIQuery'

export default function DocsPage() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileEditorKey, setFileEditorKey] = useState(0)
  // Track whether the sidebar is open to adjust editor width
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  // Track AI query processing state (boolean kept for legacy logic)
  const [isProcessingQuery, setIsProcessingQuery] = useState(false)
  // New status for AI queries to drive chatbox feedback
  const [queryStatus, setQueryStatus] = useState<'idle' | 'processing' | 'no_suggestions' | 'error'>('idle')
  const [currentQueryTaskId, setCurrentQueryTaskId] = useState<string | null>(null)
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  
  const { 
    status, 
    isLoading, 
    indexingState,
    isStartingIndexing, 
    isIndexing,
    indexingError, 
    indexingProgress,
    startIndexing,
    retryIndexing,
    cancelIndexing
  } = useIndexingStatus()

  const {
    suggestions,
    isLoading: isSuggestionsLoading,
    error: suggestionsError,
    fetchSuggestions,
    acceptSuggestion,
    rejectSuggestion,
    addSuggestions,
    clearError
  } = useAISuggestions()

  // Handle file updates from realtime
  const handleFileUpdated = useCallback((filePath: string) => {
    if (selectedFile === filePath) {
      // Force re-render of the file editor to reload content
      setFileEditorKey(prev => prev + 1)
    }
  }, [selectedFile])

  const handleFileDeleted = useCallback((filePath: string) => {
    if (selectedFile === filePath) {
      // Close the editor if the currently open file was deleted
      setSelectedFile(null)
    }
  }, [selectedFile])

  // Handle new suggestions from realtime
  const handleNewSuggestions = useCallback(async (repoId: string, suggestionCount: number) => {
    console.log('New suggestions received, refreshing...')
    // Refresh the suggestions list when new ones are created
    await fetchSuggestions()
  }, [fetchSuggestions])

  // Handle query completion notifications
  const handleQueryCompleted = useCallback((repoId: string, taskId: string, suggestionsCreated: number, message?: string) => {
    console.log('🎯 handleQueryCompleted called:', { repoId, taskId, suggestionsCreated, message })
    console.log('🎯 isProcessingQuery before reset:', isProcessingQuery)

    // Clear the safety timeout since the query completed successfully
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current)
      processingTimeoutRef.current = null
    }

    // Clear the current query task ID since it's completed
    setCurrentQueryTaskId(null)

    // Decide resulting UI status
    const defaultSuccess = suggestionsCreated > 0
      ? `Query completed with ${suggestionsCreated} suggestion${suggestionsCreated === 1 ? '' : 's'}.`
      : 'Query completed but no suggestions were found.'

    const finalMessage = message || defaultSuccess

    if (finalMessage.toLowerCase().includes('failed')) {
      setQueryStatus('error')
    } else if (suggestionsCreated === 0) {
      setQueryStatus('no_suggestions')
    } else {
      setQueryStatus('idle')
    }

    // Stop processing indicator
    console.log('🎯 Setting isProcessingQuery to false')
    setIsProcessingQuery(false)

    // Note: We don't manually call fetchSuggestions() here anymore
    // The suggestions should already be refreshed by the handleNewSuggestions callback
    // which is triggered by the useRealtimeUpdates hook when new suggestions are created
  }, [isProcessingQuery])

  // Setup realtime updates for the docs page
  const { hasActiveQueryJobs, activeQueryJobs } = useRealtimeUpdates({
    callbacks: {
      onFileUpdated: handleFileUpdated,
      onFileDeleted: handleFileDeleted,
      onNewSuggestions: handleNewSuggestions,
      onQueryCompleted: handleQueryCompleted,
    },
    currentQueryTaskId
  })

  // Recovery mechanism: Set processing state if there are active query jobs but no currentQueryTaskId
  const recoveryTriggeredRef = useRef(false)
  
  useEffect(() => {
    if (hasActiveQueryJobs && !currentQueryTaskId && !isProcessingQuery && !recoveryTriggeredRef.current) {
      console.log('🔄 Recovery: Found active query jobs, setting processing state')
      console.log('🔄 Active jobs:', activeQueryJobs.map(job => ({ id: job.task_id, status: job.status })))
      
      recoveryTriggeredRef.current = true
      setIsProcessingQuery(true)
      setQueryStatus('processing')
      
      // Optionally, set the currentQueryTaskId to the most recent active job
      if (activeQueryJobs.length > 0) {
        const mostRecentJob = activeQueryJobs[0] // getActiveJobs returns jobs ordered by created_at desc
        console.log('🔄 Setting currentQueryTaskId to most recent active job:', mostRecentJob.task_id)
        setCurrentQueryTaskId(mostRecentJob.task_id)
      }
    }
    
    // Reset recovery flag when there are no active jobs
    if (!hasActiveQueryJobs) {
      recoveryTriggeredRef.current = false
    }
  }, [hasActiveQueryJobs, currentQueryTaskId, isProcessingQuery, activeQueryJobs])

  // Handle AI query submission
  const handleSendQuery = useCallback(async (message: string) => {
    console.log('🚀 handleSendQuery called with message:', message)
    console.log('🚀 Setting isProcessingQuery to true')
    setIsProcessingQuery(true)
    setQueryStatus('processing')
    
    // Set a safety timeout to clear processing state after 60 seconds
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current)
    }
    processingTimeoutRef.current = setTimeout(() => {
      console.log('⏰ Safety timeout: Clearing isProcessingQuery after 60 seconds')
      setCurrentQueryTaskId(null)
      setIsProcessingQuery(false)
      setQueryStatus('error')
    }, 60000) // 60 seconds
    
    try {
      const response = await sendAIQuery(message)
      
      // Log the query response for debugging
      console.log('🚀 Query submitted successfully:', response)
      const taskId = response.taskId || null
      console.log('🚀 Setting currentQueryTaskId to:', taskId)
      setCurrentQueryTaskId(taskId)
      
      // The API now returns 202 Accepted with a task_id
      // Suggestions will come later via real-time updates
      // So we don't need to add suggestions immediately anymore
      
    } catch (error) {
      console.error('Failed to process AI query:', error)
      console.log('🚀 Query failed, setting isProcessingQuery to false')
      // Clear the timeout since we're handling the error immediately
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
        processingTimeoutRef.current = null
      }
      setCurrentQueryTaskId(null)
      setIsProcessingQuery(false)
      setQueryStatus('error')
      // TODO: Add proper error notification/toast
    }
    // Note: Don't set isProcessingQuery to false here - let the completion handler do it
  }, []) // Removed addSuggestions dependency since we don't use it anymore

  // Handle navigation to files with suggestions
  const handleNavigateToFile = useCallback((filePath: string) => {
    setSelectedFile(filePath)
    setFileEditorKey(prev => prev + 1) // Force re-render
  }, [])

  // Check if current file has pending suggestions
  const currentFileHasSuggestions = selectedFile && suggestions.some(
    s => s.filePath === selectedFile && s.status === 'pending'
  )

  // Handle suggestion acceptance/rejection (now handled by FileEditor)
  const handleAcceptSuggestion = useCallback(async (suggestionId: string) => {
    await acceptSuggestion(suggestionId)
  }, [acceptSuggestion])

  const handleRejectSuggestion = useCallback(async (suggestionId: string) => {
    await rejectSuggestion(suggestionId)
  }, [rejectSuggestion])

  // Handle accepting all suggestions for a file
  const handleAcceptAllSuggestions = useCallback(async (filePath: string) => {
    const fileSuggestions = suggestions.filter(
      s => s.filePath === filePath && s.status === 'pending'
    )
    
    for (const suggestion of fileSuggestions) {
      await acceptSuggestion(suggestion.id)
    }
  }, [suggestions, acceptSuggestion])

  // Handle rejecting all suggestions for a file
  const handleRejectAllSuggestions = useCallback(async (filePath: string) => {
    const fileSuggestions = suggestions.filter(
      s => s.filePath === filePath && s.status === 'pending'
    )
    
    for (const suggestion of fileSuggestions) {
      await rejectSuggestion(suggestion.id)
    }
  }, [suggestions, rejectSuggestion])

  // Determine if there are any pending suggestions
  const hasPendingSuggestions = suggestions.some(s => s.status === 'pending')

  // Show navigation only when there are pending suggestions
  const showAINavigation = hasPendingSuggestions

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
      }
    }
  }, [])

  if (isLoading) {
    return <PageLoader message="Checking repository status..." />
  }

  // Show indexing progress if actively indexing
  if (isIndexing && indexingProgress) {
    return (
      <div className="h-screen bg-transparent flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <IndexingProgress
          progress={indexingProgress}
          onCancel={cancelIndexing}
          onRetry={retryIndexing}
        />
      </div>
    )
  }

  // Show completion progress
  if (indexingState.phase === 'completed' && indexingProgress) {
    return (
      <div className="h-screen bg-transparent flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <IndexingProgress
          progress={indexingProgress}
          onRetry={retryIndexing}
        />
      </div>
    )
  }

  // Show failure progress
  if (indexingState.phase === 'failed' && indexingProgress) {
    return (
      <div className="h-screen bg-transparent flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <IndexingProgress
          progress={indexingProgress}
          onRetry={retryIndexing}
        />
      </div>
    )
  }

  // Show documentation editor when repository is indexed
  if (status?.isIndexed && indexingState.phase === 'idle') {
    return (
      <div className="h-screen bg-transparent overflow-hidden">
        {/* Sidebar & AI navigation stacked */}
        <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-4">
          <DirectoryTreeSidebar
            onFileSelect={setSelectedFile}
            selectedFile={selectedFile ?? undefined}
            onOpenChange={setIsSidebarOpen}
            hasSuggestions={showAINavigation}
            floating={false}
            onStartReIndexing={async () => {
              await startIndexing()
            }}
          />

          {showAINavigation && (
            <AINavigationControls
              suggestions={suggestions}
              currentFilePath={selectedFile}
              onNavigateToFile={handleNavigateToFile}
              className="w-80"
            />
          )}
        </div>
        
        {/* Main Editor Area */}
        <div className="fixed right-10 top-24 h-full w-full">
          <div
            className="h-[calc(100vh-250px)] ml-auto transition-all duration-300 ease-in-out relative"
            style={{ width: isSidebarOpen ? 'calc(100vw - 400px)' : 'calc(100vw - 120px)' }}
          >
            <FileEditor
              key={fileEditorKey}
              filePath={selectedFile}
              onClose={() => setSelectedFile(null)}
              theme="light"
              suggestions={suggestions}
              onAcceptSuggestion={handleAcceptSuggestion}
              onRejectSuggestion={handleRejectSuggestion}
              onAcceptAllSuggestions={handleAcceptAllSuggestions}
              onRejectAllSuggestions={handleRejectAllSuggestions}
            />
          </div>
        </div>

        {/* AI Chatbox */}
        <AIChatbox
          onSendQuery={handleSendQuery}
          status={queryStatus}
        />
      </div>
    )
  }

  // Show indexing prompt for repositories that need indexing
  return (
    <div className="h-screen bg-transparent flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-center">
        <IndexingPrompt
          status={status!}
          isStartingIndexing={isStartingIndexing}
          indexingError={indexingError}
          onStartIndexing={async () => {
            await startIndexing()
          }}
          onStartReIndexing={async () => {
            await startIndexing()
          }}
        />
      </div>
    </div>
  )
} 