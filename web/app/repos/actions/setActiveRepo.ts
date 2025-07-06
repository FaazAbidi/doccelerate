'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"

/**
 * Sets the active repository for the authenticated user.
 * @param repoId - The ID of the repository to set as active
 */
export async function setActiveRepo(repoId: string): Promise<void> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  // Verify the repository belongs to the user
  const repository = await prisma.repo.findFirst({
    where: {
      id: repoId,
      owner_id: userId,
    },
  })

  if (!repository) {
    throw new Error("Repository not found or not accessible")
  }

  // Ensure profile exists and update active repository
  await prisma.profile.upsert({
    where: { id: userId },
    update: { 
      active_repo_id: repoId,
      updated_at: new Date(),
    },
    create: {
      id: userId,
      active_repo_id: repoId,
    },
  })
} 