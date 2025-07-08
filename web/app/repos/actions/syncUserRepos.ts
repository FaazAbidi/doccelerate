'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { getOctokit } from "@/lib/octokit"
import { prisma } from "@/lib/prisma"

/**
 * Syncs metadata for repositories currently included in the user's workspace.
 * Only updates repositories that the user has already selected to include.
 * Does not automatically add new repositories - users must select them via repository management.
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

  // Update profile with latest GitHub info
  await prisma.profile.update({
    where: { id: userId },
    data: {
      github_username: githubUser.login,
      github_avatar_url: githubUser.avatar_url,
      updated_at: new Date(),
    },
  })

  // Get repositories currently included in user's workspace
  const includedRepos = await prisma.repo.findMany({
    where: { owner_id: userId },
    select: { 
      id: true,
      github_full_name: true,
      github_id: true 
    },
  })

  if (includedRepos.length === 0) {
    console.log("No repositories currently included in workspace - skipping sync")
    return
  }

  console.log(`Syncing metadata for ${includedRepos.length} included repositories`)

  // Sync metadata for each included repository
  for (const repoRecord of includedRepos) {
    const [owner, name] = repoRecord.github_full_name.split('/')
    if (!owner || !name) {
      console.warn(`Invalid repository name format: ${repoRecord.github_full_name}`)
      continue
    }

    try {
      // Get latest repository data from GitHub
      const { data: repoData } = await octokit.repos.get({
        owner,
        repo: name,
      })

              // Update repository metadata
        await prisma.repo.update({
          where: { id: repoRecord.id },
          data: {
            name: repoData.name,
            description: repoData.description,
            is_public: !repoData.private,
            default_branch: repoData.default_branch || "main",
            github_id: repoData.id,
            github_url: repoData.html_url,
            updated_at: new Date(),
          },
        })

      console.log(`Synced repository: ${repoRecord.github_full_name}`)

    } catch (error) {
      console.error(`Failed to sync repository ${repoRecord.github_full_name}:`, error)
      
      // Handle specific cases where repository might no longer be accessible
      if (error instanceof Error && (
        error.message.includes('404') || 
        error.message.includes('Not Found')
      )) {
        console.warn(`Repository ${repoRecord.github_full_name} is no longer accessible - consider removing it`)
        // Could optionally mark the repository as inaccessible or remove it
        // For now, we'll just log the warning
      }
    }
  }

  console.log(`Repository sync completed for ${includedRepos.length} repositories`)
} 