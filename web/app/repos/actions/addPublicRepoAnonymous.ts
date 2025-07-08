'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"

/**
 * Adds a public GitHub repository to the user's collection without requiring GitHub authentication.
 * This provides basic repository information but cannot validate existence or fetch metadata.
 * @param fullName - The full name of the repository (owner/repo-name)
 */
export async function addPublicRepoAnonymous(fullName: string): Promise<void> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  // Parse owner and repo name
  const [owner, repoName] = fullName.split('/')
  if (!owner || !repoName) {
    throw new Error("Invalid repository format. Use 'owner/repo-name'")
  }

  // Basic validation
  if (owner.length === 0 || repoName.length === 0) {
    throw new Error("Repository owner and name cannot be empty")
  }

  // Check for obviously invalid characters
  const validPattern = /^[a-zA-Z0-9._-]+$/
  if (!validPattern.test(owner) || !validPattern.test(repoName)) {
    throw new Error("Repository name contains invalid characters")
  }

  try {
    // Add repository to user's collection with basic information
    // We cannot validate existence or fetch metadata without GitHub API
    await prisma.repo.upsert({
      where: {
        owner_id_github_full_name: {
          owner_id: userId,
          github_full_name: fullName,
        },
      },
      update: {
        name: repoName,
        description: "Repository added without GitHub connection - metadata unavailable",
        is_public: true, // Assume public since we can't verify
        default_branch: "main", // Default assumption
        github_url: `https://github.com/${fullName}`,
        updated_at: new Date(),
      },
      create: {
        owner_id: userId,
        github_full_name: fullName,
        name: repoName,
        description: "Repository added without GitHub connection - metadata unavailable",
        is_public: true,
        default_branch: "main",
        github_url: `https://github.com/${fullName}`,
      },
    })
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new Error("Repository already added to your workspace")
    }
    throw error
  }
} 