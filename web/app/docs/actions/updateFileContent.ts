'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { createHash } from 'crypto'

/**
 * Updates the content of a file in storage and database.
 * Returns success status.
 */
export async function updateFileContent(filePath: string, content: string): Promise<boolean> {
  const userId = await getUserUuid()
  if (!userId) return false

  // Get user's active repository
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      active_repo_id: true,
    },
  })

  if (!profile?.active_repo_id) return false

  // Get file metadata from database
  const file = await prisma.file.findUnique({
    where: {
      repo_id_path: {
        repo_id: profile.active_repo_id,
        path: filePath,
      },
    },
    select: {
      id: true,
      storage_key: true,
      path: true,
      repo_id: true,
    },
  })

  if (!file) return false

  try {
    // Upload new content to Supabase storage
    const supabase = await createSupabaseServerClient()
    const contentBuffer = Buffer.from(content, 'utf-8')
    
    // The storage_key in database includes 'docs/' prefix, but the bucket is already 'docs',
    // so we need to remove the 'docs/' prefix from the storage key
    const storagePathWithoutPrefix = file.storage_key.startsWith('docs/') 
      ? file.storage_key.substring(5) // Remove 'docs/' prefix
      : file.storage_key
    
    const { error: uploadError } = await supabase.storage
      .from('docs')
      .update(storagePathWithoutPrefix, contentBuffer, {
        contentType: 'text/plain',
        upsert: true,
      })

    if (uploadError) {
      console.error('Error uploading file content:', uploadError)
      return false
    }

    // Update database with new content hash
    const contentHash = createHash('sha256').update(content).digest('hex')
    
    await prisma.file.update({
      where: { id: file.id },
      data: {
        content_hash: contentHash,
        has_uncommitted_changes: true,
        updated_at: new Date(),
      },
    })

    return true
  } catch (error) {
    console.error('Error updating file content:', error)
    return false
  }
} 