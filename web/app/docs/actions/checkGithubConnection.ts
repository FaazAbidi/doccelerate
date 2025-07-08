'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"

/**
 * Checks if the user has a GitHub connection (access token)
 * @returns Promise<boolean> - true if user has GitHub access token, false otherwise
 */
export async function checkGithubConnection(): Promise<boolean> {
  const userId = await getUserUuid()
  if (!userId) {
    return false
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { github_access_token: true },
  })

  return !!(profile?.github_access_token)
} 