'use client'

import { ChevronLeft, ChevronRight, FileText, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '../../components/Button'
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

  if (filesWithSuggestions.length === 0) return null

  const currentIndex = currentFilePath 
    ? filesWithSuggestions.indexOf(currentFilePath)
    : -1

  const goToNext = () => {
    const nextIndex = currentIndex >= filesWithSuggestions.length - 1 ? 0 : currentIndex + 1
    onNavigateToFile(filesWithSuggestions[nextIndex])
  }

  const goToPrevious = () => {
    const prevIndex = currentIndex <= 0 ? filesWithSuggestions.length - 1 : currentIndex - 1
    onNavigateToFile(filesWithSuggestions[prevIndex])
  }

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
        {currentFilePath && filesWithSuggestions.includes(currentFilePath) ? (
          <div className="flex items-center space-x-2 text-neutral">
            <FileText className="w-4 h-4" />
            <span className="text-body-sm font-medium">{getFileName(currentFilePath)}</span>
            <span className="text-caption text-neutral/60">
              ({getSuggestionCount(currentFilePath)} suggestion{getSuggestionCount(currentFilePath) > 1 ? 's' : ''})
            </span>
          </div>
        ) : (
          <div className="text-body-sm text-neutral/60">
            Select a file to view AI suggestions
          </div>
        )}
      </div>

      {/* Navigation controls */}
      <div className="flex items-center space-x-2">
        <Button
          onClick={goToPrevious}
          disabled={filesWithSuggestions.length <= 1}
          variant="outline"
          size="sm"
          leadingIcon={<ChevronLeft className="w-4 h-4" />}
          className="flex-1"
        >
          Previous
        </Button>
        
        <div className="flex-shrink-0 bg-white/50 rounded-[12px] px-3 py-1">
          <span className="text-caption text-neutral/70">
            {currentIndex >= 0 ? currentIndex + 1 : 0} of {filesWithSuggestions.length}
          </span>
        </div>

        <Button
          onClick={goToNext}
          disabled={filesWithSuggestions.length <= 1}
          variant="outline"
          size="sm"
          trailingIcon={<ChevronRight className="w-4 h-4" />}
          className="flex-1"
        >
          Next
        </Button>
      </div>

      {/* File list (when multiple files) */}
      {filesWithSuggestions.length > 1 && (
        <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
          {filesWithSuggestions.map((filePath, index) => (
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

      {/* Keyboard shortcuts hint */}
      <div className="mt-3 pt-3 border-t border-primary/10">
        <div className="text-caption text-neutral/50 text-center">
          Use ← → arrows to navigate • Enter to accept • Esc to reject
        </div>
      </div>
    </div>
  )
} 