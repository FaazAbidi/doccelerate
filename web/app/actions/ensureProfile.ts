'use server'

import { getUserUuid } from "./getUserUuid"
import { prisma } from "@/lib/prisma"

/**
 * Ensures the authenticated user has a profile entry
 */
export async function ensureProfile(): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getUserUuid()
    if (!userId) {
      return { success: false, error: "Not authenticated" }
    }

    // Check if profile exists
    const existingProfile = await prisma.profile.findUnique({
      where: { id: userId },
    })

    if (existingProfile) {
      return { success: true }
    }

    // Create profile if it doesn't exist
    await prisma.profile.create({
      data: {
        id: userId,
        // Basic profile with no GitHub connection initially
      }
    })

    return { success: true }
  } catch (error) {
    console.error("Error ensuring profile:", error)
    return { success: false, error: "Failed to create profile" }
  }
} 