'use server'

import { getGithubToken } from "@/app/actions/getGithubToken"
import { getOctokit } from "@/lib/octokit"

export interface RepoBranch {
  name: string
  sha: string
  protected: boolean
}

/**
 * Fetches all branches for a given repository
 * @param fullName - The full name of the repository (owner/repo)
 * @returns Promise<RepoBranch[]> - Array of repository branches
 */
export async function getRepoBranches(fullName: string): Promise<RepoBranch[]> {
  try {
    const token = await getGithubToken()
    const [owner, repo] = fullName.split('/')
    
    if (!owner || !repo) {
      throw new Error("Invalid repository full name")
    }

    // If no token is available, return default branches for anonymous repositories
    if (!token) {
      return [
        {
          name: 'main',
          sha: 'anonymous',
          protected: false
        },
        {
          name: 'master',
          sha: 'anonymous',
          protected: false
        }
      ];
    }

    // Continue with normal GitHub API call if token is available
    const response = await getOctokit(token).rest.repos.listBranches({
      owner,
      repo,
      per_page: 100, // Get up to 100 branches
    })

    return response.data.map((branch: any) => ({
      name: branch.name,
      sha: branch.commit.sha,
      protected: branch.protected || false,
    }))
  } catch (error) {
    console.error('Failed to fetch repository branches:', error)
    throw new Error("Failed to fetch repository branches")
  }
} 