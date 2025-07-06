'use client'

import { useState } from 'react'
import { X, Check, XIcon, FileText, Copy, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '../../components/Button'
import { AISuggestion } from '../types'

interface DiffModalProps {
  isOpen: boolean
  onClose: () => void
  suggestion: AISuggestion | null
  onAccept?: () => Promise<void>
  onReject?: () => Promise<void>
  className?: string
}

export function DiffModal({
  isOpen,
  onClose,
  suggestion,
  onAccept,
  onReject,
  className,
}: DiffModalProps) {
  const [isAccepting, setIsAccepting] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!isOpen || !suggestion) return null

  const handleAccept = async () => {
    if (!onAccept) return
    setIsAccepting(true)
    try {
      await onAccept()
      onClose()
    } finally {
      setIsAccepting(false)
    }
  }

  const handleReject = async () => {
    if (!onReject) return
    setIsRejecting(true)
    try {
      await onReject()
      onClose()
    } finally {
      setIsRejecting(false)
    }
  }

  const handleCopyDiff = async () => {
    try {
      await navigator.clipboard.writeText(suggestion.patchUnifiedDiff)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy diff:', error)
    }
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
        parsedLines.push({ type: 'header', content: line })
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
      } else if (line.trim()) {
        parsedLines.push({ type: 'context', content: line })
      }
    }

    return parsedLines
  }

  const diffLines = parseDiff(suggestion.patchUnifiedDiff)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={cn(
        "relative bg-white/95 backdrop-blur-xl rounded-[20px] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden",
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral/10">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-heading-lg text-neutral font-medium">
                Diff Preview
              </h2>
              <p className="text-body-sm text-neutral/60">
                {suggestion.filePath}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleCopyDiff}
              variant="ghost"
              size="sm"
              leadingIcon={<Copy className="w-4 h-4" />}
            >
              {copied ? 'Copied!' : 'Copy Diff'}
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-y-auto bg-neutral/5">
          <div className="font-geist-mono text-sm">
            {diffLines.map((line, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-start border-l-4 px-4 py-1",
                  line.type === 'header' && "bg-neutral/10 border-neutral/30 text-neutral/70",
                  line.type === 'hunk' && "bg-primary/10 border-primary/30 text-primary",
                  line.type === 'add' && "bg-success/10 border-success border-l-success text-neutral",
                  line.type === 'remove' && "bg-accent/10 border-accent border-l-accent text-neutral",
                  line.type === 'context' && "bg-transparent border-transparent text-neutral/80"
                )}
              >
                {/* Line Numbers */}
                <div className="flex items-center space-x-2 mr-4 text-neutral/50 text-xs font-medium min-w-[80px]">
                  {line.lineNumber && (
                    <>
                      <span className="w-8 text-right">
                        {line.lineNumber.old || ''}
                      </span>
                      <span className="w-8 text-right">
                        {line.lineNumber.new || ''}
                      </span>
                    </>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 whitespace-pre-wrap break-all">
                  {line.type === 'add' && <span className="text-success mr-2">+</span>}
                  {line.type === 'remove' && <span className="text-accent mr-2">-</span>}
                  {line.type === 'context' && line.lineNumber && <span className="text-neutral/30 mr-2"> </span>}
                  {line.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        {suggestion.status === 'pending' && (onAccept || onReject) && (
          <div className="flex items-center justify-between p-6 border-t border-neutral/10 bg-white/50">
            <div className="flex items-center space-x-4 text-caption text-neutral/60">
              {suggestion.confidence && (
                <span>Confidence: {Math.round(suggestion.confidence * 100)}%</span>
              )}
              {suggestion.modelUsed && (
                <span>Model: {suggestion.modelUsed}</span>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              {onReject && (
                <Button
                  onClick={handleReject}
                  disabled={isAccepting || isRejecting}
                  loading={isRejecting}
                  variant="outline"
                  size="md"
                  leadingIcon={<XIcon className="w-4 h-4" />}
                >
                  Reject
                </Button>
              )}
              {onAccept && (
                <Button
                  onClick={handleAccept}
                  disabled={isAccepting || isRejecting}
                  loading={isAccepting}
                  variant="primary"
                  size="md"
                  leadingIcon={<Check className="w-4 h-4" />}
                >
                  Accept Changes
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 