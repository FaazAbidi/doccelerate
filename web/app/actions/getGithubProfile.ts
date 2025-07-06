'use server'

import { getUserUuid } from "./getUserUuid"
import { prisma } from "@/lib/prisma"

export type GithubProfile = {
  isConnected: boolean
  username: string | null
  avatarUrl: string | null
  githubId: string | null
}

/**
 * Gets the GitHub profile information for the current authenticated user
 */
export async function getGithubProfile(): Promise<GithubProfile> {
  const userId = await getUserUuid()
  if (!userId) {
    return {
      isConnected: false,
      username: null,
      avatarUrl: null,
      githubId: null,
    }
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      github_id: true,
      github_username: true,
      github_avatar_url: true,
      github_access_token: true,
    },
  })

  return {
    isConnected: !!profile?.github_access_token,
    username: profile?.github_username || null,
    avatarUrl: profile?.github_avatar_url || null,
    githubId: profile?.github_id || null,
  }
} 