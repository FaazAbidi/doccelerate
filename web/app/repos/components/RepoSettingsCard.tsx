'use client'

import { useState, useEffect } from 'react'
import { Settings, GitBranch, Folder, Save, RefreshCw } from 'lucide-react'
import { Card } from '@/app/components/Card'
import { Button } from '@/app/components/Button'
import { TextInput } from '@/app/components/TextInput'
import { Dropdown } from '@/app/components/Dropdown'
import { getRepoSettings, RepoSettings } from '../actions/getRepoSettings'
import { updateRepoSettings } from '../actions/updateRepoSettings'
import { getRepoBranches, RepoBranch } from '../actions/getRepoBranches'

interface RepoSettingsCardProps {
  onSettingsUpdate?: () => void
}

export function RepoSettingsCard({ onSettingsUpdate }: RepoSettingsCardProps) {
  const [settings, setSettings] = useState<RepoSettings | null>(null)
  const [branches, setBranches] = useState<RepoBranch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [directory, setDirectory] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  useEffect(() => {
    if (settings) {
      setSelectedBranch(settings.branch)
      setDirectory(settings.directory)
      if (settings.repositoryFullName) {
        fetchBranches(settings.repositoryFullName)
      }
    }
  }, [settings])

  useEffect(() => {
    if (settings) {
      const branchChanged = selectedBranch !== settings.branch
      const directoryChanged = directory !== settings.directory
      setHasChanges(branchChanged || directoryChanged)
    }
  }, [selectedBranch, directory, settings])

  const fetchSettings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const repoSettings = await getRepoSettings()
      setSettings(repoSettings)
    } catch (error) {
      console.error('Failed to fetch repository settings:', error)
      setError('Failed to load repository settings')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchBranches = async (fullName: string) => {
    setIsLoadingBranches(true)
    try {
      const branchList = await getRepoBranches(fullName)
      setBranches(branchList)
    } catch (error) {
      console.error('Failed to fetch branches:', error)
      setError('Failed to fetch repository branches')
    } finally {
      setIsLoadingBranches(false)
    }
  }

  const handleSave = async () => {
    if (!selectedBranch || !directory.trim()) {
      setError('Please select a branch and specify a directory')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await updateRepoSettings({
        branch: selectedBranch,
        directory: directory.trim(),
      })
      
      // Update local settings to reflect saved state
      if (settings) {
        setSettings({
          ...settings,
          branch: selectedBranch,
          directory: directory.trim(),
        })
      }
      setHasChanges(false)
      onSettingsUpdate?.()
    } catch (error) {
      console.error('Failed to update repository settings:', error)
      setError('Failed to update repository settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    if (settings) {
      setSelectedBranch(settings.branch)
      setDirectory(settings.directory)
      setHasChanges(false)
      setError(null)
    }
  }

  if (isLoading) {
    return (
      <Card variant="default" className="p-6">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-body-sm text-neutral opacity-80">Loading repository settings...</span>
        </div>
      </Card>
    )
  }

  if (!settings) {
    return (
      <Card variant="default" className="p-6 text-center">
        <Settings className="w-8 h-8 text-neutral opacity-40 mx-auto mb-3" />
        <h3 className="text-heading-sm text-neutral mb-2">No Active Repository</h3>
        <p className="text-body-sm text-neutral opacity-80">
          Please select an active repository to configure settings.
        </p>
      </Card>
    )
  }

  return (
    <Card variant="default" className="p-4 w-full max-w-none text-left">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left Section - Info */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex-shrink-0 mt-1 mr-2 sm:mt-0">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <h3 className="text-heading-sm text-neutral font-medium mb-1">
              Repository Settings
            </h3>
            <p className="text-body-xs text-neutral opacity-60 leading-relaxed">
              {settings.repositoryName}
            </p>
          </div>
        </div>

        {/* Right Section - Controls */}
        <div className="flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Branch Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-body-xs text-neutral opacity-80">
                Branch
              </label>
              {isLoadingBranches ? (
                <div className="flex items-center space-x-2 py-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-body-xs text-neutral opacity-80">Loading...</span>
                </div>
              ) : branches.length > 0 ? (
                <Dropdown
                  options={branches.map(branch => ({
                    value: branch.name,
                    label: `${branch.name}${branch.name === settings.defaultBranch ? ' (default)' : ''}`,
                    disabled: false,
                  }))}
                  value={selectedBranch}
                  onValueChange={setSelectedBranch}
                  placeholder="Select a branch"
                  disabled={isSaving}
                  size="sm"
                  leadingIcon={<GitBranch className="w-4 h-4 text-neutral opacity-60" />}
                />
              ) : (
                <div className="text-body-xs text-neutral opacity-60 py-2">No branches found</div>
              )}
            </div>

            {/* Directory Input */}
            <div className="flex flex-col gap-1">
              <label className="text-body-xs text-neutral opacity-80">
                Documentation Directory
              </label>
              <TextInput
                value={directory}
                onChange={(e) => setDirectory(e.target.value)}
                placeholder="docs"
                disabled={isSaving}
                size="sm"
                leadingIcon={<Folder className="w-4 h-4 text-neutral opacity-60" />}
              />
            </div>

            {/* Actions */}
            {hasChanges && (
              <div className="flex gap-2 sm:ml-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReset}
                  disabled={isSaving}
                >
                  Reset
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || !selectedBranch || !directory.trim()}
                  leadingIcon={<Save className="w-4 h-4" />}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Message - Full Width Below */}
      {error && (
        <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-[20px]">
          <p className="text-body-sm text-danger">{error}</p>
        </div>
      )}
    </Card>
  )
} 