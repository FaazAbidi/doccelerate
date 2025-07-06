'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { getOctokit } from "@/lib/octokit"
import { prisma } from "@/lib/prisma"

/**
 * Syncs the authenticated user's GitHub repositories to the database.
 * Requires the user to have a connected GitHub account.
 */
export async function syncUserRepos(): Promise<void> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  // Get user's profile with GitHub access token
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      github_access_token: true,
      github_username: true,
      full_name: true,
    },
  })

  if (!profile?.github_access_token) {
    throw new Error("No GitHub account connected. Please connect your GitHub account first.")
  }

  const octokit = getOctokit(profile.github_access_token)

  // Get user's GitHub profile to sync latest info
  const { data: githubUser } = await octokit.users.getAuthenticated()
  
  // Get user's repositories
  const { data: repos } = await octokit.repos.listForAuthenticatedUser({
    per_page: 100,
    sort: "pushed",
  })

  // Update profile with latest GitHub info
  await prisma.profile.update({
    where: { id: userId },
    data: {
      github_username: githubUser.login,
      github_avatar_url: githubUser.avatar_url,
      updated_at: new Date(),
    },
  })

  // Sync repositories
  for (const repo of repos) {
    await prisma.repo.upsert({
      where: {
        owner_id_github_full_name: {
          owner_id: userId,
          github_full_name: repo.full_name,
        },
      },
      update: {
        name: repo.name,
        description: repo.description,
        is_public: !repo.private,
        default_branch: repo.default_branch || "main",
        github_id: repo.id,
        github_url: repo.html_url,
        updated_at: new Date(),
      },
      create: {
        owner_id: userId,
        github_full_name: repo.full_name,
        name: repo.name,
        description: repo.description,
        is_public: !repo.private,
        default_branch: repo.default_branch || "main",
        github_id: repo.id,
        github_url: repo.html_url,
      },
    })
  }
} 