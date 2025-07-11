'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { ArrowLeft, Github, X, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/app/components/Button'
import { Card } from '@/app/components/Card'
import { TextInput } from '@/app/components/TextInput'
import { Checkbox } from '@/app/components/Checkbox'
import { PageLoader } from '@/app/components/PageLoader'
import Link from 'next/link'
import { getGithubRepositories, GitHubRepository } from '../actions/getGithubRepositories'
import { updateRepositoryAccess } from '../actions/updateRepositoryAccess'

export default function ManageRepositoriesPage() {
  const { data: session, status } = useSession()
  const [repositories, setRepositories] = useState<GitHubRepository[]>([])
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchRepositories()
    }
  }, [status])

  const fetchRepositories = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const result = await getGithubRepositories()
      
      if (result.success) {
        setRepositories(result.repositories)
        // Initialize selected repos with currently included ones
        const currentlySelected = new Set(
          result.repositories
            .filter(repo => repo.isIncluded)
            .map(repo => repo.fullName)
        )
        setSelectedRepos(currentlySelected)
      } else {
        setError(result.error || 'Failed to fetch repositories')
      }
    } catch (err) {
      setError('Failed to fetch repositories')
      console.error('Error fetching repositories:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleRepository = (fullName: string) => {
    const newSelected = new Set(selectedRepos)
    if (newSelected.has(fullName)) {
      newSelected.delete(fullName)
    } else {
      newSelected.add(fullName)
    }
    setSelectedRepos(newSelected)
  }

  const handleSelectAll = () => {
    const filteredRepos = getFilteredRepositories()
    const allSelected = filteredRepos.every(repo => selectedRepos.has(repo.fullName))
    
    if (allSelected) {
      // Deselect all filtered repos
      const newSelected = new Set(selectedRepos)
      filteredRepos.forEach(repo => newSelected.delete(repo.fullName))
      setSelectedRepos(newSelected)
    } else {
      // Select all filtered repos
      const newSelected = new Set(selectedRepos)
      filteredRepos.forEach(repo => newSelected.add(repo.fullName))
      setSelectedRepos(newSelected)
    }
  }

  const handleSaveChanges = async () => {
    try {
      setIsUpdating(true)
      setError(null)
      
      const result = await updateRepositoryAccess(Array.from(selectedRepos))
      
      if (result.success) {
        // Refresh the repositories list to show updated state
        await fetchRepositories()
      } else {
        setError(result.error || 'Failed to update repository access')
      }
    } catch (err) {
      setError('Failed to update repository access')
      console.error('Error updating repository access:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  const getFilteredRepositories = () => {
    if (!searchQuery) return repositories
    
    return repositories.filter(repo =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }

  const filteredRepositories = getFilteredRepositories()
  const hasChanges = repositories.some(repo => 
    repo.isIncluded !== selectedRepos.has(repo.fullName)
  )

  if (status === 'loading' || isLoading) {
    return <PageLoader />
  }

  if (!session?.user?.id) {
    return (
      <div className="h-screen bg-transparent pt-32 pb-8 flex items-center justify-center">
        <Card variant="default" className="text-center p-8">
          <h2 className="text-heading-lg text-neutral mb-2">Please sign in</h2>
          <p className="text-body-md text-neutral opacity-80 mb-6">
            You need to be signed in to manage repositories.
          </p>
          <Link href="/login">
            <Button variant="primary">Sign In</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-screen bg-transparent pt-32 pb-8 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/repos">
              <Button variant="outline" size="sm" leadingIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Repositories
              </Button>
            </Link>
          </div>
          
          <div className="mb-6">
            <h1 className="text-heading-xl text-neutral mb-2">Manage Repository Access</h1>
            <p className="text-body-lg text-neutral opacity-80">
              Select which GitHub repositories you want to include in your workspace.
            </p>
          </div>

          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <TextInput
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leadingIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSelectAll}
                disabled={isUpdating}
              >
                {filteredRepositories.every(repo => selectedRepos.has(repo.fullName)) ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                variant="outline"
                onClick={fetchRepositories}
                disabled={isLoading || isUpdating}
                leadingIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Save Changes Bar */}
          {hasChanges && (
            <Card variant="default" className="w-full p-4 bg-primary/5 border-primary/20 mb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
                  <span className="text-sm text-neutral text-left">
                    You have unsaved changes to repository access
                  </span>
                </div>
                <Button
                  variant="primary"
                  className="p-6 text-sm w-40"
                  onClick={handleSaveChanges}
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </Card>
          )}

          {/* Error Message */}
          {error && (
            <Card variant="default" className="p-4 mb-6 bg-error/5 border-error/20">
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-error flex-shrink-0" />
                <span className="text-body-sm text-error">{error}</span>
              </div>
            </Card>
          )}
        </div>

        {/* Repository Grid */}
        <div className="flex-1 overflow-hidden">
          {filteredRepositories.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Card variant="default" className="text-center py-12 max-w-md">
                <Github className="w-12 h-12 text-neutral opacity-40 mx-auto mb-4" />
                <h3 className="text-heading-md text-neutral mb-2">
                  {searchQuery ? 'No matching repositories' : 'No repositories found'}
                </h3>
                <p className="text-body-md text-neutral opacity-80">
                  {searchQuery 
                    ? 'Try adjusting your search terms.'
                    : 'Make sure your GitHub account is connected and you have access to repositories.'
                  }
                </p>
              </Card>
            </div>
          ) : (
            <div className="overflow-y-auto h-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4 m-5">
                {filteredRepositories.map((repo) => (
                  <Card 
                    key={repo.fullName} 
                    variant="default" 
                    className={`p-4 transition-all bg-white/40 duration-200 hover:shadow-md cursor-pointer ${
                      selectedRepos.has(repo.fullName) 
                        ? 'ring-2 ring-primary/50 bg-primary/5' 
                        : 'hover:bg-white/70'
                    }`}
                    onClick={() => handleToggleRepository(repo.fullName)}
                  >
                    <div className="flex flex-col h-full">
                      {/* Header with checkbox and status badges */}
                      <div className="flex items-start justify-between mb-3">
                        <Checkbox
                          checked={selectedRepos.has(repo.fullName)}
                          onChange={() => handleToggleRepository(repo.fullName)}
                          disabled={isUpdating}
                          className="flex-shrink-0 mt-1"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex flex-col gap-1 ml-2">
                          {repo.isPrivate && (
                            <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded text-center">
                              Private
                            </span>
                          )}
                          {repo.isIncluded && (
                            <span className="px-2 py-1 text-xs bg-success/10 text-success rounded text-center">
                              Included
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Repository name */}
                      <h3 className="text-md font-medium text-neutral mb-2 line-clamp-2">
                        {repo.name}
                      </h3>
                      
                      {/* Full name */}
                      <p className="text-xs text-neutral opacity-60 mb-3 break-all">
                        {repo.fullName}
                      </p>
                      
                      {/* Description */}
                      <div className="flex-1 mb-3">
                        {repo.description ? (
                          <p className="text-xs text-neutral opacity-80 line-clamp-3">
                            {repo.description}
                          </p>
                        ) : (
                          <p className="text-xs text-neutral opacity-40 italic">
                            No description available
                          </p>
                        )}
                      </div>
                      
                      {/* Footer with metadata */}
                      <div className="flex items-center justify-between text-body-xs text-neutral opacity-60 pt-2 border-t border-neutral/10">
                        <span className="truncate">
                          {new Date(repo.updatedAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: '2-digit'
                          })}
                        </span>
                        {repo.language && (
                          <span className="px-2 py-1 bg-neutral/10 rounded text-xs ml-2 flex-shrink-0">
                            {repo.language}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 