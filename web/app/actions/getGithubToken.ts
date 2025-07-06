'use server'

import { getUserUuid } from "./getUserUuid"
import { prisma } from "@/lib/prisma"

/**
 * Gets the GitHub access token for the current authenticated user
 */
export async function getGithubToken(): Promise<string | null> {
  const userId = await getUserUuid()
  if (!userId) return null

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      github_access_token: true,
    },
  })

  return profile?.github_access_token || null
}

/**
 * Checks if the current user has a GitHub connection
 */
export async function hasGithubConnection(): Promise<boolean> {
  const token = await getGithubToken()
  return !!token
} 