'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Save, Edit, FileText, X, Eye, Check, List } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '../../components/Tabs'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { UnifiedDiffView } from './UnifiedDiffView'
import { getFileContent } from '../actions/getFileContent'
import { updateFileContent } from '../actions/updateFileContent'
import type { FileContentResponse } from '../actions/getFileContent'
import { Button } from '../../components/Button'
import type { AISuggestion } from '../types'
import { applyOperations } from '../utils/operationsApplier'
import { Tooltip } from '@/app/components/Tooltip'

interface FileEditorProps {
  filePath: string | null
  onClose: () => void
  theme?: 'light' | 'dark'
  suggestions?: AISuggestion[]
  onAcceptAllSuggestions?: (filePath: string) => Promise<void>
  onRejectAllSuggestions?: (filePath: string) => Promise<void>
}

type TabType = 'editor' | 'preview' | 'diff'



export function FileEditor({ 
  filePath, 
  onClose, 
  theme = 'light',
  suggestions = [],
  onAcceptAllSuggestions,
  onRejectAllSuggestions
}: FileEditorProps) {
  const [fileData, setFileData] = useState<FileContentResponse | null>(null)
  const [content, setContent] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('editor')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isProcessingSuggestions, setIsProcessingSuggestions] = useState(false)

  // Get suggestions for current file
  const fileSuggestions = useMemo(() => 
    filePath ? suggestions.filter(
      s => s.filePath === filePath && s.status === 'pending'
    ) : [], [filePath, suggestions]
  )

  const hasSuggestions = fileSuggestions.length > 0

  // Load file content when filePath changes
  useEffect(() => {
    if (!filePath) {
      setFileData(null)
      setContent('')
      setHasUnsavedChanges(false)
      setError(null)
      return
    }

    const loadFile = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await getFileContent(filePath)
        if (data) {
          setFileData(data)
          setContent(data.content)
          setHasUnsavedChanges(false)
          // Auto-switch to preview for markdown files
          if (data.isMarkdown) {
            setActiveTab('preview')
          } else {
            setActiveTab('editor')
          }
        } else {
          setError('File not found or could not be loaded')
        }
      } catch (err) {
        console.error('Error loading file:', err)
        setError('Failed to load file')
      } finally {
        setIsLoading(false)
      }
    }

    loadFile()
  }, [filePath])

  // Handle content changes
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    setHasUnsavedChanges(newContent !== fileData?.content)
  }, [fileData?.content])

  // Save file
  const handleSave = useCallback(async () => {
    if (!filePath || !hasUnsavedChanges) return

    setIsSaving(true)
    try {
      const success = await updateFileContent(filePath, content)
      if (success) {
        setHasUnsavedChanges(false)
        // Update the file data to reflect the new content
        if (fileData) {
          setFileData({ ...fileData, content })
        }
        
        // Dispatch file-updated event to notify other components (like DirectoryTreeSidebar)
        window.dispatchEvent(new CustomEvent('file-updated', { 
          detail: { filePath } 
        }))
        console.log('File saved and updated event dispatched:', filePath)
      } else {
        setError('Failed to save file')
      }
    } catch (err) {
      console.error('Error saving file:', err)
      setError('Failed to save file')
    } finally {
      setIsSaving(false)
    }
  }, [filePath, hasUnsavedChanges, content, fileData])

  // Handle tab switching
  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab)
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])
  
  useEffect(() => {
    if (!fileData || fileSuggestions.length === 0) {
      return
    }
    
    // Apply suggestions only to the original file content, not the current editor content
    let updated = fileData.content
    let hasError = false
    
    for (const suggestion of fileSuggestions) {
      try {
        const patchedContent = applyOperations(updated, suggestion.operationsJson)
        if (patchedContent !== updated) {
          updated = patchedContent
        }
      } catch (err) {
        console.warn('Failed to apply suggestion operations', suggestion.id, err)
        hasError = true
        break
      }
    }
    
    if (!hasError) {
      setContent(updated) // Set content to suggested content initially
      setHasUnsavedChanges(updated !== fileData.content) // Mark as unsaved if suggestions changed content
    }
  }, [fileData, fileSuggestions])

  // Note: Content is only reset when suggestions are explicitly rejected via handleRejectAll
  // When suggestions are accepted, we keep the current content (which has the accepted changes)

  const handleAcceptAll = async () => {
    if (!hasSuggestions || !onAcceptAllSuggestions || !filePath) return
    setIsProcessingSuggestions(true)
    try {
      await onAcceptAllSuggestions(filePath)
    } finally {
      setIsProcessingSuggestions(false)
    }
  }

  const handleRejectAll = async () => {
    if (!hasSuggestions || !onRejectAllSuggestions || !filePath) return
    setIsProcessingSuggestions(true)
    try {
      await onRejectAllSuggestions(filePath)
      // Reset content back to original and clear unsaved changes
      if (fileData) {
        setContent(fileData.content)
        setHasUnsavedChanges(false)
      }
    } finally {
      setIsProcessingSuggestions(false)
    }
  }



  if (!filePath) {
    return (
      <div className="h-full flex items-center justify-center text-neutral/60">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-body-md">Select a file to edit</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-500">
        <div className="text-center">
          <p className="text-body-md mb-4">{error}</p>
          {error.includes('not found') && (
            <div className="text-sm text-neutral/60">
              <p>This file might not exist in the database.</p>
              <p>Try refreshing the file list in the sidebar.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const fileName = filePath.split('/').pop() || filePath
  const isMarkdown = fileData?.isMarkdown ?? false

  return (
    <div className="h-full flex flex-col bg-white/80 rounded-[20px] border border-neutral/20">
      {/* Header */}
      <div className="relative flex items-center p-4 border-b border-neutral/20">
        {/* File info on left */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <FileText className="w-5 h-5 text-neutral/60" />
          <span className="text-body-md font-medium text-neutral">{fileName}</span>
          {hasUnsavedChanges && (
            <div className="w-2 h-2 bg-secondary rounded-full" />
          )}
        </div>

        {/* Action buttons on the far right */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {hasSuggestions && (
            <>
              <Button
                onClick={handleRejectAll}
                disabled={isProcessingSuggestions}
                size="sm"
                variant="outline"
              >
                <Tooltip content="Reject changes">
                  <X className="w-4 h-4" />
                </Tooltip>
              </Button>
              <Button
                onClick={handleAcceptAll}
                disabled={isProcessingSuggestions}
                size="sm"
                variant="primary"
              >
                <Tooltip content="Accept changes">
                  <Check className="w-4 h-4" />
                </Tooltip>
              </Button>
            </>
          )}
          <Tooltip content="Save changes">
          <Button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            size="sm"
            variant={hasUnsavedChanges ? 'primary' : 'secondary'}
          >
            <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </Tooltip>
          
          <Tooltip content="Close">
          <Button
            onClick={onClose}
            size="sm"
            variant="secondary"
          >
            <X className="w-4 h-4 text-white" />
          </Button>
          </Tooltip>
        </div>

        {/* Tabs centered */}
        <div className="mx-auto">
          <Tabs value={activeTab} onValueChange={(v)=>handleTabSwitch(v as TabType)}>
            <TabsList>
              <TabsTrigger value="editor">
                <Edit className="w-4 h-4" />
                Editor
              </TabsTrigger>
              {isMarkdown ? (
                <TabsTrigger value="preview">
                  <Eye className="w-4 h-4" />
                  Preview
                </TabsTrigger>
              ) : (
                <span className="px-4 py-2 text-sm text-neutral/50">
                  Preview not available
                </span>
              )}
              {hasUnsavedChanges && (
                <TabsTrigger value="diff">
                  <List className="w-4 h-4" />
                  Diff
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar rounded-b-[20px]">
        {activeTab === 'editor' ? (
          <MarkdownEditor
            value={content}
            onChange={handleContentChange}
            theme={theme}
            className="h-full"
          />
        ) : activeTab === 'preview' ? (
          <div className="h-full">
            <MarkdownPreview
              content={content}
              className="h-full"
            />
          </div>
        ) : activeTab === 'diff' ? (
          <UnifiedDiffView
            originalContent={fileData?.content || ''}
            currentContent={content}
            filePath={filePath || ''}
            className="h-full"
          />
        ) : null}
      </div>
    </div>
  )
} 