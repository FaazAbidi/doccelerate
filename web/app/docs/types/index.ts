export interface TreeNode {
  path: string
  name: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

export interface FileContentResponse {
  content: string
  filePath: string
  isMarkdown: boolean
}

export type TabType = 'editor' | 'preview'

export interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  theme?: 'light' | 'dark'
  className?: string
}

export interface MarkdownPreviewProps {
  content: string
  className?: string
  theme?: 'light' | 'dark'
}

export interface QueryRequest {
  id: string
  message: string
  timestamp: Date
}

export interface QueryResponse {
  id: string
  queryId: string
  message?: string
  suggestions: AISuggestion[]
  taskId?: string
  status: 'processing' | 'completed' | 'failed'
  timestamp: Date
}

export interface AISuggestion {
  id: string
  fileId: string
  filePath: string
  patchUnifiedDiff: string
  status: 'pending' | 'accepted' | 'rejected' | 'applied'
  confidence?: number
  modelUsed?: string
  createdAt: Date
  updatedAt: Date
}

export interface TaskStatus {
  id: string
  status: 'running' | 'completed' | 'failed'
  progress?: number
  message?: string
  result?: QueryResponse
}

export interface ChatMessage {
  id: string
  type: 'user' | 'ai' | 'system'
  content: string
  timestamp: Date
  queryRequest?: QueryRequest
  queryResponse?: QueryResponse
  suggestions?: AISuggestion[]
} 