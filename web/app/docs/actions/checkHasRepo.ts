'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"

/**
 * Checks if the currently authenticated user has an active repository selected.
 * 
 * @returns {Promise<boolean>} `true` if the user has an active repo, otherwise `false`.
 */
export async function checkHasRepo(): Promise<boolean> {
  const userId = await getUserUuid()
  if (!userId) return false

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { active_repo_id: true },
  })

  return !!profile?.active_repo_id
}
