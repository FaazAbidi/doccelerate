'use client'

import { useState, useMemo } from 'react'
import { Filter, RefreshCw, CheckCircle, XCircle, Clock, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '../../components/Button'
import { Dropdown } from '../../components/Dropdown'
import { SuggestionCard } from './SuggestionCard'
import { DiffModal } from './DiffModal'
import { AISuggestion } from '../types'

interface SuggestionsPanelProps {
  suggestions: AISuggestion[]
  onAcceptSuggestion: (suggestionId: string) => Promise<void>
  onRejectSuggestion: (suggestionId: string) => Promise<void>
  onRefresh: () => Promise<void>
  isLoading?: boolean
  className?: string
}

type FilterStatus = 'all' | 'pending' | 'accepted' | 'rejected' | 'applied'

const filterOptions = [
  { value: 'all', label: 'All Suggestions' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'applied', label: 'Applied' },
]

export function SuggestionsPanel({
  suggestions,
  onAcceptSuggestion,
  onRejectSuggestion,
  onRefresh,
  isLoading = false,
  className,
}: SuggestionsPanelProps) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [selectedSuggestion, setSelectedSuggestion] = useState<AISuggestion | null>(null)
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false)

  const filteredSuggestions = useMemo(() => {
    if (filterStatus === 'all') return suggestions
    return suggestions.filter(suggestion => suggestion.status === filterStatus)
  }, [suggestions, filterStatus])

  const statusCounts = useMemo(() => {
    return suggestions.reduce((acc, suggestion) => {
      acc[suggestion.status] = (acc[suggestion.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [suggestions])

  const handleViewDiff = (suggestion: AISuggestion) => {
    setSelectedSuggestion(suggestion)
    setIsDiffModalOpen(true)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-primary" />
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-success" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-accent" />
      case 'applied':
        return <CheckCircle className="w-4 h-4 text-success" />
      default:
        return <FileText className="w-4 h-4 text-neutral" />
    }
  }

  return (
    <>
      <div className={cn("h-full flex flex-col", className)}>
        {/* Header */}
        <div className="p-6 border-b border-neutral/10 bg-white/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-heading-lg text-neutral font-medium">AI Suggestions</h2>
              <p className="text-body-sm text-neutral/60">
                Review and manage documentation edit suggestions
              </p>
            </div>
            <Button
              onClick={onRefresh}
              disabled={isLoading}
              loading={isLoading}
              variant="outline"
              size="sm"
              leadingIcon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-neutral/60" />
              <span className="text-body-sm text-neutral/70">Filter by status:</span>
            </div>
            <Dropdown
              options={filterOptions}
              value={filterStatus}
              onValueChange={(value) => setFilterStatus(value as FilterStatus)}
              size="sm"
              className="w-48"
            />
          </div>

          {/* Status Summary */}
          <div className="mt-4 flex items-center space-x-6">
            {filterOptions.slice(1).map((option) => (
              <div key={option.value} className="flex items-center space-x-1">
                {getStatusIcon(option.value)}
                <span className="text-caption text-neutral/70">
                  {statusCounts[option.value] || 0} {option.label.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredSuggestions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-neutral/20 mx-auto mb-4" />
              {suggestions.length === 0 ? (
                <>
                  <h3 className="text-heading-sm text-neutral/60 mb-2">No suggestions yet</h3>
                  <p className="text-body-sm text-neutral/50">
                    Use the AI Assistant to generate documentation suggestions
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-heading-sm text-neutral/60 mb-2">
                    No {filterStatus} suggestions
                  </h3>
                  <p className="text-body-sm text-neutral/50">
                    Try selecting a different filter to see more suggestions
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSuggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAccept={onAcceptSuggestion}
                  onReject={onRejectSuggestion}
                  onViewDiff={handleViewDiff}
                  isProcessing={isLoading}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Diff Modal */}
      <DiffModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        suggestion={selectedSuggestion}
        onAccept={selectedSuggestion ? () => onAcceptSuggestion(selectedSuggestion.id) : undefined}
        onReject={selectedSuggestion ? () => onRejectSuggestion(selectedSuggestion.id) : undefined}
      />
    </>
  )
} 