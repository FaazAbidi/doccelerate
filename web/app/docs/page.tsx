'use client'

import { useSession } from 'next-auth/react'
import { FileText, BookOpen, Search, Settings } from 'lucide-react'

export default function DocsPage() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="absolute top-0 left-0 w-screen h-screen flex flex-col">
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center pt-24 md:pt-32">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-body-lg text-neutral">Loading...</p>
        </main>
      </div>
    )
  }

  return (
    <>
      {/* Page content */}
      <div className="absolute top-0 left-0 w-screen h-screen flex flex-col">
        {/* Documentation dashboard */}
        <main className="relative z-10 flex flex-1 flex-col px-4 sm:px-6 lg:px-8 pt-24 md:pt-32 pb-12">
          <div className="max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-display-lg text-neutral mb-4">
                Welcome to Documentation
              </h1>
              <p className="text-body-xl text-neutral max-w-2xl mx-auto">
                Hello {session?.user?.name || session?.user?.email}! Manage your documents, create new ones, and collaborate with your team.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <div className="bg-white rounded-xl border border-neutral border-opacity-10 p-6 hover:shadow-lg transition-shadow duration-200">
                <div className="w-12 h-12 bg-primary bg-opacity-10 rounded-lg flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-heading-md text-neutral mb-2">Create Document</h3>
                <p className="text-body-sm text-neutral opacity-80">Start a new document from scratch or use a template</p>
              </div>

              <div className="bg-white rounded-xl border border-neutral border-opacity-10 p-6 hover:shadow-lg transition-shadow duration-200">
                <div className="w-12 h-12 bg-primary bg-opacity-10 rounded-lg flex items-center justify-center mb-4">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-heading-md text-neutral mb-2">Browse Library</h3>
                <p className="text-body-sm text-neutral opacity-80">Access your document library and shared content</p>
              </div>

              <div className="bg-white rounded-xl border border-neutral border-opacity-10 p-6 hover:shadow-lg transition-shadow duration-200">
                <div className="w-12 h-12 bg-primary bg-opacity-10 rounded-lg flex items-center justify-center mb-4">
                  <Search className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-heading-md text-neutral mb-2">Search Documents</h3>
                <p className="text-body-sm text-neutral opacity-80">Find what you need quickly with powerful search</p>
              </div>

              <div className="bg-white rounded-xl border border-neutral border-opacity-10 p-6 hover:shadow-lg transition-shadow duration-200">
                <div className="w-12 h-12 bg-primary bg-opacity-10 rounded-lg flex items-center justify-center mb-4">
                  <Settings className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-heading-md text-neutral mb-2">Settings</h3>
                <p className="text-body-sm text-neutral opacity-80">Customize your workspace and preferences</p>
              </div>
            </div>

            {/* Recent Documents */}
            <div className="bg-white rounded-xl border border-neutral border-opacity-10 p-8">
              <h2 className="text-heading-lg text-neutral mb-6">Recent Documents</h2>
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-neutral opacity-20 mx-auto mb-4" />
                <p className="text-body-lg text-neutral opacity-60">No documents yet</p>
                <p className="text-body-sm text-neutral opacity-40 mt-2">Create your first document to get started</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
} 