'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"

export interface RepoSettings {
  repositoryName: string
  repositoryFullName: string
  branch: string
  directory: string
  defaultBranch: string
}

/**
 * Gets the current repository settings for the user's active repository
 * @returns Promise<RepoSettings | null> - The repository settings or null if no active repo
 */
export async function getRepoSettings(): Promise<RepoSettings | null> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    include: { 
      active_repo: true 
    },
  })

  if (!profile?.active_repo) {
    return null
  }

  return {
    repositoryName: profile.active_repo.name || profile.active_repo.github_full_name,
    repositoryFullName: profile.active_repo.github_full_name,
    branch: profile.active_branch || profile.active_repo.default_branch,
    directory: profile.active_directory || 'docs',
    defaultBranch: profile.active_repo.default_branch,
  }
} 