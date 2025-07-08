'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { getOctokit } from "@/lib/octokit"
import { prisma } from "@/lib/prisma"

export type GitHubRepository = {
  id: number
  name: string
  fullName: string
  description: string | null
  isPrivate: boolean
  isIncluded: boolean // Whether this repo is currently included in user's workspace
  language: string | null
  updatedAt: string
  githubUrl: string
}

export type GetGithubRepositoriesResult = {
  success: boolean
  repositories: GitHubRepository[]
  error?: string
}

/**
 * Fetches all GitHub repositories available to the user and indicates which ones are currently included
 */
export async function getGithubRepositories(): Promise<GetGithubRepositoriesResult> {
  try {
    const userId = await getUserUuid()
    if (!userId) {
      return {
        success: false,
        repositories: [],
        error: "Not authenticated"
      }
    }

    // Get user's profile with GitHub access token
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: {
        github_access_token: true,
        github_username: true,
      },
    })

    if (!profile?.github_access_token) {
      return {
        success: false,
        repositories: [],
        error: "No GitHub account connected. Please connect your GitHub account first."
      }
    }

    const octokit = getOctokit(profile.github_access_token)

    // Get all repositories the user has access to
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: "updated",
      affiliation: "owner,collaborator,organization_member", // Include all repos user has access to
    })

    // Get currently included repositories from database
    const includedRepos = await prisma.repo.findMany({
      where: { owner_id: userId },
      select: { github_full_name: true },
    })

    const includedRepoNames = new Set(includedRepos.map(repo => repo.github_full_name))

    // Transform GitHub API response to our format
    const repositories: GitHubRepository[] = repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      isPrivate: repo.private,
      isIncluded: includedRepoNames.has(repo.full_name),
      language: repo.language,
      updatedAt: repo.updated_at || new Date().toISOString(),
      githubUrl: repo.html_url,
    }))

    return {
      success: true,
      repositories,
    }

  } catch (error) {
    console.error("Error fetching GitHub repositories:", error)
    
    // Handle specific GitHub API errors
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        return {
          success: false,
          repositories: [],
          error: "GitHub access token is invalid. Please reconnect your GitHub account."
        }
      }
      if (error.message.includes('403')) {
        return {
          success: false,
          repositories: [],
          error: "GitHub API rate limit exceeded. Please try again later."
        }
      }
    }

    return {
      success: false,
      repositories: [],
      error: "Failed to fetch GitHub repositories"
    }
  }
} 