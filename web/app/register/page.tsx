'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from "next/link"
import { ArrowRight, Mail, Lock, User, AlertCircle, CheckCircle } from "lucide-react"
import { registerUser } from '../actions/register'

export default function Register() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData(e.currentTarget)
    const result = await registerUser(formData)
    
    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      if (result.requiresConfirmation) {
        setSuccess('Please check your email to confirm your account before signing in.')
      } else {
        // Auto sign in the user
        const email = formData.get('email') as string
        const password = formData.get('password') as string
        
        try {
          const signInResult = await signIn('credentials', {
            email,
            password,
            redirect: false,
          })
          
          if (signInResult?.error) {
            setError('Account created but failed to sign in. Please try signing in manually.')
          } else {
            router.push('/')
          }
        } catch (error) {
          setError('Account created but failed to sign in. Please try signing in manually.')
        }
      }
    }
    
    setIsLoading(false)
  }

  return (
    <>
      {/* Page content */}
      <div className="absolute top-0 left-0 w-screen h-screen flex flex-col">
        {/* Register form (fills the remaining space) */}
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center pt-24 md:pt-32">
          <div className="w-full max-w-md space-y-8">
            <div>
              <h1 className="text-display-lg text-neutral mb-2">
                Create Account
              </h1>
              <p className="text-body-lg text-neutral">
                Join us to accelerate your documentation workflow
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-body-sm text-red-700">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <p className="text-body-sm text-green-700">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="sr-only">
                    Full name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-neutral opacity-60" />
                    </div>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      className="block w-full pl-10 pr-3 py-3 border border-neutral border-opacity-20 rounded-lg bg-transparent text-neutral placeholder-neutral placeholder-opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-body-md"
                      placeholder="Full name"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="sr-only">
                    Email address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-neutral opacity-60" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="block w-full pl-10 pr-3 py-3 border border-neutral border-opacity-20 rounded-lg bg-transparent text-neutral placeholder-neutral placeholder-opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-body-md"
                      placeholder="Email address"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-neutral opacity-60" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      className="block w-full pl-10 pr-3 py-3 border border-neutral border-opacity-20 rounded-lg bg-transparent text-neutral placeholder-neutral placeholder-opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-body-md"
                      placeholder="Password"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="sr-only">
                    Confirm password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-neutral opacity-60" />
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      className="block w-full pl-10 pr-3 py-3 border border-neutral border-opacity-20 rounded-lg bg-transparent text-neutral placeholder-neutral placeholder-opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-body-md"
                      placeholder="Confirm password"
                    />
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary text-white px-8 py-4 rounded-full text-body-lg font-medium hover:bg-opacity-90 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{isLoading ? 'Creating Account...' : 'Create Account'}</span>
                  {!isLoading && <ArrowRight className="w-5 h-5" />}
                </button>
              </div>

              <div className="text-center">
                <p className="text-body-md text-neutral">
                  Already have an account?{" "}
                  <Link href="/login" className="text-primary hover:text-primary hover:opacity-80 font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </main>
      </div>
    </>
  )
} 