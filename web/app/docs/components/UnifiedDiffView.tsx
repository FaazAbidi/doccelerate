'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface UnifiedDiffViewProps {
  originalContent: string
  currentContent: string
  filePath: string
  className?: string
}

// Generate unified diff format
function generateUnifiedDiff(original: string, current: string) {
  const originalLines = original.split('\n')
  const currentLines = current.split('\n')
  
  // Simple LCS-based diff algorithm
  const diff = []
  let i = 0, j = 0
  
  while (i < originalLines.length || j < currentLines.length) {
    if (i < originalLines.length && j < currentLines.length) {
      if (originalLines[i] === currentLines[j]) {
        // Same line - add as context
        diff.push({ type: 'context', content: originalLines[i], originalLine: i + 1, currentLine: j + 1 })
        i++
        j++
      } else {
        // Different lines - look ahead to find if this is a modification or insertion/deletion
        let found = false
        
        // Check if current line appears later in original (insertion)
        for (let k = i + 1; k < Math.min(i + 5, originalLines.length); k++) {
          if (originalLines[k] === currentLines[j]) {
            // Lines were deleted from original
            while (i < k) {
              diff.push({ type: 'removed', content: originalLines[i], originalLine: i + 1, currentLine: null })
              i++
            }
            found = true
            break
          }
        }
        
        if (!found) {
          // Check if original line appears later in current (deletion)
          for (let k = j + 1; k < Math.min(j + 5, currentLines.length); k++) {
            if (currentLines[k] === originalLines[i]) {
              // Lines were added to current
              while (j < k) {
                diff.push({ type: 'added', content: currentLines[j], originalLine: null, currentLine: j + 1 })
                j++
              }
              found = true
              break
            }
          }
        }
        
        if (!found) {
          // Simple replacement
          diff.push({ type: 'removed', content: originalLines[i], originalLine: i + 1, currentLine: null })
          diff.push({ type: 'added', content: currentLines[j], originalLine: null, currentLine: j + 1 })
          i++
          j++
        }
      }
    } else if (i < originalLines.length) {
      // Only in original (removed)
      diff.push({ type: 'removed', content: originalLines[i], originalLine: i + 1, currentLine: null })
      i++
    } else {
      // Only in current (added)
      diff.push({ type: 'added', content: currentLines[j], originalLine: null, currentLine: j + 1 })
      j++
    }
  }
  
  return diff
}

export function UnifiedDiffView({ originalContent, currentContent, filePath, className = '' }: UnifiedDiffViewProps) {
  const diffLines = useMemo(() => {
    return generateUnifiedDiff(originalContent, currentContent)
  }, [originalContent, currentContent])

  const hasChanges = originalContent !== currentContent

  if (!hasChanges) {
    return (
      <div className={cn("h-full flex items-center justify-center", className)}>
        <div className="text-center py-8 text-neutral/60">
          <p className="text-body-md">No changes have been made to this file.</p>
          <p className="text-body-sm mt-2">Edit the content in the Editor tab to see differences here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("h-full overflow-y-auto scrollbar p-6", className)}>
      <div className="bg-neutral-900 text-neutral-100 p-6 rounded-lg font-mono text-sm overflow-x-auto">
        {/* Diff header */}
        <div className="mb-4 text-neutral-400 border-b border-neutral-700 pb-3">
          <div className="text-neutral-300 font-medium mb-2">File: {filePath}</div>
          <div>--- a/{filePath}</div>
          <div>+++ b/{filePath}</div>
        </div>
        
        {/* Diff content */}
        <div className="space-y-0">
          {diffLines.map((line, index) => (
            <div
              key={index}
              className={cn(
                "flex items-start leading-relaxed",
                line.type === 'added' && "text-green-400 bg-green-400/10",
                line.type === 'removed' && "text-red-400 bg-red-400/10",
                line.type === 'context' && "text-neutral-300"
              )}
            >
              <span className="w-8 flex-shrink-0 text-center select-none opacity-60">
                {line.type === 'added' && '+'}
                {line.type === 'removed' && '-'}
                {line.type === 'context' && ' '}
              </span>
              <span className="flex-1 whitespace-pre-wrap break-words px-2">
                {line.content || ' '}
              </span>
            </div>
          ))}
        </div>
        
        {/* Summary */}
        <div className="mt-6 pt-3 border-t border-neutral-700 text-neutral-400 text-xs">
          {diffLines.filter(l => l.type === 'added').length} additions, {diffLines.filter(l => l.type === 'removed').length} deletions
        </div>
      </div>
    </div>
  )
} 