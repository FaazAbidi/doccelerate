'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { getOctokit } from "@/lib/octokit"
import { prisma } from "@/lib/prisma"

export type UpdateRepositoryAccessResult = {
  success: boolean
  error?: string
}

/**
 * Updates which repositories are included in the user's workspace
 * @param selectedRepoNames Array of repository full names (owner/repo) to include
 */
export async function updateRepositoryAccess(
  selectedRepoNames: string[]
): Promise<UpdateRepositoryAccessResult> {
  try {
    const userId = await getUserUuid()
    if (!userId) {
      return {
        success: false,
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
        error: "No GitHub account connected. Please connect your GitHub account first."
      }
    }

    const octokit = getOctokit(profile.github_access_token)

    // Get current repositories in the database
    const currentRepos = await prisma.repo.findMany({
      where: { owner_id: userId },
      select: { id: true, github_full_name: true },
    })

    const currentRepoNames = new Set(currentRepos.map(repo => repo.github_full_name))
    const selectedRepoNamesSet = new Set(selectedRepoNames)

    // Determine which repositories to add and remove
    const reposToAdd = selectedRepoNames.filter(name => !currentRepoNames.has(name))
    const reposToRemove = currentRepos.filter(repo => !selectedRepoNamesSet.has(repo.github_full_name))

    // Remove repositories that are no longer selected
    if (reposToRemove.length > 0) {
      const repoIdsToRemove = reposToRemove.map(repo => repo.id)
      
      // Get chunk hashes that need to be deleted
      const chunksToDelete = await prisma.file_chunk.findMany({
        where: {
          file: {
            repo_id: { in: repoIdsToRemove }
          }
        },
        select: { chunk_hash: true }
      })
      
      const chunkHashes = chunksToDelete.map(c => c.chunk_hash)
      
      // Delete in the correct order due to foreign key constraints
      await prisma.$transaction([
        // Delete file chunks first
        prisma.file_chunk.deleteMany({
          where: {
            file: {
              repo_id: { in: repoIdsToRemove }
            }
          }
        }),
        // Then delete chunks (only if they exist)
        ...(chunkHashes.length > 0 ? [
          prisma.chunk.deleteMany({
            where: {
              hash: { in: chunkHashes }
            }
          })
        ] : []),
        // Delete files
        prisma.file.deleteMany({
          where: { repo_id: { in: repoIdsToRemove } }
        }),
        // Finally delete repositories
        prisma.repo.deleteMany({
          where: { id: { in: repoIdsToRemove } }
        })
      ])

      console.log(`Removed ${reposToRemove.length} repositories from workspace`)
    }

    // Add new repositories
    for (const repoName of reposToAdd) {
      const [owner, name] = repoName.split('/')
      if (!owner || !name) {
        console.warn(`Invalid repository name format: ${repoName}`)
        continue
      }

      try {
        // Get repository details from GitHub
        const { data: repoData } = await octokit.repos.get({
          owner,
          repo: name,
        })

        // Add repository to database
        await prisma.repo.create({
          data: {
            github_id: repoData.id,
            name: repoData.name,
            github_full_name: repoData.full_name,
            description: repoData.description,
            is_public: !repoData.private,
            default_branch: repoData.default_branch,
            github_url: repoData.html_url,
            owner_id: userId,
          },
        })

        console.log(`Added repository: ${repoName}`)

      } catch (repoError) {
        console.error(`Failed to add repository ${repoName}:`, repoError)
        // Continue with other repositories rather than failing completely
      }
    }

    console.log(`Repository access updated: +${reposToAdd.length} -${reposToRemove.length}`)

    return {
      success: true,
    }

  } catch (error) {
    console.error("Error updating repository access:", error)
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        return {
          success: false,
          error: "GitHub access token is invalid. Please reconnect your GitHub account."
        }
      }
      if (error.message.includes('403')) {
        return {
          success: false,
          error: "GitHub API rate limit exceeded. Please try again later."
        }
      }
    }

    return {
      success: false,
      error: "Failed to update repository access"
    }
  }
} 