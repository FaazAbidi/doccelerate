'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"

export type UserRepository = {
  id: string
  name: string | null
  fullName: string
  description: string | null
  isPublic: boolean
  defaultBranch: string
  githubUrl: string | null
  isActive: boolean
}

/**
 * Gets all repositories for the authenticated user and their active repo.
 */
export async function getUserRepos(): Promise<{
  repositories: UserRepository[]
  activeRepoId: string | null
  hasGithubConnection: boolean
}> {
  const userId = await getUserUuid()
  if (!userId) {
    return {
      repositories: [],
      activeRepoId: null,
      hasGithubConnection: false,
    }
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      active_repo_id: true,
      github_access_token: true,
    },
  })

  const repos = await prisma.repo.findMany({
    where: { owner_id: userId },
    orderBy: { updated_at: 'desc' },
  })

  const repositories: UserRepository[] = repos.map(repo => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.github_full_name,
    description: repo.description,
    isPublic: repo.is_public,
    defaultBranch: repo.default_branch,
    githubUrl: repo.github_url,
    isActive: repo.id === profile?.active_repo_id,
  }))

  return {
    repositories,
    activeRepoId: profile?.active_repo_id || null,
    hasGithubConnection: !!profile?.github_access_token,
  }
} 