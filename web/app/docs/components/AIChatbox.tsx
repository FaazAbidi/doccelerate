'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Bot, Sparkles, LightbulbOffIcon, Zap, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '../../components/Button'

interface AIChatboxProps {
  onSendQuery: (message: string) => Promise<void>
  /**
   * Current query status used to drive feedback messages
   * - idle: nothing happening
   * - processing: query running, show spinner
   * - no_suggestions: completed but no suggestions returned
   * - error: failed query
   */
  status?: 'idle' | 'processing' | 'no_suggestions' | 'error'
  className?: string
}

export function AIChatbox({ onSendQuery, status = 'idle', className }: AIChatboxProps) {
  const [message, setMessage] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isProcessing = status === 'processing'

  const handleSend = async () => {
    if (!message.trim() || isProcessing) return

    const queryText = message.trim()
    setMessage('')

    try {
      await onSendQuery(queryText)
    } catch (error) {
      console.error('Failed to process AI query:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    
    // Auto-resize textarea
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
  }

  useEffect(() => {
    if (inputRef.current && status !== 'processing' && document.activeElement !== inputRef.current) {
      inputRef.current.focus()
    }
  }, [status])

  return (
    <div className={cn("fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50", className)}>
      <div className={cn(
        "bg-white/95 backdrop-blur-xl border border-neutral/10 rounded-[24px] shadow-2xl transition-all duration-300",
        "w-[600px] max-w-[90vw]",
        isFocused ? "shadow-2xl border-primary/20" : "shadow-xl"
      )}>
        {/* Header hint when empty */}
        {!message && !isFocused && status === 'idle' && (
          <div className="absolute -top-11 left-1/2 transform -translate-x-1/2 bg-primary/10 backdrop-blur-sm rounded-[16px] px-4 py-2 border border-primary/20">
            <div className="flex items-center space-x-2 text-primary">
              <Sparkles className="w-4 h-4" />
              <span className="text-caption font-medium">Ask AI to edit your documentation</span>
            </div>
          </div>
        )}

        {/* Status indicator */}
        {status !== 'idle' && (
          <div
            className={cn(
              "absolute -top-12 left-1/2 transform -translate-x-1/2 backdrop-blur-sm rounded-[16px] px-4 py-2",
              status === 'error' ? 'bg-accent/90' : 'bg-primary/90'
            )}
          >
            <div className="flex items-center space-x-2 text-white">
              {status === 'processing' && <Loader2 className="w-4 h-4 animate-spin" />}
              {status === 'no_suggestions' && <LightbulbOffIcon className="w-4 h-4" />}
              {status === 'error' && <XCircle className="w-4 h-4" />}
              <span className="text-caption font-medium">
                {status === 'processing'
                  ? 'AI is thinking...'
                  : status === 'no_suggestions'
                    ? 'No suggestions'
                    : 'Something went wrong'}
              </span>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex items-center p-4 space-x-3">
          {/* AI Icon */}
          <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-[20px] flex items-center justify-center mb-1">
            <Zap className="w-4 h-4 text-white" />
          </div>

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Describe the changes you want to make..."
              disabled={status === 'processing'}
              className={cn(
                "w-full resize-none border-none outline-none bg-transparent",
                "text-body-md text-neutral placeholder-neutral/60",
                "min-h-[40px] max-h-[120px] py-2",
                "scrollbar-thin scrollbar-thumb-neutral/20 scrollbar-track-transparent"
              )}
              rows={1}
            />
          </div>

          {/* Send Button */}
          <div className="flex-shrink-0 mb-1">
            <Button
              onClick={handleSend}
              disabled={!message.trim() || status === 'processing'}
              variant={status === 'processing' ? 'outline' : 'primary'}
              size="lg"
              className="w-10 h-10 rounded-full"
              leadingIcon={status === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            >
            </Button>
          </div>
        </div>

        {/* Character count for long messages */}
        {message.length > 100 && (
          <div className="px-4 pb-2">
            <div className="text-right">
              <span className={cn(
                "text-caption",
                message.length > 500 ? "text-accent" : "text-neutral/60"
              )}>
                {message.length}/1000
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 