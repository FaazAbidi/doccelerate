/**
 * Operations applier utility for applying operations JSON to file content
 * This replaces the unified diff approach with a more structured operations approach
 */

import { Operation } from '../types'

export interface OperationApplyError {
  message: string
  operation: Operation
  originalError?: Error
}

export class OperationsApplierError extends Error {
  public errors: OperationApplyError[]
  
  constructor(errors: OperationApplyError[]) {
    super(`Failed to apply ${errors.length} operations`)
    this.errors = errors
  }
}

/**
 * Apply a single operation to content
 */
export function applyOperation(content: string, operation: Operation): string {
  const lines = content.split('\n')
  
  try {
    switch (operation.op) {
      case 'insertAfter':
        return applyInsertAfter(lines, operation)
      case 'insertBefore':
        return applyInsertBefore(lines, operation)
      case 'replace':
        return applyReplace(lines, operation)
      case 'deleteBlock':
        return applyDeleteBlock(lines, operation)
      default:
        throw new Error(`Unknown operation type: ${operation.op}`)
    }
  } catch (error) {
    throw new OperationsApplierError([{
      message: `Failed to apply ${operation.op} operation`,
      operation,
      originalError: error instanceof Error ? error : new Error(String(error))
    }])
  }
}

/**
 * Apply multiple operations to content in sequence
 */
export function applyOperations(content: string, operations: Operation[]): string {
  let result = content
  const errors: OperationApplyError[] = []
  
  for (const operation of operations) {
    try {
      result = applyOperation(result, operation)
    } catch (error) {
      if (error instanceof OperationsApplierError) {
        errors.push(...error.errors)
      } else {
        errors.push({
          message: `Failed to apply ${operation.op} operation`,
          operation,
          originalError: error instanceof Error ? error : new Error(String(error))
        })
      }
    }
  }
  
  if (errors.length > 0) {
    throw new OperationsApplierError(errors)
  }
  
  return result
}

/**
 * Apply insertAfter operation
 */
function applyInsertAfter(lines: string[], operation: Operation): string {
  const { find, insert } = operation
  
  if (!find || !insert) {
    throw new Error('insertAfter requires find and insert properties')
  }
  
  // Find the line containing the anchor text
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(find)) {
      // Insert after this line
      lines.splice(i + 1, 0, insert)
      return lines.join('\n')
    }
  }
  
  throw new Error(`Could not find anchor text: ${find}`)
}

/**
 * Apply insertBefore operation
 */
function applyInsertBefore(lines: string[], operation: Operation): string {
  const { find, insert } = operation
  
  if (!find || !insert) {
    throw new Error('insertBefore requires find and insert properties')
  }
  
  // Find the line containing the anchor text
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(find)) {
      // Insert before this line
      lines.splice(i, 0, insert)
      return lines.join('\n')
    }
  }
  
  throw new Error(`Could not find anchor text: ${find}`)
}

/**
 * Apply replace operation
 */
function applyReplace(lines: string[], operation: Operation): string {
  const { find, replace } = operation
  
  if (!find || replace === undefined) {
    throw new Error('replace requires find and replace properties')
  }
  
  // Find and replace the text
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(find)) {
      lines[i] = lines[i].replace(find, replace)
      return lines.join('\n')
    }
  }
  
  throw new Error(`Could not find text to replace: ${find}`)
}

/**
 * Apply deleteBlock operation
 */
function applyDeleteBlock(lines: string[], operation: Operation): string {
  const { find, until } = operation
  
  if (!find || !until) {
    throw new Error('deleteBlock requires find and until properties')
  }
  
  // Find the start and end lines
  let startIdx = -1
  let endIdx = -1
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(find) && startIdx === -1) {
      startIdx = i
    } else if (lines[i].includes(until) && startIdx !== -1) {
      endIdx = i
      break
    }
  }
  
  if (startIdx === -1) {
    throw new Error(`Could not find start anchor text: ${find}`)
  }
  
  if (endIdx === -1) {
    throw new Error(`Could not find end anchor text: ${until}`)
  }
  
  // Delete the block (inclusive of both start and end lines)
  lines.splice(startIdx, endIdx - startIdx + 1)
  return lines.join('\n')
}

/**
 * Validate that operations can be applied to content without errors
 */
export function validateOperations(content: string, operations: Operation[]): {
  valid: boolean
  errors: OperationApplyError[]
} {
  try {
    applyOperations(content, operations)
    return { valid: true, errors: [] }
  } catch (error) {
    if (error instanceof OperationsApplierError) {
      return { valid: false, errors: error.errors }
    }
    return {
      valid: false,
      errors: [{
        message: 'Unknown error during validation',
        operation: operations[0] || { file: '', op: 'replace', find: '' },
        originalError: error instanceof Error ? error : new Error(String(error))
      }]
    }
  }
}

/**
 * Preview the result of applying operations without actually applying them
 */
export function previewOperations(content: string, operations: Operation[]): {
  success: boolean
  result?: string
  errors?: OperationApplyError[]
} {
  try {
    const result = applyOperations(content, operations)
    return { success: true, result }
  } catch (error) {
    if (error instanceof OperationsApplierError) {
      return { success: false, errors: error.errors }
    }
    return {
      success: false,
      errors: [{
        message: 'Unknown error during preview',
        operation: operations[0] || { file: '', op: 'replace', find: '' },
        originalError: error instanceof Error ? error : new Error(String(error))
      }]
    }
  }
}

/**
 * Get a human-readable description of an operation
 */
export function getOperationDescription(operation: Operation): string {
  switch (operation.op) {
    case 'insertAfter':
      return `Insert "${operation.insert}" after "${operation.find}"`
    case 'insertBefore':
      return `Insert "${operation.insert}" before "${operation.find}"`
    case 'replace':
      return `Replace "${operation.find}" with "${operation.replace}"`
    case 'deleteBlock':
      return `Delete block from "${operation.find}" to "${operation.until}"`
    default:
      return `Unknown operation: ${operation.op}`
  }
}

/**
 * Get a summary of multiple operations
 */
export function getOperationsSummary(operations: Operation[]): string {
  const counts = operations.reduce((acc, op) => {
    acc[op.op] = (acc[op.op] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const parts = []
  if (counts.insertAfter) parts.push(`${counts.insertAfter} insertions`)
  if (counts.insertBefore) parts.push(`${counts.insertBefore} insertions`)
  if (counts.replace) parts.push(`${counts.replace} replacements`)
  if (counts.deleteBlock) parts.push(`${counts.deleteBlock} deletions`)
  
  return parts.join(', ')
} 