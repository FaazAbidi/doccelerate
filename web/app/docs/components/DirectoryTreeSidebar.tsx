'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronDown, File, Folder, X, Menu, RefreshCw, RotateCcw } from 'lucide-react'
import { getDirectoryTree } from '../actions/getDirectoryTree'
import { useRealtimeUpdates } from '../hooks/useRealtimeUpdates'
import type { TreeNode } from '../actions/getDirectoryTree'

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
}

interface TreeNodeComponentProps {
  node: TreeNode
  level: number
  onFileSelect: (filePath: string) => void
  selectedFile?: string
  expandedNodes: Set<string>
  onToggleExpand: (path: string) => void
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
      console.log('DirectoryTreeSidebar: File selected:', node.path, 'Node:', node)
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

export function DirectoryTreeSidebar({ onFileSelect, selectedFile, onOpenChange, hasSuggestions = false, floating = true, onStartReIndexing }: DirectoryTreeSidebarProps) {
  const [tree, setTree] = useState<TreeNode[] | null>(null)
  const [isOpen, setIsOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const loadTree = useCallback(async () => {
    setIsLoading(true)
    try {
      const treeData = await getDirectoryTree()
      console.log('DirectoryTreeSidebar: Received tree data:', treeData)
      setTree(treeData)
      
      // Auto-expand root directories
      if (treeData) {
        const rootDirs = treeData
          .filter(node => node.type === 'directory')
          .map(node => node.path)
        console.log('DirectoryTreeSidebar: Auto-expanding directories:', rootDirs)
        setExpandedNodes(new Set(rootDirs))
      }
    } catch (error) {
      console.error('Failed to load directory tree:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTree()
  }, [loadTree])

  // Setup realtime updates
  useRealtimeUpdates({
    callbacks: {
      onDirectoryTreeChanged: () => {
        console.log('Directory tree changed, reloading...')
        loadTree()
      },
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
    setIsOpen(true)
    onOpenChange?.(true)
  }

  const handleCloseSidebar = () => {
    setIsOpen(false)
    onOpenChange?.(false)
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
          className="p-3 bg-transparent border border-neutral/20 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
        >
          <Menu className="w-5 h-5 text-neutral" />
        </button>
      </div>
    )
  }

  return (
    <div className={`${positioningClasses} w-80 max-h-[70vh] p-2 bg-white/80 border border-neutral/20 rounded-xl shadow-lg`}>
      <div className="flex items-center justify-between p-3 border-b border-neutral/20">
        <h3 className="text-body-md font-medium text-neutral">Files</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={loadTree}
            className="p-1 hover:bg-neutral/5 rounded transition-colors"
            title="Refresh file list"
          >
            <RefreshCw className="w-4 h-4 text-neutral/60" />
          </button>
          {onStartReIndexing && (
            <button
              onClick={onStartReIndexing}
              className="p-1 hover:bg-neutral/5 rounded transition-colors"
              title="Re-index repository"
            >
              <RotateCcw className="w-4 h-4 text-neutral/60" />
            </button>
          )}
          <button
            onClick={handleCloseSidebar}
            className="p-1 hover:bg-neutral/5 rounded transition-colors"
          >
            <X className="w-4 h-4 text-neutral/60" />
          </button>
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
  )
} 