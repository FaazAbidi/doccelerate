'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"
import { getOctokit } from "@/lib/octokit"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { startSoftReindexing } from "./startIndexing"

export interface PushChangesRequest {
  commitMessage: string
}

export interface PushChangesResponse {
  success: boolean
  commitSha?: string
  message: string
}

/**
 * Commits all files marked with `has_uncommitted_changes` in the
 * user's active repository to the configured GitHub branch.
 *
 * After a successful push we reset `has_uncommitted_changes` to false,
 * update `repo.last_sync_sha`, and trigger a soft re-index so embeddings stay fresh.
 */
export async function pushChangesToGithub(
  req: PushChangesRequest
): Promise<PushChangesResponse> {
  const userId = await getUserUuid()
  if (!userId) {
    return {
      success: false,
      message: "Not authenticated",
    }
  }

  // Fetch profile with GitHub details and active repo
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    include: {
      active_repo: true,
    },
  })

  if (!profile || !profile.github_access_token) {
    return { success: false, message: "GitHub account not connected" }
  }

  if (!profile.active_repo) {
    return { success: false, message: "No active repository selected" }
  }

  if (!profile.active_branch) {
    return { success: false, message: "No active branch configured" }
  }

  const octokit = getOctokit(profile.github_access_token)

  const [owner, repoName] = profile.active_repo.github_full_name.split("/")
  const branch = profile.active_branch

  // Ensure the token has push permission
  try {
    const { data: repoData } = await octokit.repos.get({ owner, repo: repoName })
    if (!repoData.permissions?.push) {
      return {
        success: false,
        message:
          "Your GitHub token lacks write permission for this repository.",
      }
    }
  } catch {
    // Could not fetch permissions – treat as insufficient rights
    return {
      success: false,
      message:
        "Unable to verify repository permissions.",
    }
  }

  try {
    // 1. Get latest commit on branch
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo: repoName,
      ref: `heads/${branch}`,
    })
    const latestCommitSha = refData.object.sha

    // 2. Get tree SHA for latest commit
    const {
      data: {
        tree: { sha: baseTreeSha },
      },
    } = await octokit.git.getCommit({ owner, repo: repoName, commit_sha: latestCommitSha })

    // 3. Collect modified files from DB
    const modifiedFiles = await prisma.file.findMany({
      where: {
        repo_id: profile.active_repo.id,
        has_uncommitted_changes: true,
      },
      select: {
        id: true,
        path: true,
        storage_key: true,
      },
    })

    if (modifiedFiles.length === 0) {
      return { success: false, message: "No modified files to commit" }
    }

    // 4. Download content from Supabase and create blobs
    const supabase = await createSupabaseServerClient()

    const treeItems: {
      path: string
      mode: "100644"
      type: "blob"
      sha: string
    }[] = []

    for (const file of modifiedFiles) {
      const storagePathWithoutPrefix = file.storage_key.startsWith("docs/")
        ? file.storage_key.substring(5)
        : file.storage_key

      const { data: downloadData, error: downloadError } = await supabase.storage
        .from("docs")
        .download(storagePathWithoutPrefix)

      if (downloadError || !downloadData) {
        throw new Error(`Failed to download ${file.path}: ${downloadError?.message}`)
      }

      const content = await downloadData.text()

      // Git expects LF line endings; ensure consistency
      const normalizedContent = content.replace(/\r\n/g, "\n")

      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo: repoName,
        content: normalizedContent,
        encoding: "utf-8",
      })

      treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha })
    }

    // 5. Create new tree
    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      base_tree: baseTreeSha,
      tree: treeItems,
    })

    // 6. Create commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: req.commitMessage,
      tree: newTree.sha,
      parents: [latestCommitSha],
    })

    // 7. Update ref to point to new commit
    await octokit.git.updateRef({
      owner,
      repo: repoName,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    })

    // 8. DB updates & soft re-index wrapped in transaction
    await prisma.$transaction([
      prisma.file.updateMany({
        where: {
          repo_id: profile.active_repo.id,
          has_uncommitted_changes: true,
        },
        data: {
          has_uncommitted_changes: false,
          updated_at: new Date(),
        },
      }),
      prisma.repo.update({
        where: { id: profile.active_repo.id },
        data: {
          last_sync_sha: newCommit.sha,
          updated_at: new Date(),
        },
      }),
    ])

    // 9. Trigger a soft re-index (fire-and-forget)
    try {
      await startSoftReindexing()
    } catch (e) {
      console.error("Soft re-index trigger failed", e)
    }

    return { success: true, commitSha: newCommit.sha, message: "Changes pushed successfully" }
  } catch (err: any) {
    const msg = err?.status === 403
      ? "Permission denied: Your token does not allow pushing to this branch. Reconnect GitHub with the correct scopes or choose a fork."
      : err?.message || "Commit failed"

    console.error("pushChangesToGithub error", err)
    return { success: false, message: msg }
  }
} 