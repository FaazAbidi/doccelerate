'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"

export interface SetActiveRepoRequest {
  repoId: string
  branch: string
  directory: string
}

/**
 * Sets a repository as active and configures its branch and directory settings
 * @param request - The repository ID and its configuration
 */
export async function setActiveRepoWithSettings(request: SetActiveRepoRequest): Promise<void> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  // Verify the repository belongs to the user
  const repository = await prisma.repo.findFirst({
    where: {
      id: request.repoId,
      owner_id: userId,
    },
  })

  if (!repository) {
    throw new Error("Repository not found or not accessible")
  }

  // Set the repository as active with configuration
  await prisma.profile.upsert({
    where: { id: userId },
    update: { 
      active_repo_id: request.repoId,
      active_branch: request.branch,
      active_directory: request.directory,
      updated_at: new Date(),
    },
    create: {
      id: userId,
      active_repo_id: request.repoId,
      active_branch: request.branch,
      active_directory: request.directory,
    },
  })
} 