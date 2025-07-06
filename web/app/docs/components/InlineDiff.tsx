'use client'

import { useState } from 'react'
import { Check, X, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '../../components/Button'
import { AISuggestion } from '../types'

interface InlineDiffProps {
  suggestions: AISuggestion[]
  filePath: string
  onAcceptSuggestion: (suggestionId: string) => Promise<void>
  onRejectSuggestion: (suggestionId: string) => Promise<void>
  onClose: () => void
  className?: string
}

export function InlineDiff({
  suggestions,
  filePath,
  onAcceptSuggestion,
  onRejectSuggestion,
  onClose,
  className,
}: InlineDiffProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  const fileSuggestions = suggestions.filter(s => 
    s.filePath === filePath && s.status === 'pending'
  )

  if (fileSuggestions.length === 0) return null

  const currentSuggestion = fileSuggestions[currentIndex]

  const handleAccept = async () => {
    setIsProcessing(true)
    try {
      await onAcceptSuggestion(currentSuggestion.id)
      
      // Move to next suggestion or close if this was the last one
      if (currentIndex >= fileSuggestions.length - 1) {
        onClose()
      } else {
        setCurrentIndex(prev => Math.min(prev, fileSuggestions.length - 2))
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    setIsProcessing(true)
    try {
      await onRejectSuggestion(currentSuggestion.id)
      
      // Move to next suggestion or close if this was the last one
      if (currentIndex >= fileSuggestions.length - 1) {
        onClose()
      } else {
        setCurrentIndex(prev => Math.min(prev, fileSuggestions.length - 2))
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const goToNext = () => {
    setCurrentIndex(prev => Math.min(prev + 1, fileSuggestions.length - 1))
  }

  const goToPrevious = () => {
    setCurrentIndex(prev => Math.max(prev - 1, 0))
  }

  const parseDiff = (diff: string) => {
    const lines = diff.split('\n')
    const parsedLines: Array<{
      type: 'header' | 'context' | 'add' | 'remove' | 'hunk'
      content: string
      lineNumber?: { old?: number; new?: number }
    }> = []

    let oldLineNumber = 1
    let newLineNumber = 1

    for (const line of lines) {
      if (line.startsWith('+++') || line.startsWith('---')) {
        continue // Skip file headers
      } else if (line.startsWith('@@')) {
        parsedLines.push({ type: 'hunk', content: line })
        // Parse hunk header to reset line numbers
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/)
        if (match) {
          oldLineNumber = parseInt(match[1])
          newLineNumber = parseInt(match[2])
        }
      } else if (line.startsWith('+')) {
        parsedLines.push({
          type: 'add',
          content: line.substring(1),
          lineNumber: { new: newLineNumber++ }
        })
      } else if (line.startsWith('-')) {
        parsedLines.push({
          type: 'remove',
          content: line.substring(1),
          lineNumber: { old: oldLineNumber++ }
        })
      } else if (line.startsWith(' ')) {
        parsedLines.push({
          type: 'context',
          content: line.substring(1),
          lineNumber: { old: oldLineNumber++, new: newLineNumber++ }
        })
      }
    }

    return parsedLines
  }

  const diffLines = parseDiff(currentSuggestion.patchUnifiedDiff)

  return (
    <div className={cn(
      "absolute inset-0 bg-white/95 backdrop-blur-sm border border-primary/20 rounded-[12px] overflow-hidden z-50",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral/10 bg-primary/5">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
            <span className="text-white text-caption font-bold">AI</span>
          </div>
          <div>
            <h3 className="text-heading-sm text-neutral font-medium">
              Suggested Change {currentIndex + 1} of {fileSuggestions.length}
            </h3>
            <p className="text-caption text-neutral/60">
              {currentSuggestion.confidence && 
                `${Math.round(currentSuggestion.confidence * 100)}% confident`
              }
              {currentSuggestion.modelUsed && currentSuggestion.confidence && ' • '}
              {currentSuggestion.modelUsed && `${currentSuggestion.modelUsed}`}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Navigation */}
          {fileSuggestions.length > 1 && (
            <div className="flex items-center space-x-1">
              <Button
                onClick={goToPrevious}
                disabled={currentIndex === 0}
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                onClick={goToNext}
                disabled={currentIndex === fileSuggestions.length - 1}
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Actions */}
          <Button
            onClick={handleReject}
            disabled={isProcessing}
            variant="ghost"
            size="sm"
            leadingIcon={<X className="w-4 h-4" />}
          >
            Reject
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isProcessing}
            loading={isProcessing}
            variant="primary"
            size="sm"
            leadingIcon={<Check className="w-4 h-4" />}
          >
            Accept
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Diff Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="font-geist-mono text-sm">
          {diffLines.map((line, index) => (
            <div
              key={index}
              className={cn(
                "flex items-start px-4 py-1",
                line.type === 'hunk' && "bg-primary/10 text-primary font-medium",
                line.type === 'add' && "bg-success/10 text-neutral",
                line.type === 'remove' && "bg-accent/10 text-neutral line-through",
                line.type === 'context' && "bg-transparent text-neutral/80"
              )}
            >
              {/* Line Numbers */}
              <div className="flex items-center space-x-2 mr-4 text-neutral/50 text-xs font-medium min-w-[60px]">
                {line.lineNumber && (
                  <>
                    <span className="w-6 text-right">
                      {line.lineNumber.old || ''}
                    </span>
                    <span className="w-6 text-right">
                      {line.lineNumber.new || ''}
                    </span>
                  </>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 whitespace-pre-wrap">
                {line.type === 'add' && <span className="text-success mr-2 font-bold">+</span>}
                {line.type === 'remove' && <span className="text-accent mr-2 font-bold">-</span>}
                {line.type === 'context' && line.lineNumber && <span className="text-neutral/30 mr-2"> </span>}
                {line.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-neutral/10 bg-surface/50">
        <div className="flex items-center justify-between text-caption text-neutral/60">
          <div className="flex items-center space-x-4">
            <span>
              {new Date(currentSuggestion.createdAt).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
          <div className="flex items-center space-x-1 text-primary">
            <RotateCcw className="w-3 h-3" />
            <span>Press Enter to accept, Esc to reject</span>
          </div>
        </div>
      </div>
    </div>
  )
} 