'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { config } from "@/lib/config"

export interface StartIndexingResponse {
  success: boolean
  task_id?: string
  status?: string
  repo?: string
  branch?: string
  directory?: string
  message: string
}

/**
 * Starts the indexing process for the user's active repository
 * @returns Promise<StartIndexingResponse> - The response from the indexing service
 */
export async function startIndexing(): Promise<StartIndexingResponse> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  try {
    // Call the backend indexing API
    console.log(`${config.apiBaseUrl}/index`)
    const response = await fetch(`${config.apiBaseUrl}/index`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `API error: ${response.status}`)
    }

    const data = await response.json()
    
    return {
      success: true,
      task_id: data.task_id,
      status: data.status,
      repo: data.repo,
      branch: data.branch,
      directory: data.directory,
      message: "Repository indexing started successfully"
    }
  } catch (error) {
    console.error('Failed to start indexing:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to start repository indexing"
    }
  }
} 