'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from "next/link"
import { ArrowRight, Mail, Lock, AlertCircle } from "lucide-react"

export default function Login() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid credentials')
      } else {
        router.push(callbackUrl)
      }
    } catch (error) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Page content */}
      <div className="absolute top-0 left-0 w-screen h-screen flex flex-col">
        {/* Login form (fills the remaining space) */}
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center pt-24 md:pt-32">
          <div className="w-full max-w-md space-y-8">
            <div>
              <h1 className="text-display-lg text-neutral mb-2">
                Welcome Back
              </h1>
              <p className="text-body-lg text-neutral">
                Sign in to your account to continue
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-body-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <div className="space-y-4">
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
                      autoComplete="current-password"
                      required
                      className="block w-full pl-10 pr-3 py-3 border border-neutral border-opacity-20 rounded-lg bg-transparent text-neutral placeholder-neutral placeholder-opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-body-md"
                      placeholder="Password"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-primary focus:ring-primary border-neutral border-opacity-20 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-body-sm text-neutral">
                    Remember me
                  </label>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary text-white px-8 py-4 rounded-full text-body-lg font-medium hover:bg-opacity-90 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{isLoading ? 'Signing in...' : 'Sign in'}</span>
                  {!isLoading && <ArrowRight className="w-5 h-5" />}
                </button>
              </div>

              <div className="text-center">
                <p className="text-body-md text-neutral">
                  Don't have an account?{" "}
                  <Link href="/register" className="text-primary hover:text-primary hover:opacity-80 font-medium">
                    Sign up
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