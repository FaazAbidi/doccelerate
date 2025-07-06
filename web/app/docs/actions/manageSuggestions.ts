'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"
import { AISuggestion } from '../types'

/**
 * Gets the active repository ID for the current user
 */
async function getActiveRepoId(): Promise<string | null> {
  const userId = await getUserUuid()
  if (!userId) return null

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { active_repo_id: true },
  })

  return profile?.active_repo_id || null
}

/**
 * Convert database suggestion to frontend type
 */
function mapSuggestionToType(dbSuggestion: any, filePath: string): AISuggestion {
  // Use review_decision status if available, otherwise fallback to suggestion status
  const reviewDecision = dbSuggestion.review_decision?.[0]
  const status = reviewDecision ? reviewDecision.decision : dbSuggestion.status

  return {
    id: dbSuggestion.id,
    fileId: dbSuggestion.file_id,
    filePath: filePath,
    patchUnifiedDiff: dbSuggestion.patch_unified_diff,
    status: status,
    confidence: dbSuggestion.confidence,
    modelUsed: dbSuggestion.model_used,
    createdAt: new Date(dbSuggestion.created_at),
    updatedAt: new Date(dbSuggestion.updated_at),
  }
}

/**
 * Gets all suggestions for the user's active repository
 */
export async function getSuggestions(): Promise<AISuggestion[]> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  const repoId = await getActiveRepoId()
  if (!repoId) {
    return [] // No active repo, return empty array
  }

  try {
    // Fetch suggestions for all files in the active repository with review decisions
    // We check both the suggestion status and review_decision status for consistency
    const suggestions = await prisma.suggestion.findMany({
      where: {
        file: {
          repo_id: repoId
        },
        AND: [
          {
            // Only get suggestions that have a review decision for this user
            review_decision: {
              some: {
                reviewer_id: userId
              }
            }
          },
          {
            OR: [
              // Either the suggestion status is pending
              { status: 'pending' },
              // Or the review_decision is pending (for backwards compatibility)
              {
                review_decision: {
                  some: {
                    reviewer_id: userId,
                    decision: 'pending'
                  }
                }
              }
            ]
          }
        ]
      },
      include: {
        file: {
          select: {
            path: true
          }
        },
        review_decision: {
          where: {
            reviewer_id: userId
          },
          select: {
            decision: true,
            decided_at: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return suggestions
      .filter(suggestion => {
        // Additional filtering to ensure we only return truly pending suggestions
        const reviewDecision = suggestion.review_decision?.[0]
        const effectiveStatus = reviewDecision ? reviewDecision.decision : suggestion.status
        return effectiveStatus === 'pending'
      })
      .map(suggestion => mapSuggestionToType(suggestion, suggestion.file.path))
  } catch (error) {
    console.error('Failed to fetch suggestions:', error)
    throw new Error('Failed to fetch suggestions')
  }
}

/**
 * Accepts a suggestion
 */
export async function acceptSuggestion(suggestionId: string): Promise<void> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  try {
    // Verify the suggestion belongs to a file in the user's active repo
    const suggestion = await prisma.suggestion.findFirst({
      where: {
        id: suggestionId,
        file: {
          repo: {
            owner_id: userId
          }
        }
      }
    })

    if (!suggestion) {
      throw new Error("Suggestion not found or not accessible")
    }

    // Use a transaction to update both tables atomically
    await prisma.$transaction([
      // Update the review_decision record
      prisma.review_decision.upsert({
        where: {
          suggestion_id_reviewer_id: {
            suggestion_id: suggestionId,
            reviewer_id: userId
          }
        },
        update: {
          decision: 'accepted',
          decided_at: new Date()
        },
        create: {
          suggestion_id: suggestionId,
          reviewer_id: userId,
          decision: 'accepted',
          decided_at: new Date()
        }
      }),
      // Update the suggestion status to maintain consistency
      prisma.suggestion.update({
        where: {
          id: suggestionId
        },
        data: {
          status: 'accepted',
          updated_at: new Date()
        }
      })
    ])
  } catch (error) {
    console.error('Failed to accept suggestion:', error)
    throw new Error('Failed to accept suggestion')
  }
}

/**
 * Rejects a suggestion
 */
export async function rejectSuggestion(suggestionId: string): Promise<void> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  try {
    // Verify the suggestion belongs to a file in the user's active repo
    const suggestion = await prisma.suggestion.findFirst({
      where: {
        id: suggestionId,
        file: {
          repo: {
            owner_id: userId
          }
        }
      }
    })

    if (!suggestion) {
      throw new Error("Suggestion not found or not accessible")
    }

    // Use a transaction to update both tables atomically
    await prisma.$transaction([
      // Update the review_decision record
      prisma.review_decision.upsert({
        where: {
          suggestion_id_reviewer_id: {
            suggestion_id: suggestionId,
            reviewer_id: userId
          }
        },
        update: {
          decision: 'rejected',
          decided_at: new Date()
        },
        create: {
          suggestion_id: suggestionId,
          reviewer_id: userId,
          decision: 'rejected',
          decided_at: new Date()
        }
      }),
      // Update the suggestion status to maintain consistency
      prisma.suggestion.update({
        where: {
          id: suggestionId
        },
        data: {
          status: 'rejected',
          updated_at: new Date()
        }
      })
    ])
  } catch (error) {
    console.error('Failed to reject suggestion:', error)
    throw new Error('Failed to reject suggestion')
  }
}

/**
 * Applies a suggestion (marks as applied)
 */
export async function applySuggestion(suggestionId: string): Promise<void> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  try {
    // Verify the suggestion belongs to a file in the user's active repo
    const suggestion = await prisma.suggestion.findFirst({
      where: {
        id: suggestionId,
        file: {
          repo: {
            owner_id: userId
          }
        }
      },
      include: {
        file: {
          select: {
            path: true
          }
        }
      }
    })

    if (!suggestion) {
      throw new Error("Suggestion not found or not accessible")
    }

    // Use a transaction to update both tables atomically
    await prisma.$transaction([
      // Update the review_decision record
      prisma.review_decision.upsert({
        where: {
          suggestion_id_reviewer_id: {
            suggestion_id: suggestionId,
            reviewer_id: userId
          }
        },
        update: {
          decision: 'applied',
          decided_at: new Date()
        },
        create: {
          suggestion_id: suggestionId,
          reviewer_id: userId,
          decision: 'applied',
          decided_at: new Date()
        }
      }),
      // Update the suggestion status to maintain consistency
      prisma.suggestion.update({
        where: {
          id: suggestionId
        },
        data: {
          status: 'applied',
          updated_at: new Date()
        }
      })
    ])

    // TODO: In the future, this could trigger actual file modification
    console.log(`Applied suggestion ${suggestionId} to ${suggestion.file.path}`)
  } catch (error) {
    console.error('Failed to apply suggestion:', error)
    throw new Error('Failed to apply suggestion')
  }
}

/**
 * Add suggestions (this is now handled by the backend API, but kept for compatibility)
 */
export async function addSuggestions(suggestions: AISuggestion[]): Promise<void> {
  // This function is kept for compatibility with the frontend
  // In practice, suggestions are now created by the backend API via the /query endpoint
  console.log('addSuggestions called, but suggestions are now managed by the backend')
  // Use the suggestions parameter to avoid TypeScript error
  void suggestions
}

/**
 * Clear all suggestions for the active repository
 */
export async function clearAllSuggestions(): Promise<void> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  const repoId = await getActiveRepoId()
  if (!repoId) {
    return // No active repo
  }

  try {
    await prisma.suggestion.deleteMany({
      where: {
        file: {
          repo_id: repoId
        }
      }
    })
  } catch (error) {
    console.error('Failed to clear suggestions:', error)
    throw new Error('Failed to clear suggestions')
  }
}

/**
 * Get suggestions by status
 */
export async function getSuggestionsByStatus(status: 'pending' | 'accepted' | 'rejected' | 'applied'): Promise<AISuggestion[]> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  const repoId = await getActiveRepoId()
  if (!repoId) {
    return [] // No active repo
  }

  try {
    const suggestions = await prisma.suggestion.findMany({
      where: {
        file: {
          repo_id: repoId
        },
        review_decision: {
          some: {
            reviewer_id: userId,
            decision: status
          }
        }
      },
      include: {
        file: {
          select: {
            path: true
          }
        },
        review_decision: {
          where: {
            reviewer_id: userId
          },
          select: {
            decision: true,
            decided_at: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return suggestions.map(suggestion => 
      mapSuggestionToType(suggestion, suggestion.file.path)
    )
  } catch (error) {
    console.error('Failed to fetch suggestions by status:', error)
    throw new Error('Failed to fetch suggestions by status')
  }
}

/**
 * Get suggestion by ID
 */
export async function getSuggestionById(suggestionId: string): Promise<AISuggestion | null> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  try {
    const suggestion = await prisma.suggestion.findFirst({
      where: {
        id: suggestionId,
        file: {
          repo: {
            owner_id: userId
          }
        }
      },
      include: {
        file: {
          select: {
            path: true
          }
        },
        review_decision: {
          where: {
            reviewer_id: userId
          },
          select: {
            decision: true,
            decided_at: true
          }
        }
      }
    })

    if (!suggestion) {
      return null
    }

    return mapSuggestionToType(suggestion, suggestion.file.path)
  } catch (error) {
    console.error('Failed to fetch suggestion by ID:', error)
    throw new Error('Failed to fetch suggestion by ID')
  }
}

/**
 * Synchronize suggestion status with review_decision status for all suggestions
 * This function fixes any inconsistencies between the two tables
 */
export async function synchronizeSuggestionStatus(): Promise<void> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  const repoId = await getActiveRepoId()
  if (!repoId) {
    return // No active repo
  }

  try {
    // Find all suggestions where the status doesn't match the review_decision
    const inconsistentSuggestions = await prisma.suggestion.findMany({
      where: {
        file: {
          repo_id: repoId
        }
      },
      include: {
        review_decision: {
          where: {
            reviewer_id: userId
          }
        }
      }
    })

    // Process each suggestion in batches
    const updates = []
    for (const suggestion of inconsistentSuggestions) {
      const reviewDecision = suggestion.review_decision[0]
      
      // If there's a review decision and it differs from the suggestion status
      if (reviewDecision && reviewDecision.decision !== suggestion.status) {
        updates.push(
          prisma.suggestion.update({
            where: {
              id: suggestion.id
            },
            data: {
              status: reviewDecision.decision,
              updated_at: new Date()
            }
          })
        )
      }
    }

    // Execute all updates in a transaction
    if (updates.length > 0) {
      await prisma.$transaction(updates)
      console.log(`Synchronized ${updates.length} suggestions`)
    }
  } catch (error) {
    console.error('Failed to synchronize suggestion status:', error)
    throw new Error('Failed to synchronize suggestion status')
  }
} 