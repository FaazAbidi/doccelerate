'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"

export interface UpdateRepoSettingsRequest {
  branch: string
  directory: string
}

/**
 * Updates the branch and directory settings for the user's active repository
 * @param request - The new branch and directory settings
 */
export async function updateRepoSettings(request: UpdateRepoSettingsRequest): Promise<void> {
  const userId = await getUserUuid()
  if (!userId) {
    throw new Error("Not authenticated")
  }

  // Verify the user has an active repository
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    include: { active_repo: true },
  })

  if (!profile?.active_repo) {
    throw new Error("No active repository found")
  }

  // Update the repository settings
  await prisma.profile.update({
    where: { id: userId },
    data: { 
      active_branch: request.branch,
      active_directory: request.directory,
      updated_at: new Date(),
    },
  })
} 