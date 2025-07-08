'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronDown, File, Folder, X, Menu, RefreshCw, RotateCcw } from 'lucide-react'
import { Tooltip } from '@/app/components/Tooltip'
import { getDirectoryTree } from '../actions/getDirectoryTree'
import { useRealtimeUpdates } from '../hooks/useRealtimeUpdates'
import { IndexingProgressBar, type IndexingProgress } from './IndexingProgress'
import { ReindexNotification } from './ReindexNotification'
import { checkModifiedFiles } from '../actions/checkModifiedFiles'
import { startSoftReindexing } from '../actions/startIndexing'
import type { TreeNode } from '../actions/getDirectoryTree'
import { Button } from '@/app/components/Button'
import { CommitPrompt } from './CommitPrompt'

interface DirectoryTreeSidebarProps {
  onFileSelect: (filePath: string) => void
  selectedFile?: string
  onOpenChange?: (open: boolean) => void
  /**
   * When the AI suggestions panel is visible we shift the sidebar up a bit
   * to prevent visual overlap with the panel.
   */
  hasSuggestions?: boolean
  /**
   * When true (default) the sidebar is fixed to the viewport. When false it
   * is rendered relative to the parent container. This allows parent
   * components to stack the sidebar with other elements (e.g. AI navigation
   * controls) vertically.
   */
  floating?: boolean
  onStartReIndexing?: () => Promise<void>
  /**
   * Callback for when soft re-indexing is started. This should trigger
   * the indexing status hook to start tracking the new job.
   */
  onSoftReIndexStarted?: () => Promise<void>
  /**
   * Current indexing progress to display above the sidebar
   */
  indexingProgress?: IndexingProgress
}

interface TreeNodeComponentProps {
  node: TreeNode
  level: number
  onFileSelect: (filePath: string) => void
  selectedFile?: string
  expandedNodes: Set<string>
  onToggleExpand: (path: string) => void
}

// Helper function to count total files in the tree
function countFilesInTree(nodes: TreeNode[]): number {
  let count = 0
  
  for (const node of nodes) {
    if (node.type === 'file') {
      count++
    } else if (node.type === 'directory' && node.children) {
      count += countFilesInTree(node.children)
    }
  }
  
  return count
}

function TreeNodeComponent({ 
  node, 
  level, 
  onFileSelect, 
  selectedFile,
  expandedNodes,
  onToggleExpand 
}: TreeNodeComponentProps) {
  const isExpanded = expandedNodes.has(node.path)
  const isSelected = selectedFile === node.path
  const hasChildren = node.children && node.children.length > 0

  const handleClick = () => {
    if (node.type === 'directory') {
      onToggleExpand(node.path)
    } else {
      onFileSelect(node.path)
    }
  }

  return (
    <div>
      <div
        className={`
          flex items-center gap-1 py-1 px-2 rounded cursor-pointer
          hover:bg-neutral/5 transition-colors
          ${isSelected ? 'bg-primary/10 text-primary' : 'text-neutral'}
        `}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'directory' ? (
          <>
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4 text-neutral/60" />
              ) : (
                <ChevronRight className="w-4 h-4 text-neutral/60" />
              )
            ) : (
              <div className="w-4 h-4" />
            )}
            <Folder className="w-4 h-4 text-neutral/60" />
          </>
        ) : (
          <>
            <div className="w-4 h-4" />
            <File className="w-4 h-4 text-neutral/60" />
          </>
        )}
        <span className="text-sm truncate">{node.name}</span>
        {node.type === 'file' && node.has_uncommitted_changes && (
          <Tooltip content="Modified file">
            <span className="w-2 h-2 bg-accent rounded-full ml-1 flex-shrink-0" />
          </Tooltip>
        )}
      </div>
      
      {node.type === 'directory' && isExpanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeComponent
              key={child.path}
              node={child}
              level={level + 1}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function DirectoryTreeSidebar({ 
  onFileSelect, 
  selectedFile, 
  onOpenChange, 
  hasSuggestions = false, 
  floating = true, 
  onStartReIndexing,
  onSoftReIndexStarted,
  indexingProgress
}: DirectoryTreeSidebarProps) {
  const [tree, setTree] = useState<TreeNode[] | null>(null)
  const [isOpen, setIsOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [isClosing, setIsClosing] = useState(false)
  
  // New state for tracking files that need re-indexing
  const [modifiedFilesInfo, setModifiedFilesInfo] = useState<{
    hasModifiedFiles: boolean
    modifiedCount: number // total modified
    reindexCount: number
    needsReindex: boolean
  }>({
    hasModifiedFiles: false,
    modifiedCount: 0,
    reindexCount: 0,
    needsReindex: false
  })
  
  // Check for modified files that need re-indexing
  const checkForModifiedFiles = useCallback(async (useCache: boolean = true) => {
    try {
      const info = await checkModifiedFiles(useCache)
      setModifiedFilesInfo({
        hasModifiedFiles: info.hasModifiedFiles,
        modifiedCount: info.modifiedCount,
        reindexCount: info.reindexCount,
        needsReindex: info.needsReindex
      })
    } catch (error) {
      console.error('Failed to check for modified files:', error)
    }
  }, [])

  const loadTree = useCallback(async (forceRefresh: boolean = false) => {
    setIsLoading(true)
    try {
      const treeData = await getDirectoryTree()
      setTree(treeData)
      
      // Auto-expand root directories
      if (treeData) {
        const rootDirs = treeData
          .filter(node => node.type === 'directory')
          .map(node => node.path)
        setExpandedNodes(new Set(rootDirs))
      }
      
      // Check for modified files after loading tree
      await checkForModifiedFiles(!forceRefresh)
    } catch (error) {
      console.error('Failed to load directory tree:', error)
    } finally {
      setIsLoading(false)
    }
  }, [checkForModifiedFiles])

  // Set up an interval to periodically check for modified files
  useEffect(() => {
    const interval = setInterval(() => {
      checkForModifiedFiles()
    }, 15000) // Check every 15 seconds
    
    return () => {
      clearInterval(interval)
    }
  }, [checkForModifiedFiles])
  
  // Listen for file update events from suggestion acceptance
  useEffect(() => {
    const handleFileUpdated = async (e: Event) => {
      const customEvent = e as CustomEvent<{filePath: string}>
      // First refresh the tree to show the updated files with forced refresh
      await loadTree(true)
      // Then explicitly check for modified files to update the re-index notification
      await checkForModifiedFiles(false)
    }
    
    window.addEventListener('file-updated', handleFileUpdated)
    
    return () => {
      window.removeEventListener('file-updated', handleFileUpdated)
    }
  }, [loadTree, checkForModifiedFiles])

  // Combined effect to run once on mount
  useEffect(() => {
    loadTree()
  }, [loadTree])

  // Handle soft re-indexing
  const handleStartSoftReindex = async () => {
    try {
      const response = await startSoftReindexing()
      if (response.success) {
        console.log('Soft re-indexing started successfully')
        // Clear the re-index notification immediately to provide user feedback
        setModifiedFilesInfo(prev => ({
          ...prev,
          needsReindex: false
        }))
        
        // Trigger the parent to start tracking the soft indexing job
        if (onSoftReIndexStarted) {
          await onSoftReIndexStarted()
        }
      } else {
        console.error('Failed to start soft re-indexing:', response.message)
      }
    } catch (error) {
      console.error('Error starting soft re-indexing:', error)
    }
  }

  // Setup realtime updates
  useRealtimeUpdates({
    callbacks: {
      onDirectoryTreeChanged: () => {
        console.log('Directory tree changed, reloading...')
        loadTree()
      },
      onFileUpdated: (filePath) => {
        loadTree()
      },
      // Add listener for indexing completion
      onIndexingCompleted: () => {
        console.log('Indexing completed, checking modified files status')
        checkForModifiedFiles(false)
      }
    },
  })

  const handleToggleExpand = (path: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }

  const handleOpenSidebar = () => {
    setIsClosing(false)
    setIsOpen(true)
    onOpenChange?.(true)
  }

  const handleCloseSidebar = () => {
    setIsClosing(true)
    // Delay the actual close to allow animation to complete
    setTimeout(() => {
      setIsOpen(false)
      setIsClosing(false)
      onOpenChange?.(false)
    }, 200) // Match the transition duration
  }

  // Re-usable top position class depending on the presence of suggestions
  const containerTopClass = hasSuggestions ? 'top-[40%]' : 'top-1/2'

  // Assemble positioning classes conditionally
  const positioningClasses = floating
    ? `fixed left-4 ${containerTopClass} -translate-y-1/2 z-50`
    : ''

  if (!isOpen) {
    return (
      <div className={floating ? `fixed left-4 ${containerTopClass} -translate-y-1/2 z-50` : ''}>
        <button
          onClick={handleOpenSidebar}
          className="p-3 bg-transparent border border-neutral/20 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 ease-in-out transform hover:scale-105"
        >
          <Menu className="w-5 h-5 text-neutral" />
        </button>
      </div>
    )
  }

  // Check if we have an active soft re-indexing job
  const isSoftReindexing = indexingProgress?.metadata?.soft_reindex === true;
  
  // Show re-index notification if files need re-indexing OR if soft re-indexing is in progress
  const shouldShowReindexNotification = 
    (modifiedFilesInfo.needsReindex && modifiedFilesInfo.hasModifiedFiles && !indexingProgress) || 
    (isSoftReindexing && indexingProgress?.status === 'PROGRESS');

  // Show commit prompt when there are modified files (whether or not they need reindexing)
  const shouldShowCommitPrompt = modifiedFilesInfo.hasModifiedFiles;

  return (
    <>
      {/* Commit prompt */}
      {shouldShowCommitPrompt && (
        <div className={`${positioningClasses} -translate-y-[5px] transition-all duration-200 ease-in-out ${isClosing ? 'opacity-0 translate-x-[-20px]' : 'opacity-100 translate-x-0'}`}> {/* stack above notifications */}
          <CommitPrompt
            modifiedCount={modifiedFilesInfo.modifiedCount}
            className="w-80 mb-2"
            onCommitted={async () => {
              // After commit refresh tree & modified file info
              await loadTree(true)
              await checkForModifiedFiles(false)
            }}
          />
        </div>
      )}
      {/* Show re-index notification if files need re-indexing or if soft-reindexing is in progress */}
      {shouldShowReindexNotification && (
        <div className={`${positioningClasses} ${shouldShowCommitPrompt ? 'translate-y-[calc(-5px)]' : ''} transition-all duration-200 ease-in-out ${isClosing ? 'opacity-0 translate-x-[-20px]' : 'opacity-100 translate-x-0'}`}> {/* shift down if commit prompt present */}
          <ReindexNotification 
            modifiedCount={modifiedFilesInfo.reindexCount}
            onStartReIndex={handleStartSoftReindex}
            className="w-80"
            isReindexing={isSoftReindexing}
          />
        </div>
      )}
    
      {/* Show indexing progress above the sidebar if active AND not soft re-indexing */}
      {indexingProgress && !isSoftReindexing && (
        <div className={`${positioningClasses} -translate-y-[calc(50%+60px)] transition-all duration-200 ease-in-out ${isClosing ? 'opacity-0 translate-x-[-20px]' : 'opacity-100 translate-x-0'}`}>
          <IndexingProgressBar 
            progress={indexingProgress}
            compact={true}
            className="w-80 mb-2"
          />
        </div>
      )}
      
      <div className={`${positioningClasses} w-80 max-h-[70vh] p-2 bg-white/80 border border-neutral/20 rounded-xl shadow-lg transition-all duration-200 ease-in-out ${isClosing ? 'opacity-0 translate-x-[-20px] scale-95' : 'opacity-100 translate-x-0 scale-100'}`}>
        <div className="flex items-center justify-between p-3 border-b border-neutral/20">
          <h3 className="text-body-sm font-medium text-neutral">
            Files {tree ? `(${countFilesInTree(tree)})` : ''}
          </h3>
          <div className="flex items-center gap-1">
            <Tooltip content="Refresh file list">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => loadTree(true)}
                disabled={!!indexingProgress && indexingProgress.status === 'PROGRESS'}
                className="p-1"
              >
                <RefreshCw className="w-4 h-4 text-neutral/60" />
              </Button>
            </Tooltip>
            {onStartReIndexing && (
              <Tooltip content="Re-index repository">
                <Button
                  size="sm"
                  variant="ghost"
                  className="p-1"
                  onClick={onStartReIndexing}
                  disabled={!!indexingProgress && indexingProgress.status === 'PROGRESS'}
                >
                  <RotateCcw className="w-4 h-4 text-neutral/60" />
                </Button>
              </Tooltip>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="p-0"
              onClick={handleCloseSidebar}
            >
              <X className="w-4 h-4 text-neutral/60" />
            </Button>
          </div>
        </div>
        
        <div className="overflow-y-auto scrollbar max-h-[calc(70vh-300px)] p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : tree && tree.length > 0 ? (
            <div className="space-y-1">
              {tree.map((node) => (
                <TreeNodeComponent
                  key={node.path}
                  node={node}
                  level={0}
                  onFileSelect={onFileSelect}
                  selectedFile={selectedFile}
                  expandedNodes={expandedNodes}
                  onToggleExpand={handleToggleExpand}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-neutral/60">
              <p className="text-sm">No files found</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
} 