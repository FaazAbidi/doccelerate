'use client'

import { useState } from 'react'
import { Loader2, GitCommit } from 'lucide-react'
import { Button } from '@/app/components/Button'
import { TextInput } from '@/app/components/TextInput'
import { cn } from '@/lib/utils'
import { pushChangesToGithub } from '../actions/pushChangesToGithub'

interface CommitPromptProps {
  modifiedCount: number
  className?: string
  /**
   * Callback fired when commit succeeds. Provides new commit sha.
   */
  onCommitted?: (commitSha: string) => void
}

export function CommitPrompt({ modifiedCount, className, onCommitted }: CommitPromptProps) {
  const [commitMessage, setCommitMessage] = useState('Update docs')
  const [isCommitting, setIsCommitting] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isDismissed) return null

  const handleCommit = async () => {
    if (!commitMessage.trim()) return
    setIsCommitting(true)
    setError(null)
    try {
      const res = await pushChangesToGithub({ commitMessage })
      if (!res.success) {
        setError(res.message)
      } else {
        onCommitted?.(res.commitSha || '')
        setIsDismissed(true)
      }
    } catch (e: any) {
      setError(e.message || 'Commit failed')
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <div
      className={cn(
        'bg-primary/10 backdrop-blur-0 border border-primary/20 rounded-[20px] px-4 py-3',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <GitCommit className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <p className="text-caption text-neutral-800">
            {modifiedCount} file{modifiedCount !== 1 ? 's' : ''} modified
          </p>
          <p className="text-xs text-neutral/70">Commit your changes to GitHub</p>
          <div className="mt-2 flex items-center gap-2">
            <TextInput
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message"
              size="sm"
              className="flex-1"
            />
            <Button
              size="sm"
              variant="secondary"
              className="h-8"
              onClick={handleCommit}
              disabled={isCommitting}
            >
              {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Commit'}
            </Button>
          </div>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      </div>
    </div>
  )
} 