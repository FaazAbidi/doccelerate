'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Edit, FileText } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '../../components/Tabs'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { getFileContent } from '../actions/getFileContent'
import { updateFileContent } from '../actions/updateFileContent'
import type { FileContentResponse } from '../actions/getFileContent'
import { Button } from '../../components/Button'
import type { AISuggestion } from '../types'
import { Check, X, Eye, Edit3 } from 'lucide-react'

interface FileEditorProps {
  filePath: string | null
  onClose: () => void
  theme?: 'light' | 'dark'
  suggestions?: AISuggestion[]
  onAcceptSuggestion?: (suggestionId: string) => Promise<void>
  onRejectSuggestion?: (suggestionId: string) => Promise<void>
  onAcceptAllSuggestions?: (filePath: string) => Promise<void>
  onRejectAllSuggestions?: (filePath: string) => Promise<void>
}

type TabType = 'editor' | 'preview' | 'suggestions'

export function FileEditor({ 
  filePath, 
  onClose, 
  theme = 'light',
  suggestions = [],
  onAcceptSuggestion,
  onRejectSuggestion,
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

  // Get suggestions for current file
  const fileSuggestions = filePath ? suggestions.filter(
    s => s.filePath === filePath && s.status === 'pending'
  ) : []

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
          // Auto-switch to suggestions if there are any, otherwise preview for markdown files
          if (hasSuggestions) {
            setActiveTab('suggestions')
          } else if (data.isMarkdown) {
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
  }, [filePath, hasSuggestions])

  // Handle content changes
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    setHasUnsavedChanges(newContent !== fileData?.content)
  }, [fileData?.content])

  // Save file
  const handleSave = async () => {
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
      } else {
        setError('Failed to save file')
      }
    } catch (err) {
      console.error('Error saving file:', err)
      setError('Failed to save file')
    } finally {
      setIsSaving(false)
    }
  }

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

  // Apply suggestions to content for preview
  const getContentWithSuggestions = useCallback(() => {
    if (!hasSuggestions || !content) return content
    
    // For now, return original content
    // TODO: Implement proper diff parsing and application
    return content
  }, [content, hasSuggestions])

  // Handle suggestion actions
  const handleAcceptSuggestion = async (suggestionId: string) => {
    if (onAcceptSuggestion) {
      await onAcceptSuggestion(suggestionId)
    }
  }

  const handleRejectSuggestion = async (suggestionId: string) => {
    if (onRejectSuggestion) {
      await onRejectSuggestion(suggestionId)
    }
  }

  const handleAcceptAll = async () => {
    if (onAcceptAllSuggestions && filePath) {
      await onAcceptAllSuggestions(filePath)
    }
  }

  const handleRejectAll = async () => {
    if (onRejectAllSuggestions && filePath) {
      await onRejectAllSuggestions(filePath)
    }
  }

  // Parse unified diff for display
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
        continue // Skip file headers
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
      }
    }

    return parsedLines
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
            <div className="w-2 h-2 bg-orange-500 rounded-full" />
          )}
        </div>

        {/* Action buttons on the far right */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            size="sm"
            variant={hasUnsavedChanges ? 'primary' : 'secondary'}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          
          <Button
            onClick={onClose}
            size="sm"
            variant="secondary"
          >
            <X className="w-4 h-4 text-white" />
          </Button>
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
              {hasSuggestions && (
                <TabsTrigger value="suggestions">
                  <Edit3 className="w-4 h-4" />
                  Suggestions
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
          <div className="h-full overflow-y-auto scrollbar">
            <MarkdownPreview
              content={getContentWithSuggestions()}
              theme={theme}
              className="h-full"
            />
          </div>
        ) : activeTab === 'suggestions' ? (
          <div className="h-full overflow-y-auto scrollbar p-4">
            {/* Suggestions header */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral/10">
              <div>
                <h3 className="text-heading-sm font-medium text-neutral">
                  AI Suggestions ({fileSuggestions.length})
                </h3>
                <p className="text-caption text-neutral/60">
                  Review and apply suggested changes to this file
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleRejectAll}
                  variant="outline"
                  size="sm"
                  leadingIcon={<X className="w-4 h-4" />}
                >
                  Reject All
                </Button>
                <Button
                  onClick={handleAcceptAll}
                  variant="primary"
                  size="sm"
                  leadingIcon={<Check className="w-4 h-4" />}
                >
                  Accept All
                </Button>
              </div>
            </div>

            {/* Individual suggestions */}
            <div className="space-y-6">
              {fileSuggestions.map((suggestion, index) => {
                const diffLines = parseDiff(suggestion.patchUnifiedDiff)
                
                return (
                  <div key={suggestion.id} className="border border-neutral/10 rounded-[12px] overflow-hidden">
                    {/* Suggestion header */}
                    <div className="flex items-center justify-between p-4 bg-primary/5 border-b border-neutral/10">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-white text-caption font-bold">{index + 1}</span>
                        </div>
                        <div>
                          <p className="text-body-sm font-medium text-neutral">
                            Suggestion {index + 1}
                          </p>
                          <p className="text-caption text-neutral/60">
                            {suggestion.confidence && 
                              `${Math.round(suggestion.confidence * 100)}% confident`
                            }
                            {suggestion.modelUsed && suggestion.confidence && ' • '}
                            {suggestion.modelUsed && `${suggestion.modelUsed}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleRejectSuggestion(suggestion.id)}
                          variant="outline"
                          size="sm"
                          leadingIcon={<X className="w-4 h-4" />}
                        >
                          Reject
                        </Button>
                        <Button
                          onClick={() => handleAcceptSuggestion(suggestion.id)}
                          variant="primary"
                          size="sm"
                          leadingIcon={<Check className="w-4 h-4" />}
                        >
                          Accept
                        </Button>
                      </div>
                    </div>

                    {/* Diff display */}
                    <div className="font-geist-mono text-sm">
                      {diffLines.map((line, lineIndex) => (
                        <div
                          key={lineIndex}
                          className={`
                            flex items-start px-4 py-1
                            ${line.type === 'hunk' ? 'bg-primary/10 text-primary font-medium' : ''}
                            ${line.type === 'add' ? 'bg-success/10 text-neutral' : ''}
                            ${line.type === 'remove' ? 'bg-accent/10 text-neutral line-through' : ''}
                            ${line.type === 'context' ? 'bg-transparent text-neutral/80' : ''}
                          `}
                        >
                          {/* Line Numbers */}
                          <div className="flex items-center space-x-2 mr-4 text-neutral/50 text-xs font-medium min-w-[60px]">
                            {line.lineNumber && (
                              <>
                                <span className="w-6 text-right">
                                  {line.lineNumber.old || ''}
                                </span>
                                <span className="w-6 text-right">
                                  {line.lineNumber.new || ''}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 whitespace-pre-wrap">
                            {line.type === 'add' && <span className="text-success mr-2 font-bold">+</span>}
                            {line.type === 'remove' && <span className="text-accent mr-2 font-bold">-</span>}
                            {line.type === 'context' && line.lineNumber && <span className="text-neutral/30 mr-2"> </span>}
                            {line.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
} 