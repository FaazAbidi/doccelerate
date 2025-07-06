'use server'

import { getUserUuid } from "@/app/actions/getUserUuid"
import { prisma } from "@/lib/prisma"

export interface TreeNode {
  path: string
  name: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

/**
 * Fetches the directory tree structure for the user's active repository.
 * Returns a hierarchical tree structure of files and directories.
 * Note: Since merkle_node only contains files, we need to construct directories from file paths.
 */
export async function getDirectoryTree(): Promise<TreeNode[] | null> {
  const userId = await getUserUuid()
  if (!userId) {
    console.log('getDirectoryTree: No user ID found')
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
    console.log('getDirectoryTree: No active repo found for user', userId)
    return null
  }

  // Get all files for the repository (merkle_node only contains files, not directories)
  const files = await prisma.file.findMany({
    where: {
      repo_id: profile.active_repo_id,
    },
    select: {
      path: true,
      storage_key: true,
    },
    orderBy: {
      path: 'asc',
    },
  })


  if (files.length === 0) {
    console.log('getDirectoryTree: No files found in database')
    return null
  }

  // Build the tree structure from file paths
  const nodeMap = new Map<string, TreeNode>()
  const allPaths = new Set<string>()

  // First, collect all paths (files and directories)
  for (const file of files) {
    const path = file.path
    allPaths.add(path)
    
    // Add all parent directories
    const parts = path.split('/')
    for (let i = 1; i < parts.length; i++) {
      const dirPath = parts.slice(0, i).join('/')
      if (dirPath) {
        allPaths.add(dirPath)
      }
    }
  }

  // Create nodes for all paths
  for (const path of allPaths) {
    const parts = path.split('/')
    const name = parts[parts.length - 1]
    const isFile = files.some(f => f.path === path)
    
    const treeNode: TreeNode = {
      path,
      name,
      type: isFile ? 'file' : 'directory',
      children: isFile ? undefined : [],
    }
    nodeMap.set(path, treeNode)
  }

  // Build the hierarchy
  const tree: TreeNode[] = []
  
  for (const path of allPaths) {
    const node = nodeMap.get(path)!
    const parts = path.split('/')
    
    if (parts.length === 1) {
      // Root level
      tree.push(node)
    } else {
      // Find parent
      const parentPath = parts.slice(0, -1).join('/')
      const parent = nodeMap.get(parentPath)
      if (parent && parent.children) {
        parent.children.push(node)
      }
    }
  }

  return tree
} 