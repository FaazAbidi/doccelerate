'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, GitBranch, Folder, Loader2 } from 'lucide-react'
import { Card } from '@/app/components/Card'
import { Button } from '@/app/components/Button'
import { TextInput } from '@/app/components/TextInput'
import { Dropdown } from '@/app/components/Dropdown'
import { UserRepository } from '../actions/getUserRepos'
import { getRepoBranches, RepoBranch } from '../actions/getRepoBranches'
import { setActiveRepoWithSettings } from '../actions/setActiveRepoWithSettings'

interface RepoConfirmationModalProps {
  repository: UserRepository
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export function RepoConfirmationModal({ 
  repository, 
  isOpen, 
  onClose, 
  onConfirm 
}: RepoConfirmationModalProps) {
  const [branches, setBranches] = useState<RepoBranch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [directory, setDirectory] = useState<string>('docs')
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBranches = useCallback(async () => {
    if (!repository.fullName) return
    
    setIsLoadingBranches(true)
    setError(null)
    try {
      const branchList = await getRepoBranches(repository.fullName)
      setBranches(branchList)
    } catch {
      console.error('Failed to fetch branches')
      setError('Failed to fetch repository branches')
    } finally {
      setIsLoadingBranches(false)
    }
  }, [repository.fullName])

  // Fetch branches when modal opens
  useEffect(() => {
    if (isOpen && repository.fullName) {
      fetchBranches()
    }
  }, [isOpen, repository.fullName, fetchBranches])

  // Set default branch when branches are loaded
  useEffect(() => {
    if (branches.length > 0 && !selectedBranch) {
      // Try to find default branch, fallback to first branch
      const defaultBranch = branches.find(b => b.name === repository.defaultBranch) || branches[0]
      setSelectedBranch(defaultBranch.name)
    }
  }, [branches, selectedBranch, repository.defaultBranch])

  const handleConfirm = async () => {
    if (!selectedBranch || !directory.trim()) {
      setError('Please select a branch and specify a directory')
      return
    }

    setIsConfiguring(true)
    setError(null)
    try {
      await setActiveRepoWithSettings({
        repoId: repository.id,
        branch: selectedBranch,
        directory: directory.trim(),
      })
      onConfirm()
    } catch (error) {
      console.error('Failed to set active repository:', error)
      setError('Failed to set repository as active')
    } finally {
      setIsConfiguring(false)
    }
  }

  const handleClose = () => {
    if (!isConfiguring) {
      setBranches([])
      setSelectedBranch('')
      setDirectory('docs')
      setError(null)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card variant="default" className="w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-heading-lg text-neutral">Set Active Repository</h2>
          <button
            onClick={handleClose}
            disabled={isConfiguring}
            className="text-neutral opacity-60 hover:opacity-80 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Repository Info */}
          <div>
            <h3 className="text-heading-sm text-neutral mb-2">{repository.name}</h3>
            <p className="text-body-sm text-neutral opacity-80">{repository.fullName}</p>
          </div>

          {/* Branch Selection */}
          <div>
            <label className="block text-body-md text-neutral mb-2">
              Branch
            </label>
            {isLoadingBranches ? (
              <div className="flex items-center space-x-2 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-body-sm text-neutral opacity-80">Loading branches...</span>
              </div>
            ) : branches.length > 0 ? (
              <Dropdown
                options={branches.map(branch => ({
                  value: branch.name,
                  label: `${branch.name}${branch.name === repository.defaultBranch ? ' (default)' : ''}`,
                  disabled: false,
                }))}
                value={selectedBranch}
                onValueChange={setSelectedBranch}
                placeholder="Select a branch"
                disabled={isConfiguring}
                leadingIcon={<GitBranch className="w-4 h-4 text-neutral opacity-60" />}
              />
            ) : (
              <div className="text-body-sm text-neutral opacity-60">No branches found</div>
            )}
          </div>

          {/* Directory Input */}
          <div>
            <label className="block text-body-md text-neutral mb-2">
              <Folder className="w-4 h-4 inline mr-2" />
              Documentation Directory
            </label>
            <TextInput
              value={directory}
              onChange={(e) => setDirectory(e.target.value)}
              placeholder="docs"
              disabled={isConfiguring}
            />
            <p className="text-body-xs text-neutral opacity-60 mt-1">
              Directory containing your documentation files (e.g., docs, documentation)
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-md">
              <p className="text-body-sm text-danger">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <Button
              variant="secondary"
              size="md"
              onClick={handleClose}
              disabled={isConfiguring}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleConfirm}
              disabled={isConfiguring || !selectedBranch || !directory.trim()}
              className="flex-1"
            >
              {isConfiguring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Configuring...
                </>
              ) : (
                'Set Active'
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
} 