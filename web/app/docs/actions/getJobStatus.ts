'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"

export interface JobStatus {
  id: string
  task_id: string
  user_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  type: 'index' | 'query'
  progress?: number // 0.0 to 1.0
  error_msg?: string
  metadata?: {
    repo_id?: string
    repo_name?: string
    branch?: string
    directory?: string
    current_step?: string
    [key: string]: any
  }
  created_at: string
  updated_at: string
}

/**
 * Get job status by task ID
 */
export async function getJobStatus(taskId: string): Promise<JobStatus | null> {
  try {
    const userId = await getUserUuid()
    if (!userId) {
      throw new Error("Not authenticated")
    }

    const job = await prisma.job.findFirst({
      where: {
        task_id: taskId,
        user_id: userId
      }
    })

    if (!job) {
      return null // Job not found
    }
    
    return {
      id: job.id,
      task_id: job.task_id,
      user_id: job.user_id,
      status: job.status,
      type: job.type,
      progress: job.progress || undefined,
      error_msg: job.error_msg || undefined,
      metadata: typeof job.metadata === 'string' ? JSON.parse(job.metadata) : job.metadata,
      created_at: job.created_at?.toISOString() || '',
      updated_at: job.updated_at?.toISOString() || '',
    }
  } catch (error) {
    console.error('Failed to get job status:', error)
    throw error
  }
}

/**
 * Get active jobs for a user by type
 */
export async function getActiveJobs(type?: 'index' | 'query'): Promise<JobStatus[]> {
  try {
    const userId = await getUserUuid()
    if (!userId) {
      throw new Error("Not authenticated")
    }

    const whereClause: any = {
      user_id: userId,
      status: { in: ['pending', 'running'] }
    }
    
    if (type) {
      whereClause.type = type
    }

    const jobs = await prisma.job.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' }
    })
    
    return jobs.map((job) => ({
      id: job.id,
      task_id: job.task_id,
      user_id: job.user_id,
      status: job.status,
      type: job.type,
      progress: job.progress || undefined,
      error_msg: job.error_msg || undefined,
      metadata: typeof job.metadata === 'string' ? JSON.parse(job.metadata) : job.metadata,
      created_at: job.created_at?.toISOString() || '',
      updated_at: job.updated_at?.toISOString() || '',
    }))
  } catch (error) {
    console.error('Failed to get active jobs:', error)
    throw error
  }
}

/**
 * Get query job status specifically (convenience function)
 */
export async function getQueryJobStatus(taskId: string): Promise<JobStatus | null> {
  const job = await getJobStatus(taskId)
  if (job && job.type === 'query') {
    return job
  }
  return null
}

/**
 * Get all query jobs for a user (both active and completed)
 */
export async function getUserQueryJobs(): Promise<JobStatus[]> {
  try {
    const userId = await getUserUuid()
    if (!userId) {
      throw new Error("Not authenticated")
    }

    const jobs = await prisma.job.findMany({
      where: {
        user_id: userId,
        type: 'query'
      },
      orderBy: { created_at: 'desc' }
    })
    
    return jobs.map((job) => ({
      id: job.id,
      task_id: job.task_id,
      user_id: job.user_id,
      status: job.status,
      type: job.type,
      progress: job.progress || undefined,
      error_msg: job.error_msg || undefined,
      metadata: typeof job.metadata === 'string' ? JSON.parse(job.metadata) : job.metadata,
      created_at: job.created_at?.toISOString() || '',
      updated_at: job.updated_at?.toISOString() || '',
    }))
  } catch (error) {
    console.error('Failed to get query jobs:', error)
    throw error
  }
}

/**
 * Get specific job by task ID for polling completion status
 */
export async function getJobByTaskId(taskId: string): Promise<JobStatus | null> {
  try {
    const userId = await getUserUuid()
    if (!userId) {
      throw new Error("Not authenticated")
    }

    const job = await prisma.job.findUnique({
      where: {
        task_id: taskId,
        user_id: userId // Ensure user can only access their own jobs
      }
    })
    
    if (!job) {
      return null
    }
    
    return {
      id: job.id,
      task_id: job.task_id,
      user_id: job.user_id,
      status: job.status,
      type: job.type,
      progress: job.progress || undefined,
      error_msg: job.error_msg || undefined,
      metadata: typeof job.metadata === 'string' ? JSON.parse(job.metadata) : job.metadata,
      created_at: job.created_at?.toISOString() || '',
      updated_at: job.updated_at?.toISOString() || '',
    }
  } catch (error) {
    console.error('Failed to get job by task ID:', error)
    throw error
  }
} 