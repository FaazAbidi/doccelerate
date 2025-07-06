'use client'

import { FileSearch, Clock, Play, Settings, CheckCircle, RotateCcw } from 'lucide-react'
import { Card } from '@/app/components/Card'
import { Button } from '@/app/components/Button'
import { IndexingStatus } from '../actions/checkIndexingStatus'

interface IndexingPromptProps {
  status: IndexingStatus
  isStartingIndexing: boolean
  indexingError: string | null
  onStartIndexing: () => Promise<void>
  onStartReIndexing?: () => Promise<any>
}

export function IndexingPrompt({ 
  status, 
  isStartingIndexing, 
  indexingError, 
  onStartIndexing,
  onStartReIndexing
}: IndexingPromptProps) {
  if (!status.isConfigured) {
    return (
      <Card variant="default" className="p-8 text-center">
        <Settings className="w-12 h-12 text-neutral opacity-40 mx-auto mb-4" />
        <h2 className="text-heading-lg text-neutral mb-2">Repository Not Configured</h2>
        <p className="text-body-md text-neutral opacity-80 mb-6 max-w-md mx-auto">
          Please go to the repositories page and configure an active repository with branch and directory settings.
        </p>
        <Button
          variant="primary"
          size="md"
          onClick={() => window.location.href = '/repos'}
        >
          Configure Repository
        </Button>
      </Card>
    )
  }

  if (status.isIndexed) {
    return (
      <Card variant="default" className="p-6 border-success/20 bg-success/5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-6 h-6 text-success" />
            <div>
              <h3 className="text-heading-md text-neutral">Repository Indexed</h3>
              <p className="text-body-sm text-neutral opacity-80">
                {status.repositoryName} • {status.branch} • /{status.directory}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onStartReIndexing && (
              <Button
                variant="secondary"
                size="sm"
                className='p-6'
                onClick={onStartReIndexing}
                leadingIcon={<RotateCcw className="w-4 h-4" />}
              >
                Re-index
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              className='p-6'
              onClick={() => window.location.href = '/repos'}
            >
              Change Repository
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card variant="default" className="p-8 text-center">
      <FileSearch className="w-12 h-12 text-primary mx-auto mb-4" />
      <h2 className="text-heading-lg text-neutral mb-2">Ready to Index Documentation</h2>
      <p className="text-body-md text-neutral opacity-80 mb-2">
        Your repository <strong>{status.repositoryName}</strong> is configured and ready for indexing.
      </p>
      <div className="flex items-center justify-center space-x-4 text-body-sm text-neutral opacity-70 mb-6">
        <span>Branch: {status.branch}</span>
        <span>•</span>
        <span>Directory: /{status.directory}</span>
      </div>
      
      <div className="flex items-center justify-center space-x-2 text-body-sm text-neutral opacity-60 mb-6">
        <Clock className="w-4 h-4" />
        <span>This process typically takes 2-3 minutes</span>
      </div>

      {indexingError && (
        <div className="mb-6 p-3 bg-danger/10 border border-danger/20 rounded-md">
          <p className="text-body-sm text-danger">{indexingError}</p>
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        onClick={onStartIndexing}
        disabled={isStartingIndexing}
        leadingIcon={<Play className="w-5 h-5" />}
      >
        {isStartingIndexing ? 'Starting Indexing...' : 'Start Indexing'}
      </Button>
    </Card>
  )
} 