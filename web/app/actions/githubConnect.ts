'use server'

import { getUserUuid } from "./getUserUuid"
import { prisma } from "@/lib/prisma"

export type GithubUserData = {
  id: string // GitHub user ID
  login: string // GitHub username
  email: string | null
  name: string | null
  avatar_url: string | null
}

/**
 * Connects a GitHub account to the current user's profile
 */
export async function connectGithubAccount(
  githubUser: GithubUserData,
  accessToken: string,
  scope?: string // Optional scope parameter to track permissions
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getUserUuid()
    if (!userId) {
      return { success: false, error: "Not authenticated" }
    }

    // Check if another user already has this GitHub account connected
    const existingProfile = await prisma.profile.findUnique({
      where: { github_id: githubUser.id },
    })

    if (existingProfile && existingProfile.id !== userId) {
      return { success: false, error: "This GitHub account is already connected to another user" }
    }

    // Update the user's profile with GitHub connection
    await prisma.profile.upsert({
      where: { id: userId },
      update: {
        github_id: githubUser.id,
        github_username: githubUser.login,
        github_access_token: accessToken,
        github_avatar_url: githubUser.avatar_url,
        updated_at: new Date(),
      },
      create: {
        id: userId,
        github_id: githubUser.id,
        github_username: githubUser.login,
        github_access_token: accessToken,
        github_avatar_url: githubUser.avatar_url,
      }
    })

    // Log the scope for debugging - we can add scope storage to database later
    if (scope) {
      console.log(`GitHub OAuth completed for user ${githubUser.login} with scope: ${scope}`)
    }

    return { success: true }
  } catch (error) {
    console.error("Error connecting GitHub account:", error)
    return { success: false, error: "Failed to connect GitHub account" }
  }
}

/**
 * Disconnects GitHub account from the current user's profile
 */
export async function disconnectGithubAccount(): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getUserUuid()
    if (!userId) {
      return { success: false, error: "Not authenticated" }
    }

    await prisma.profile.update({
      where: { id: userId },
      data: {
        github_id: null,
        github_username: null,
        github_access_token: null,
        github_avatar_url: null,
        updated_at: new Date(),
      }
    })

    return { success: true }
  } catch (error) {
    console.error("Error disconnecting GitHub account:", error)
    return { success: false, error: "Failed to disconnect GitHub account" }
  }
} 