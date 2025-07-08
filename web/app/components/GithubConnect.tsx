'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Github, ExternalLink, Unlink, Settings } from 'lucide-react'
import { Card } from '@/app/components/Card'
import { Button } from '@/app/components/Button'
import { disconnectGithubAccount } from '@/app/actions/githubConnect'

interface GithubConnectProps {
  isConnected: boolean
  githubUsername?: string | null
  githubAvatarUrl?: string | null
}

export function GithubConnect({ isConnected, githubUsername, githubAvatarUrl }: GithubConnectProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const handleConnect = () => {
    // GitHub OAuth with repository selection support
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID
    const redirectUri = `${window.location.origin}/api/auth/github/callback`
    
    // Use minimal scopes initially - we'll request repo access per repository
    const scope = 'read:user user:email'
    
    // Generate a random state for security
    const state = Math.random().toString(36).substring(2, 15)
    
    // Store state in sessionStorage for verification
    sessionStorage.setItem('github_oauth_state', state)
    
    // GitHub OAuth URL with repository selection parameters
    const params = new URLSearchParams({
      client_id: clientId!,
      redirect_uri: redirectUri,
      scope: scope,
      state: state,
      allow_signup: 'true',
      // Request repository selection during authorization
      // This will prompt users to select specific repositories
      login: '', // Let user choose the account
    })
    
    const githubAuthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`
    window.location.href = githubAuthUrl
  }

  const handleManageRepositories = () => {
    // Direct users to repository selection page
    window.open('/repos/manage', '_blank')
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      const result = await disconnectGithubAccount()
      if (result.success) {
        window.location.reload()
      } else {
        alert(result.error || 'Failed to disconnect GitHub account')
      }
    } catch {
      alert('Failed to disconnect GitHub account')
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <Card variant="default" className="p-4 w-full max-w-none text-left">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex-shrink-0 mt-1 mr-2 sm:mt-0">
            <Github className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <h3 className="text-heading-sm text-neutral font-medium mb-1">
              GitHub Integration
            </h3>
            <p className="text-body-xs text-neutral opacity-60 leading-relaxed">
              Connect your GitHub account and choose which repositories to access
            </p>
          </div>
        </div>
        
        <div className="flex-shrink-0">
          {isConnected ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3">
                {githubAvatarUrl && (
                  <Image
                    src={githubAvatarUrl}
                    alt={githubUsername || 'GitHub Avatar'}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full border border-neutral/20"
                  />
                )}
                <div className="min-w-0">
                  <div className="text-body-sm text-neutral font-medium truncate">
                    {githubUsername}
                  </div>
                  <div className="text-body-xs text-success font-medium">
                    Connected
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon={<Settings className="w-4 h-4" />}
                  onClick={handleManageRepositories}
                  className="w-full sm:w-auto"
                >
                  Manage Repos
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<Unlink className="w-4 h-4" />}
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="w-full sm:w-auto"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="primary"
              size="md"
              leadingIcon={<ExternalLink className="w-4 h-4" />}
              onClick={handleConnect}
              className="w-full sm:w-auto"
            >
              Connect GitHub
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
} 