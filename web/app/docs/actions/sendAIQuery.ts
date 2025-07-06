'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { AISuggestion, QueryResponse } from '../types'

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
 * Sends an AI query to process documentation changes
 * @param message - The natural language change request
 * @returns Promise<QueryResponse> - The query response with task information
 */
export async function sendAIQuery(message: string): Promise<QueryResponse> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  const repoId = await getActiveRepoId()
  if (!repoId) {
    throw new Error("No active repository selected. Please select a repository first.")
  }

  try {
    // Call the backend query API
    const response = await fetch(`${config.apiBaseUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: message,
        user_id: userId,
        repo_id: repoId
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Return the response in the expected format
    // The API returns 202 Accepted with task_id, but suggestions will come later via real-time updates
    const queryResponse: QueryResponse = {
      id: Date.now().toString(),
      queryId: data.task_id,
      message: data.message || "Query processing started. Suggestions will appear when ready.",
      suggestions: [], // Suggestions will be populated via real-time updates
      taskId: data.task_id,
      status: 'processing', // Start as processing since we just queued the task
      timestamp: new Date(),
    }

    return queryResponse
    
  } catch (error) {
    console.error('Failed to send AI query:', error)
    throw error
  }
}
