'use client'

import { useState } from 'react'
import { Check, X, Eye, FileText, Clock, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '../../components/Button'
import { AISuggestion } from '../types'

interface SuggestionCardProps {
  suggestion: AISuggestion
  onAccept: (suggestionId: string) => Promise<void>
  onReject: (suggestionId: string) => Promise<void>
  onViewDiff: (suggestion: AISuggestion) => void
  isProcessing?: boolean
  className?: string
}

export function SuggestionCard({ 
  suggestion, 
  onAccept, 
  onReject, 
  onViewDiff, 
  isProcessing = false,
  className 
}: SuggestionCardProps) {
  const [isAccepting, setIsAccepting] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)

  const handleAccept = async () => {
    setIsAccepting(true)
    try {
      await onAccept(suggestion.id)
    } finally {
      setIsAccepting(false)
    }
  }

  const handleReject = async () => {
    setIsRejecting(true)
    try {
      await onReject(suggestion.id)
    } finally {
      setIsRejecting(false)
    }
  }

  const getStatusIcon = () => {
    switch (suggestion.status) {
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-success" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-accent" />
      case 'applied':
        return <CheckCircle className="w-4 h-4 text-success" />
      default:
        return <Clock className="w-4 h-4 text-primary" />
    }
  }

  const getStatusText = () => {
    switch (suggestion.status) {
      case 'accepted':
        return 'Accepted'
      case 'rejected':
        return 'Rejected'
      case 'applied':
        return 'Applied'
      default:
        return 'Pending Review'
    }
  }

  const getStatusColor = () => {
    switch (suggestion.status) {
      case 'accepted':
        return 'text-success'
      case 'rejected':
        return 'text-accent'
      case 'applied':
        return 'text-success'
      default:
        return 'text-primary'
    }
  }

  const getFileName = (path: string) => {
    return path.split('/').pop() || path
  }

  const getFilePath = (path: string) => {
    const parts = path.split('/')
    if (parts.length <= 1) return ''
    return parts.slice(0, -1).join('/')
  }

  return (
    <div className={cn(
      "bg-white/80 backdrop-blur-sm border border-neutral/10 rounded-[20px] p-6 transition-all duration-300 hover:shadow-lg",
      suggestion.status === 'accepted' && "border-success/20 bg-success/5",
      suggestion.status === 'rejected' && "border-accent/20 bg-accent/5",
      suggestion.status === 'applied' && "border-success/20 bg-success/5",
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-heading-sm text-neutral font-medium">
              {getFileName(suggestion.filePath)}
            </h3>
            {getFilePath(suggestion.filePath) && (
              <p className="text-caption text-neutral/60">
                {getFilePath(suggestion.filePath)}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {suggestion.confidence && (
            <span className="text-caption text-neutral/60">
              {Math.round(suggestion.confidence * 100)}% confident
            </span>
          )}
          <div className="flex items-center space-x-1">
            {getStatusIcon()}
            <span className={cn("text-caption font-medium", getStatusColor())}>
              {getStatusText()}
            </span>
          </div>
        </div>
      </div>

      {/* Diff Preview */}
      <div className="mb-4">
        <div className="bg-neutral/5 rounded-[12px] p-3 border border-neutral/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-neutral/70 font-medium">Changes Preview</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDiff(suggestion)}
              leadingIcon={<Eye className="w-3 h-3" />}
              className="text-caption"
            >
              View Full Diff
            </Button>
          </div>
          <div className="bg-white rounded-[8px] p-2 max-h-24 overflow-hidden">
            <pre className="text-code text-neutral/80 whitespace-pre-wrap">
              {suggestion.patchUnifiedDiff.split('\n').slice(0, 3).join('\n')}
              {suggestion.patchUnifiedDiff.split('\n').length > 3 && '\n...'}
            </pre>
          </div>
        </div>
      </div>

      {/* Actions */}
      {suggestion.status === 'pending' && (
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleAccept}
            disabled={isProcessing || isAccepting || isRejecting}
            loading={isAccepting}
            variant="primary"
            size="sm"
            leadingIcon={<Check className="w-4 h-4" />}
            className="flex-1"
          >
            Accept
          </Button>
          <Button
            onClick={handleReject}
            disabled={isProcessing || isAccepting || isRejecting}
            loading={isRejecting}
            variant="outline"
            size="sm"
            leadingIcon={<X className="w-4 h-4" />}
            className="flex-1"
          >
            Reject
          </Button>
        </div>
      )}

      {/* Metadata */}
      <div className="mt-4 pt-4 border-t border-neutral/10 flex items-center justify-between text-caption text-neutral/60">
        <div className="flex items-center space-x-4">
          {suggestion.modelUsed && (
            <span>Model: {suggestion.modelUsed}</span>
          )}
          <span>
            {new Date(suggestion.createdAt).toLocaleDateString()} at {' '}
            {new Date(suggestion.createdAt).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
      </div>
    </div>
  )
} 