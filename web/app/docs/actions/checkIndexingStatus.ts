'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"

export interface IndexingStatus {
  isConfigured: boolean
  isIndexed: boolean
  repositoryName?: string
  repositoryFullName?: string
  branch?: string
  directory?: string
  lastSyncSha?: string | null
  rootHash?: string | null
  hasActiveJob?: boolean
  activeJob?: {
    id: string
    task_id: string
    status: string
    progress?: number
    error_msg?: string
    metadata?: any
  }
}

/**
 * Checks if the user's active repository is configured and indexed
 * Also checks for any active indexing jobs
 * @returns Promise<IndexingStatus> - The indexing status of the active repository
 */
export async function checkIndexingStatus(): Promise<IndexingStatus> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    include: { 
      active_repo: true 
    },
  })

  if (!profile?.active_repo || !profile.active_branch || !profile.active_directory) {
    return {
      isConfigured: false,
      isIndexed: false,
      hasActiveJob: false,
    }
  }

  const repository = profile.active_repo
  
  // Check if repository has been indexed
  // A repository is considered indexed if it has both root_hash and last_sync_sha
  const isIndexed = !!(repository.root_hash && repository.last_sync_sha)

  // Check for active indexing jobs via database
  let hasActiveJob = false
  let activeJob = undefined
  
  try {
    const job = await prisma.job.findFirst({
      where: {
        user_id: userId,
        type: 'index',
        status: { in: ['pending', 'running'] }
      },
      orderBy: { created_at: 'desc' }
    })
    
    if (job) {
      hasActiveJob = true
             activeJob = {
         id: job.id,
         task_id: job.task_id,
         status: job.status,
         progress: job.progress ? Math.round(job.progress * 100) : 0,
         error_msg: job.error_msg || undefined,
         metadata: typeof job.metadata === 'string' ? JSON.parse(job.metadata) : job.metadata
       }
    }
  } catch (error) {
    console.error('Failed to check for active jobs:', error)
    // Continue without active job info if database query fails
  }

  return {
    isConfigured: true,
    isIndexed,
    repositoryName: repository.name || repository.github_full_name,
    repositoryFullName: repository.github_full_name,
    branch: profile.active_branch,
    directory: profile.active_directory,
    lastSyncSha: repository.last_sync_sha,
    rootHash: repository.root_hash,
    hasActiveJob,
    activeJob,
  }
} 