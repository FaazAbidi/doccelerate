'use client'

import { useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/app/components/Button'
import { cn } from '@/lib/utils'

interface ReindexNotificationProps {
  modifiedCount: number
  onStartReIndex: () => Promise<void>
  className?: string
  /**
   * When true, indicates that soft re-indexing is in progress
   */
  isReindexing?: boolean
}

export function ReindexNotification({
  modifiedCount,
  onStartReIndex,
  className,
  isReindexing: externalIsReindexing
}: ReindexNotificationProps) {
  const [isLocalReindexing, setIsLocalReindexing] = useState(false)
  
  // Use external state if provided, otherwise use local state
  const isReindexing = externalIsReindexing !== undefined ? externalIsReindexing : isLocalReindexing

  // Show the component if there are modified files OR if re-indexing is in progress
  // Don't show if there are no modified files and we're not re-indexing
  if (modifiedCount <= 0 && !isReindexing) {
    return null
  }

  const handleReIndex = async () => {
    setIsLocalReindexing(true)
    try {
      await onStartReIndex()
    } catch (error) {
      console.error('Failed to start re-indexing:', error)
      // Only reset local state if we're not using external state
      if (externalIsReindexing === undefined) {
        setIsLocalReindexing(false)
      }
    }
  }

  return (
    <div className={cn(
      "bg-primary/10 backdrop-blur-0 border border-primary/20 rounded-[20px] px-4 py-3",
      className
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center">
          <div>
            <p className="text-caption text-neutral-800">
              {isReindexing 
                ? "Re-indexing in progress..." 
                : `${modifiedCount} file${modifiedCount !== 1 ? 's' : ''} ${modifiedCount !== 1 ? 'have' : 'has'} been modified`
              }
            </p>
            <p className="text-xs text-neutral/70">
              {isReindexing 
                ? "Updating search and AI functionality" 
                : "Re-index to update search and AI functionality"
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isReindexing ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="h-8"
              onClick={handleReIndex}
              disabled={isReindexing}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
} 