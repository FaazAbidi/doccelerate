'use client'

import { Github, ExternalLink, Check } from 'lucide-react'
import { Card } from '@/app/components/Card'
import { Button } from '@/app/components/Button'
import { UserRepository } from '../actions/getUserRepos'

interface RepoCardProps {
  repository: UserRepository
  onSetActive: (repository: UserRepository) => void
  isSettingActive: boolean
}

export function RepoCard({ repository, onSetActive, isSettingActive }: RepoCardProps) {
  return (
    <Card variant="default" className="p-4 text-left">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start space-x-2 flex-1 min-w-0">
          <Github className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <h3 className="text-heading-sm text-neutral font-medium leading-snug truncate">
              {repository.name}
            </h3>
            <p className="text-body-xs text-neutral opacity-60 mt-1 truncate">
              {repository.fullName}
            </p>
            {repository.description && (
              <p className="text-body-xs text-neutral opacity-80 mt-1 line-clamp-2">
                {repository.description}
              </p>
            )}
            <div className="flex items-center space-x-2 mt-2">
              <span className="text-body-xxs text-neutral opacity-60">
                {repository.isPublic ? 'Public' : 'Private'}
              </span>
              <span className="text-body-xxs text-neutral opacity-60">
                {repository.defaultBranch}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3 sm:mt-0 flex items-center space-x-2 shrink-0">
          {repository.githubUrl && (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<ExternalLink className="w-4 h-4" />}
              onClick={() => window.open(repository.githubUrl!, '_blank')}
            >
              View
            </Button>
          )}
          {repository.isActive ? (
            <div className="flex items-center space-x-2 px-3 py-1 bg-success/10 text-success rounded-[20px]">
              <Check className="w-4 h-4" />
              <span className="text-body-sm">Active</span>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onSetActive(repository)}
              disabled={isSettingActive}
            >
              {isSettingActive ? 'Setting...' : 'Set Active'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
} 