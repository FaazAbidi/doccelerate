'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"

export interface ModifiedFilesInfo {
  hasModifiedFiles: boolean
  /** Total number of files with has_uncommitted_changes = true */
  modifiedCount: number
  /** Subset of modified files whose latest accepted suggestion is after last soft reindex */
  reindexCount: number
  lastModifiedAt: Date | null
  lastIndexedAt: Date | null
  needsReindex: boolean
}

/**
 * Checks if there are files that have been modified but not re-indexed
 * 
 * Logic:
 * 1. Get the most recent soft re-indexing job for the user's active repo
 * 2. Find files with uncommitted changes
 * 3. For each file, check the latest accepted suggestion time
 * 4. Only files with suggestions accepted AFTER the last soft re-index need re-indexing
 * 
 * @param useCache If false, will force a fresh data fetch bypassing any caching
 * @returns Information about modified files and indexing status
 */
export async function checkModifiedFiles(useCache: boolean = true): Promise<ModifiedFilesInfo> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  // Add cache-busting to prevent Prisma client caching
  if (!useCache) {
    // Force Prisma to create a fresh connection by disconnecting first
    try {
      await prisma.$disconnect()
    } catch (e) {
      console.warn('checkModifiedFiles: prisma.$disconnect failed', e)
    }
  }

  try {
    // Get the user's active repository
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      include: { active_repo: true }
    })

    if (!profile?.active_repo) {
      return {
        hasModifiedFiles: false,
        modifiedCount: 0,
        reindexCount: 0,
        lastModifiedAt: null,
        lastIndexedAt: null,
        needsReindex: false
      }
    }

    const repoId = profile.active_repo.id

    // Find files with uncommitted changes and their latest accepted suggestions
    const modifiedFiles = await prisma.file.findMany({
      where: {
        repo_id: repoId,
        has_uncommitted_changes: true
      },
      include: {
        suggestion: {
          where: {
            OR: [
              { status: 'applied' },
              { status: 'accepted' },
              {
                review_decision: {
                  some: {
                    reviewer_id: userId,
                    decision: { in: ['applied', 'accepted'] }
                  }
                }
              }
            ]
          },
          include: {
            review_decision: {
              where: {
                reviewer_id: userId,
                decision: { in: ['applied', 'accepted'] }
              }
            }
          },
          orderBy: {
            updated_at: 'desc'
          },
          take: 1 // Get only the most recent suggestion
        }
      },
      orderBy: {
        updated_at: 'desc'
      }
    })

    // Get the most recent SOFT re-indexing job for this repository
    const latestSoftIndexJob = await prisma.job.findFirst({
      where: {
        user_id: userId,
        type: 'index',
        status: 'completed',
        metadata: {
          path: ['repo_id'],
          equals: repoId
        },
        // Add filter for soft re-index jobs
        AND: [
          {
            metadata: {
              path: ['soft_reindex'],
              equals: true
            }
          }
        ]
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    // Use the completion time (updated_at) instead of start time (created_at)
    // Files only need re-indexing if modified AFTER the soft re-index completed
    const lastIndexedAt = latestSoftIndexJob?.updated_at || latestSoftIndexJob?.created_at || null
    const lastModifiedAt = modifiedFiles.length > 0 ? modifiedFiles[0].updated_at : null

    // Determine which files need re-indexing by checking if their latest accepted suggestion
    // was created after the last soft re-index job
    const filesNeedingReindex = modifiedFiles.filter(file => {
      if (!lastIndexedAt) {
        // No soft indexing job found, all modified files need reindex
        return true
      }
      
      // Get the latest suggestion acceptance timestamp
      const latestSuggestion = file.suggestion[0]
      if (!latestSuggestion) {
        // No accepted suggestions for this file, use file's updated_at time instead
        return file.updated_at && file.updated_at > lastIndexedAt
      }
      
      // Use either the suggestion's updated_at time or the review decision's decided_at time
      const latestReviewDecision = latestSuggestion.review_decision?.[0]
      const suggestionAcceptedAt = latestReviewDecision?.decided_at || latestSuggestion.updated_at
      
      // Only include files with suggestions accepted AFTER the last soft re-index job
      return suggestionAcceptedAt && suggestionAcceptedAt > lastIndexedAt
    })

    // If any files need re-indexing, show the notification
    const needsReindex = filesNeedingReindex.length > 0
    
    // Modified files are a subset of the ones with uncommitted changes
    // Only the ones with suggestions accepted after the last soft re-index need re-indexing
    const modifiedCount = filesNeedingReindex.length

    return {
      hasModifiedFiles: modifiedFiles.length > 0,
      modifiedCount: modifiedFiles.length, // total modified files
      reindexCount: modifiedCount, // files needing reindex
      lastModifiedAt,
      lastIndexedAt,
      needsReindex
    }
  } catch (error) {
    console.error("Failed to check modified files:", error)
    throw new Error("Failed to check for modified files")
  }
} 