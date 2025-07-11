'use client'

import { useState } from 'react'
import { Loader2, GitCommit, ExternalLink } from 'lucide-react'
import { Button } from '@/app/components/Button'
import { TextInput } from '@/app/components/TextInput'
import { cn } from '@/lib/utils'
import { pushChangesToGithub } from '../actions/pushChangesToGithub'

interface CommitPromptProps {
  modifiedCount: number
  className?: string
  /**
   * Whether the user has GitHub connected
   */
  hasGithubConnection?: boolean
  /**
   * Callback fired when commit succeeds. Provides new commit sha.
   */
  onCommitted?: (commitSha: string) => void
}

export function CommitPrompt({ modifiedCount, className, hasGithubConnection = true, onCommitted }: CommitPromptProps) {
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

  const handleConnectGitHub = () => {
    window.location.href = '/repos'
  }

  // If GitHub is not connected, show connection prompt
  if (!hasGithubConnection) {
    return (
      <div
        className={cn(
          'bg-accent/5 backdrop-blur-0 border border-accent/20 rounded-[20px] px-4 py-3',
          className
        )}
      >
        <div className="flex flex-row items-center gap-2">
          <div className="w-5 h-5 text-accent flex items-center justify-center">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 flex flex-row items-center gap-2 justify-between">
            <div className="flex flex-col items-start">
            <p className="text-xs text-neutral">
              {modifiedCount} file{modifiedCount !== 1 ? 's' : ''} modified
            </p>
            <p className="text-xs text-neutral/70">Connect GitHub to commit your changes</p>
            </div>
            <div className="mt-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleConnectGitHub}
                className="h-2"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // If GitHub is connected, show commit interface
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
          <p className="text-caption text-neutral">
            {modifiedCount} file{modifiedCount !== 1 ? 's' : ''} modified
          </p>
          <p className="text-sm text-neutral">Commit your changes to GitHub</p>
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
          {error && <p className="text-xs text-primary w-52 mt-2">{error}</p>}
        </div>
      </div>
    </div>
  )
} 