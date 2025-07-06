'use client'

import { FileSearch, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Card } from '@/app/components/Card'
import { Button } from '@/app/components/Button'

export interface IndexingProgress {
  step: string
  progress: number
  status: 'PROGRESS' | 'SUCCESS' | 'FAILURE'
  task_id?: string
  repo?: string
  branch?: string
  directory?: string
}

interface IndexingProgressProps {
  progress: IndexingProgress
  onCancel?: () => void
  onRetry?: () => void
}

const PROGRESS_STEPS = {
  'starting': { label: 'Starting indexing process', description: 'Initializing...' },
  'cloning': { label: 'Cloning repository', description: 'Downloading latest changes' },
  'processing_files': { label: 'Processing files', description: 'Analyzing documentation files' },
  'generating_embeddings': { label: 'Generating embeddings', description: 'Creating vector embeddings with AI' },
  'storing_data': { label: 'Storing data', description: 'Saving to database' },
  'merkle_tree': { label: 'Building index', description: 'Creating file index structure' },
  'notifying': { label: 'Finalizing', description: 'Completing indexing process' },
  'completed': { label: 'Indexing complete', description: 'Repository is ready for queries' },
  'failed': { label: 'Indexing failed', description: 'An error occurred during indexing' }
}

export function IndexingProgress({ progress, onCancel, onRetry }: IndexingProgressProps) {
  const currentStep = PROGRESS_STEPS[progress.step as keyof typeof PROGRESS_STEPS] || {
    label: progress.step,
    description: 'Processing...'
  }

  const getIcon = () => {
    if (progress.status === 'SUCCESS') {
      return <CheckCircle className="w-6 h-6 text-success" />
    }
    if (progress.status === 'FAILURE') {
      return <AlertCircle className="w-6 h-6 text-danger" />
    }
    return <Loader2 className="w-6 h-6 text-primary animate-spin" />
  }

  const getStatusColor = () => {
    if (progress.status === 'SUCCESS') return 'border-success/20 bg-success/5'
    if (progress.status === 'FAILURE') return 'border-danger/20 bg-danger/5'
    return 'border-primary/20 bg-primary/5'
  }

  return (
    <Card variant="default" className={`p-6 ${getStatusColor()}`}>
      <div className="text-center">
        {/* Icon and Status */}
        <div className="flex justify-center mb-4">
          {getIcon()}
        </div>

        {/* Repository Info */}
        {progress.repo && (
          <div className="mb-4">
            <h3 className="text-heading-md text-neutral">{progress.repo}</h3>
            <p className="text-body-sm text-neutral opacity-70">
              {progress.branch} • /{progress.directory}
            </p>
          </div>
        )}

        {/* Progress Step */}
        <div className="mb-6">
          <h4 className="text-heading-sm text-neutral mb-2">{currentStep.label}</h4>
          <p className="text-body-sm text-neutral opacity-80">{currentStep.description}</p>
        </div>

        {/* Progress Bar */}
        {progress.status === 'PROGRESS' && (
          <div className="mb-6">
            <div className="w-full bg-neutral/10 rounded-full h-2 mb-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(progress.progress, 5)}%` }}
              />
            </div>
            <p className="text-body-sm text-neutral opacity-60">
              {progress.progress}% complete
            </p>
          </div>
        )}

        {/* Task ID */}
        {progress.task_id && (
          <div className="mb-6">
            <p className="text-body-xs text-neutral opacity-50 font-mono">
              Task: {progress.task_id}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center space-x-3">
          {progress.status === 'PROGRESS' && onCancel && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
          
          {progress.status === 'FAILURE' && onRetry && (
            <Button
              variant="primary"
              size="sm"
              onClick={onRetry}
              leadingIcon={<FileSearch className="w-4 h-4" />}
            >
              Retry Indexing
            </Button>
          )}

          {progress.status === 'SUCCESS' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => window.location.reload()}
              leadingIcon={<CheckCircle className="w-4 h-4" />}
            >
              Continue
            </Button>
          )}
        </div>

        {/* Estimated Time */}
        {progress.status === 'PROGRESS' && (
          <div className="mt-4 flex items-center justify-center space-x-2 text-body-xs text-neutral opacity-50">
            <Clock className="w-3 h-3" />
            <span>Estimated time: 2-3 minutes</span>
          </div>
        )}
      </div>
    </Card>
  )
} 