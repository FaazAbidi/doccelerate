'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { getOctokit } from "@/lib/octokit"
import { prisma } from "@/lib/prisma"
import { Buffer } from "buffer"

/**
 * Fetches the README.md content from the authenticated user's active repository.
 * Returns the Markdown string if found or `null` otherwise.
 */
export async function getReadme(): Promise<string | null> {
  const userId = await getUserUuid()
  if (!userId) return null

  // Get user's active repository and GitHub access token
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      github_access_token: true,
      active_repo: true,
    },
  })

  if (!profile?.active_repo || !profile.github_access_token) return null

  const repository = profile.active_repo
  const octokit = getOctokit(profile.github_access_token)

  try {
    // Extract owner and repo name from github_full_name
    const [owner, repoName] = repository.github_full_name.split('/')
    
    const { data } = await octokit.repos.getContent({
      owner,
      repo: repoName,
      path: "README.md",
      ref: repository.default_branch,
    })

    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      return null
    }

    const markdown = Buffer.from((data as any).content, "base64").toString("utf-8")
    return markdown
  } catch {
    // README not found or other error
    return null
  }
} 