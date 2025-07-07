'use client'

import { FileSearch, Clock, CheckCircle, AlertCircle, Loader2, Check } from 'lucide-react'
import { Card } from '@/app/components/Card'
import { Button } from '@/app/components/Button'
import { cn } from '@/lib/utils'

export interface IndexingProgress {
  step: string
  progress: number
  status: 'PROGRESS' | 'SUCCESS' | 'FAILURE'
  task_id?: string
  repo?: string
  branch?: string
  directory?: string
  metadata?: {
    soft_reindex?: boolean
    [key: string]: any
  }
}

interface IndexingProgressBarProps {
  progress?: IndexingProgress
  className?: string
  /**
   * When compact is true, the progress bar will be more minimal
   * to fit above other UI elements like the directory tree sidebar
   */
  compact?: boolean
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

export function IndexingProgressBar({ progress, className, compact = false }: IndexingProgressBarProps) {
  if (!progress) return null
  
  const { step, progress: percent, status } = progress
  
  // Format step name for display
  const formattedStep = step
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  
  return (
    <div className={cn(
      "bg-primary/5 backdrop-blur-sm border border-primary/20 rounded-lg",
      compact ? "px-3 py-2" : "px-4 py-3",
      className
    )}>
      <div className="flex items-center gap-2">
        {status === 'PROGRESS' && (
          <Loader2 className={cn("text-primary animate-spin", compact ? "w-4 h-4" : "w-5 h-5")} />
        )}
        {status === 'SUCCESS' && (
          <Check className={cn("text-success", compact ? "w-4 h-4" : "w-5 h-5")} />
        )}
        {status === 'FAILURE' && (
          <AlertCircle className={cn("text-accent", compact ? "w-4 h-4" : "w-5 h-5")} />
        )}
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className={cn(
              "text-primary font-medium", 
              compact ? "text-caption" : "text-body-sm"
            )}>
              {status === 'PROGRESS' ? `${formattedStep}...` : 
               status === 'SUCCESS' ? 'Indexing Complete' : 
               'Indexing Failed'}
            </span>
            
            {!compact && (
              <span className="text-caption text-neutral/60">{percent}%</span>
            )}
          </div>
          
          <div className="w-full bg-neutral/10 rounded-full h-1.5">
            <div
              className={cn(
                "h-1.5 rounded-full",
                status === 'FAILURE' ? "bg-accent" : "bg-primary"
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
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