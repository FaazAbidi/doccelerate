export interface IndexingStatus {
  jobId: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  progress?: number
  message?: string
  startedAt: string
  completedAt?: string
}

export interface IndexingJobResponse {
  success: boolean
  jobId?: string
  status?: IndexingStatus
  message: string
} 