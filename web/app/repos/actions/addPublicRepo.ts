'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { getOctokit } from "@/lib/octokit"
import { prisma } from "@/lib/prisma"

/**
 * Adds a public GitHub repository to the user's collection.
 * Requires the user to have a connected GitHub account.
 * @param fullName - The full name of the repository (owner/repo-name)
 */
export async function addPublicRepo(fullName: string): Promise<void> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  // Get user's GitHub access token
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      github_access_token: true,
    },
  })

  if (!profile?.github_access_token) {
    throw new Error("No GitHub account connected. Please connect your GitHub account first.")
  }

  const octokit = getOctokit(profile.github_access_token)
  
  // Parse owner and repo name
  const [owner, repoName] = fullName.split('/')
  if (!owner || !repoName) {
    throw new Error("Invalid repository format. Use 'owner/repo-name'")
  }

  try {
    // Get repository info from GitHub
    const { data: repo } = await octokit.repos.get({
      owner,
      repo: repoName,
    })

    // Only allow public repositories
    if (repo.private) {
      throw new Error("Only public repositories can be added")
    }

    // Add repository to user's collection
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
  } catch (error: any) {
    if (error.status === 404) {
      throw new Error("Repository not found or not accessible")
    }
    throw error
  }
} 