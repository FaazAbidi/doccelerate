'use client'

import { FileText, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AISuggestion } from '../types'

interface AINavigationControlsProps {
  suggestions: AISuggestion[]
  currentFilePath: string | null
  onNavigateToFile: (filePath: string) => void
  className?: string
}

export function AINavigationControls({
  suggestions,
  currentFilePath,
  onNavigateToFile,
  className,
}: AINavigationControlsProps) {
  // Get unique file paths with pending suggestions
  const filesWithSuggestions = Array.from(new Set(
    suggestions
      .filter(s => s.status === 'pending')
      .map(s => s.filePath)
  )).sort()

  // Hide component entirely if there are no pending suggestions
  if (filesWithSuggestions.length === 0) return null

  const getFileName = (path: string) => {
    return path.split('/').pop() || path
  }

  const getSuggestionCount = (filePath: string) => {
    return suggestions.filter(s => s.filePath === filePath && s.status === 'pending').length
  }

  return (
    <div className={cn(
      "bg-primary/5 border border-primary/10 rounded-[16px] p-4 backdrop-blur-sm",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-heading-sm text-primary font-medium">AI Suggestions</h3>
        </div>
        <div className="bg-primary/10 rounded-full px-2 py-1">
          <span className="text-caption text-primary font-medium">
            {filesWithSuggestions.length} {filesWithSuggestions.length === 1 ? 'file' : 'files'}
          </span>
        </div>
      </div>

      {/* Current file info */}
      <div className="mb-3">
        {/*
          Display behaviour:
          1. If exactly one file has suggestions and none is open yet, show that
             file as a clickable row so the user can open it.
          2. If a file is already open, show its info.
          3. Otherwise show a prompt to select a file.
        */}
        {currentFilePath && filesWithSuggestions.includes(currentFilePath) ? (
          <div className="flex items-center space-x-2 text-neutral">
            <FileText className="w-4 h-4" />
            <span className="text-body-sm font-medium">{getFileName(currentFilePath)}</span>
            <span className="text-caption text-neutral/60">
              ({getSuggestionCount(currentFilePath)} suggestion{getSuggestionCount(currentFilePath) > 0 ? 's' : ''})
            </span>
          </div>
        ) : (
          <div className="text-body-sm text-neutral/60">
            Select a file to view AI suggestions
          </div>
        )}
      </div>

      {/* File list (when multiple files) */}
      {filesWithSuggestions.length > 0 && (
        <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
          {filesWithSuggestions.map((filePath) => (
            <button
              key={filePath}
              onClick={() => onNavigateToFile(filePath)}
              className={cn(
                "w-full text-left px-2 py-1 rounded-[8px] text-caption transition-colors",
                filePath === currentFilePath
                  ? "bg-primary/10 text-primary"
                  : "text-neutral/70 hover:bg-neutral/5 hover:text-neutral"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{getFileName(filePath)}</span>
                <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 ml-2">
                  {getSuggestionCount(filePath)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
} 