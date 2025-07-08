'use client'

import { useState } from 'react'
import { Plus, Github } from 'lucide-react'
import { Card } from '@/app/components/Card'
import { Button } from '@/app/components/Button'
import { TextInput } from '@/app/components/TextInput'

interface AddRepoFormProps {
  onAddRepo: (fullName: string) => Promise<void>
  hasGithubConnection?: boolean
}

export function AddRepoForm({ onAddRepo, hasGithubConnection = false }: AddRepoFormProps) {
  const [fullName, setFullName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) return

    setIsAdding(true)
    setError('')

    try {
      await onAddRepo(fullName.trim())
      setFullName('')
    } catch (err: any) {
      setError(err.message || 'Failed to add repository')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Card variant="default" className="p-6">
      <div className="flex items-center space-x-3 mb-4">
        <Github className="w-5 h-5 text-primary" />
        <h3 className="text-heading-sm text-neutral font-medium">
          Add Public Repository
        </h3>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-body-sm text-neutral font-medium mb-2">
            Repository
          </label>
          <TextInput
            placeholder="owner/repository-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isAdding}
          />
          <p className="text-body-xs text-neutral opacity-60 mt-1">
            Enter the full name of a public GitHub repository
          </p>
          {!hasGithubConnection && (
            <div className="mt-2 p-2 bg-transparent border border-orange-500/20 rounded-[20px]">
              <p className="text-xs text-secondary">
                <strong>Read-only mode:</strong> You can view and edit documentation, but won&apos;t be able to commit changes back to GitHub.
              </p>
            </div>
          )}
          {error && (
            <p className="text-body-sm text-error mt-2">{error}</p>
          )}
        </div>
        
        <Button
          type="submit"
          variant="primary"
          size="sm"
          leadingIcon={<Plus className="w-4 h-4" />}
          disabled={isAdding || !fullName.trim()}
        >
          {isAdding ? 'Adding...' : 'Add Repository'}
        </Button>
      </form>
    </Card>
  )
} 