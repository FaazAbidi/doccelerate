'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { RefreshCw, Github, Plus, Search, X, Settings } from 'lucide-react'
import { Button } from '@/app/components/Button'
import { Card } from '@/app/components/Card'
import { TextInput } from '@/app/components/TextInput'
import { RepoCard } from './components/RepoCard'
import { AddRepoForm } from './components/AddRepoForm'
import { RepoConfirmationModal } from './components/RepoConfirmationModal'
import { RepoSettingsCard } from './components/RepoSettingsCard'
import { GithubConnect } from '../components/GithubConnect'
import { syncUserRepos } from './actions/syncUserRepos'
import { addPublicRepo } from './actions/addPublicRepo'
import { addPublicRepoAnonymous } from './actions/addPublicRepoAnonymous'
import { getUserRepos, UserRepository } from './actions/getUserRepos'
import { ensureProfile } from '../actions/ensureProfile'
import { getGithubProfile } from '../actions/getGithubProfile'
import { PageLoader } from '../components/PageLoader'
import Link from 'next/link'
import { Tooltip } from '../components/Tooltip'

export default function ReposPage() {
  const { data: session, status } = useSession()
  const [repositories, setRepositories] = useState<UserRepository[]>([])
  const [filteredRepositories, setFilteredRepositories] = useState<UserRepository[]>([])
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null)
  const [hasGithubConnection, setHasGithubConnection] = useState(false)
  const [githubUsername, setGithubUsername] = useState<string | null>(null)
  const [githubAvatarUrl, setGithubAvatarUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRepository, setSelectedRepository] = useState<UserRepository | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchRepos = async () => {
    try {
      // Ensure profile exists first
      await ensureProfile()
      
      const data = await getUserRepos()
      setRepositories(data.repositories)
      setActiveRepoId(data.activeRepoId)
      setHasGithubConnection(data.hasGithubConnection)
      
      // Get GitHub profile info
      const githubProfile = await getGithubProfile()
      setGithubUsername(githubProfile.username)
      setGithubAvatarUrl(githubProfile.avatarUrl)
    } catch (error) {
      console.error('Failed to fetch repositories', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Filter repositories based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredRepositories(repositories)
    } else {
      const filtered = repositories.filter(repo =>
        (repo.name && repo.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (repo.fullName && repo.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      setFilteredRepositories(filtered)
    }
  }, [repositories, searchQuery])

  useEffect(() => {
    if (session?.user?.id) {
      fetchRepos()
    } else if (status !== 'loading') {
      setIsLoading(false)
    }
  }, [session, status])

  const handleSyncRepos = async () => {
    setIsSyncing(true)
    try {
      await syncUserRepos()
      await fetchRepos()
    } catch (error) {
      console.error('Failed to sync repositories', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleAddPublicRepo = async (fullName: string) => {
    await addPublicRepo(fullName)
    await fetchRepos()
    setShowAddForm(false)
  }

  const handleAddPublicRepoAnonymous = async (fullName: string) => {
    await addPublicRepoAnonymous(fullName)
    await fetchRepos()
    setShowAddForm(false)
  }

  const handleSetActive = (repository: UserRepository) => {
    setSelectedRepository(repository)
    setIsModalOpen(true)
  }

  const handleModalConfirm = async () => {
    setIsModalOpen(false)
    setSelectedRepository(null)
    // Refresh the repositories to update the active status
    await fetchRepos()
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedRepository(null)
  }

  const clearSearch = () => {
    setSearchQuery('')
  }

  if (status === 'loading' || isLoading) {
    return <PageLoader message="Loading repositories..." />
  }

  if (!session?.user?.id) {
    return (
        <Card variant="default" className="text-center p-8">
          <h2 className="text-heading-lg text-neutral mb-2">Please sign in</h2>
          <p className="text-body-md text-neutral opacity-80 mb-6">
            You need to be signed in to manage repositories.
          </p>
        </Card>
      
    )
  }

  return (
    <div className="h-screen bg-transparent pt-32 pb-8 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col">
        {/* Header Section - Fixed */}
        <div className="flex-shrink-0 mb-8">
          <div className="mb-6">
            <h1 className="text-heading-xl text-neutral mb-2">Repositories</h1>
            <p className="text-body-lg text-neutral opacity-80">
              Add and manage your repositories. Connect GitHub for full functionality or add public repositories to get started.
            </p>
          </div>

          {/* GitHub Connection */}
          <div className="mb-6">
            <GithubConnect
              isConnected={hasGithubConnection}
              githubUsername={githubUsername}
              githubAvatarUrl={githubAvatarUrl}
            />
          </div>

          {/* Actions Row */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              {hasGithubConnection ? (
                <>
                  <Button
                    variant="primary"
                    size="md"
                    leadingIcon={<RefreshCw className="w-5 h-5" />}
                    onClick={handleSyncRepos}
                    disabled={isSyncing}
                  >
                    {isSyncing ? 'Syncing...' : 'Sync GitHub Repos'}
                  </Button>
                  <Link href="/repos/manage">
                    <Button
                      variant="secondary"
                      size="md"
                      leadingIcon={<Settings className="w-5 h-5" />}
                    >
                      Manage Access
                    </Button>
                  </Link>
                </>
              ) : (
                <Tooltip content="Connect GitHub to commit changes back to repositories">
                <Button
                    variant="outline"
                    size="md"
                    className="bg-transparent border-neutral/10 hover:bg-neutral/15"
                  >
                    <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                   <p className="text-sm text-neutral font-medium">Read-only mode</p>
                  </Button>
                </Tooltip>
              )}
              <Button
                variant="secondary"
                size="md"
                leadingIcon={<Plus className="w-5 h-5" />}
                onClick={() => setShowAddForm(!showAddForm)}
              >
                Add Public Repo
              </Button>
            </div>
              
              {/* Search Bar */}
              {repositories.length > 0 && (
                <div className="relative flex-1 max-w-md">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <Search className="w-5 h-5 text-neutral opacity-60" />
                  </div>
                  <TextInput
                    placeholder="Search repositories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral opacity-60 hover:opacity-80"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="mb-6">
              <AddRepoForm 
                onAddRepo={hasGithubConnection ? handleAddPublicRepo : handleAddPublicRepoAnonymous} 
                hasGithubConnection={hasGithubConnection}
              />
            </div>
          )}
        </div>

        {/* Repository Settings */}
        {activeRepoId && (
          <div className="mb-6">
            {/* key forces remount when repo changes */}
            <RepoSettingsCard key={activeRepoId} onSettingsUpdate={fetchRepos} />
          </div>
        )}

        {/* Content Section - Scrollable */}
        <div className="flex-1 min-h-0">
          {hasGithubConnection ? (
            <>
              {repositories.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <Card variant="default" className="text-center py-12 max-w-md">
                    <Github className="w-12 h-12 text-neutral opacity-40 mx-auto mb-4" />
                    <h3 className="text-heading-md text-neutral mb-2">No repositories found</h3>
                    <p className="text-body-md text-neutral opacity-80 mb-6">
                      Manage access to your GitHub repositories or add a public repository to get started. By default, all your repositories are excluded.
                    </p>
                  </Card>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {/* Results Summary */}
                  <div className="flex-shrink-0 mb-4">
                    <div className="flex items-center justify-between">
                      <p className="text-body-md text-neutral opacity-80">
                        {searchQuery ? (
                          <>
                            Showing {filteredRepositories.length} of {repositories.length} repositories
                            {filteredRepositories.length !== repositories.length && (
                              <span className="ml-2 text-body-sm">
                                matching &quot;{searchQuery}&quot;
                              </span>
                            )}
                          </>
                        ) : (
                          `${repositories.length} repositories`
                        )}
                      </p>
                      {activeRepoId && (
                        <div className="flex items-center text-body-sm text-neutral opacity-70">
                          <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
                          Active repository selected
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Repositories Grid - Scrollable */}
                  <div className="flex-1 overflow-y-auto pr-2">
                    {filteredRepositories.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <Card variant="default" className="text-center py-12 max-w-md">
                          <Search className="w-12 h-12 text-neutral opacity-40 mx-auto mb-4" />
                          <h3 className="text-heading-md text-neutral mb-2">No matching repositories</h3>
                          <p className="text-body-md text-neutral opacity-80 mb-6">
                            No repositories found matching &quot;{searchQuery}&quot;. Try adjusting your search terms.
                          </p>
                          <Button variant="secondary" size="md" onClick={clearSearch}>
                            Clear Search
                          </Button>
                        </Card>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
                        {filteredRepositories.map((repo) => (
                                                  <RepoCard
                          key={repo.id}
                          repository={repo}
                          onSetActive={handleSetActive}
                          isSettingActive={false}
                        />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {repositories.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <Card variant="default" className="text-center py-12 max-w-md mb-10">
                    <Github className="w-12 h-12 text-neutral opacity-40 mx-auto mb-4" />
                    <h3 className="text-heading-md text-neutral mb-2">Add a public repository</h3>
                    <p className="text-body-md text-neutral opacity-80 mb-6">
                      Add any public GitHub repository to get started. You can view and edit docs, but connecting GitHub enables committing changes back.
                    </p>
                    <Button variant="secondary" size="md" onClick={() => setShowAddForm(true)}>
                      Add Public Repo
                    </Button>
                  </Card>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {/* Results Summary */}
                  <div className="flex-shrink-0 mb-4">
                    <div className="flex items-center justify-between">
                      <p className="text-body-md text-neutral opacity-80">
                        {searchQuery ? (
                          <>
                            Showing {filteredRepositories.length} of {repositories.length} repositories
                            {filteredRepositories.length !== repositories.length && (
                              <span className="ml-2 text-body-sm">
                                matching &quot;{searchQuery}&quot;
                              </span>
                            )}
                          </>
                        ) : (
                          `${repositories.length} repositories`
                        )}
                      </p>
                      {activeRepoId && (
                        <div className="flex items-center text-body-sm text-neutral opacity-70">
                          <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
                          Active repository selected
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Repositories Grid - Scrollable */}
                  <div className="flex-1 overflow-y-auto pr-2">
                    {filteredRepositories.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <Card variant="default" className="text-center py-12 max-w-md">
                          <Search className="w-12 h-12 text-neutral opacity-40 mx-auto mb-4" />
                          <h3 className="text-heading-md text-neutral mb-2">No matching repositories</h3>
                          <p className="text-body-md text-neutral opacity-80 mb-6">
                            No repositories found matching &quot;{searchQuery}&quot;. Try adjusting your search terms.
                          </p>
                          <Button variant="secondary" size="md" onClick={clearSearch}>
                            Clear Search
                          </Button>
                        </Card>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
                        {filteredRepositories.map((repo) => (
                          <RepoCard
                            key={repo.id}
                            repository={repo}
                            onSetActive={handleSetActive}
                            isSettingActive={false}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Repository Confirmation Modal */}
      {selectedRepository && (
        <RepoConfirmationModal
          repository={selectedRepository}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onConfirm={handleModalConfirm}
        />
      )}
    </div>
  )
}