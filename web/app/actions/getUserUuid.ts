'use server'

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

/**
 * Safely gets the authenticated user's UUID.
 * Handles cases where the session might contain old GitHub IDs instead of UUIDs.
 * 
 * @returns {Promise<string | null>} The user's UUID or null if not authenticated or invalid format
 */
export async function getUserUuid(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const userId = session.user.id

  // Check if the ID looks like a UUID (36 characters with hyphens)
  // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  
  if (uuidRegex.test(userId)) {
    return userId
  }

  // If not a UUID, it's likely an old GitHub ID format
  console.warn('Session contains non-UUID format ID (likely old GitHub ID):', userId)
  return null
}

/**
 * Checks if the current session has a valid UUID format
 */
export async function hasValidSession(): Promise<boolean> {
  const uuid = await getUserUuid()
  return uuid !== null
} 