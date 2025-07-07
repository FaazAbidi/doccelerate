'use client'

import { useState, useCallback, useEffect } from 'react'
import { AISuggestion } from '../types'
import { 
  getSuggestions, 
  applyAndAcceptSuggestion,
  rejectSuggestion, 
  applySuggestion,
  addSuggestions,
  synchronizeSuggestionStatus
} from '../actions/manageSuggestions'

export function useAISuggestions() {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // First, synchronize any inconsistent statuses
      await synchronizeSuggestionStatus()
      
      // Then fetch the suggestions
      const data = await getSuggestions()
      setSuggestions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch suggestions')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleAcceptSuggestion = useCallback(async (suggestionId: string) => {
    try {
      await applyAndAcceptSuggestion(suggestionId)
      
      // Remove from local state since we only show pending suggestions
      setSuggestions(prev => 
        prev.filter(s => s.id !== suggestionId)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept suggestion')
      throw err
    }
  }, [])

  const handleRejectSuggestion = useCallback(async (suggestionId: string) => {
    try {
      await rejectSuggestion(suggestionId)
      
      // Remove from local state since we only show pending suggestions
      setSuggestions(prev => 
        prev.filter(s => s.id !== suggestionId)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject suggestion')
      throw err
    }
  }, [])

  const handleApplySuggestion = useCallback(async (suggestionId: string) => {
    try {
      await applySuggestion(suggestionId)
      
      // Remove from local state since we only show pending suggestions
      setSuggestions(prev => 
        prev.filter(s => s.id !== suggestionId)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply suggestion')
      throw err
    }
  }, [])

  const addNewSuggestions = useCallback(async (newSuggestions: AISuggestion[]) => {
    try {
      await addSuggestions(newSuggestions)
      
      // Update local state
      setSuggestions(prev => [...newSuggestions, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add suggestions')
      throw err
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Load suggestions on mount
  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  return {
    suggestions,
    isLoading,
    error,
    fetchSuggestions,
    acceptSuggestion: handleAcceptSuggestion,
    rejectSuggestion: handleRejectSuggestion,
    applySuggestion: handleApplySuggestion,
    addSuggestions: addNewSuggestions,
    clearError,
  }
} 