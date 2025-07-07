'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export interface FileContentResponse {
  content: string
  filePath: string
  isMarkdown: boolean
}

/**
 * Fetches the content of a file from storage.
 * Returns the file content and metadata.
 */
export async function getFileContent(filePath: string): Promise<FileContentResponse | null> {
  const userId = await getUserUuid()
  if (!userId) {
    console.log('getFileContent: No user ID found')
    return null
  }

  // Get user's active repository
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      active_repo_id: true,
    },
  })

  if (!profile?.active_repo_id) {
    console.log('getFileContent: No active repo found for user', userId)
    return null
  }

  // Get file metadata from database
  const file = await prisma.file.findUnique({
    where: {
      repo_id_path: {
        repo_id: profile.active_repo_id,
        path: filePath,
      },
    },
    select: {
      storage_key: true,
      path: true,
    },
  })

  if (!file) {
    console.log('getFileContent: File not found in database:', filePath)
    
    return null
  }

  // Fetch content from Supabase storage
  const supabase = await createSupabaseServerClient()
  
  // The storage_key in database includes 'docs/' prefix, but the bucket is already 'docs',
  // so we need to remove the 'docs/' prefix from the storage key
  const storagePathWithoutPrefix = file.storage_key.startsWith('docs/') 
    ? file.storage_key.substring(5) // Remove 'docs/' prefix
    : file.storage_key
  
  const { data, error } = await supabase.storage
    .from('docs')
    .download(storagePathWithoutPrefix)

  if (error || !data) {
    console.error('Error fetching file content from storage:', error)
    // Let's also try to list what's actually in the bucket
    try {
      const { data: listData, error: listError } = await supabase.storage
        .from('docs')
        .list('', { limit: 10 })
      
      console.log('getFileContent: Files in bucket root:', listData, 'Error:', listError)
    } catch (listErr) {
      console.log('getFileContent: Could not list bucket contents:', listErr)
    }
    
    return null
  }

  const content = await data.text()
  const isMarkdown = file.path.endsWith('.md') || file.path.endsWith('.mdx')

  return {
    content,
    filePath: file.path,
    isMarkdown,
  }
} 