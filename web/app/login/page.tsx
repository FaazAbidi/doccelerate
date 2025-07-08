'use client'

import { Suspense, useState } from 'react'

import { ArrowRight, Mail, Lock } from 'lucide-react'
import { TextInput } from '../components/TextInput'
import { Checkbox } from '../components/Checkbox'
import { Button } from '../components/Button'
import { Alert } from '../components/Alert'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

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
        callbackUrl,
      })

      if (result?.error) {
        setError('Invalid credentials')
      }
    } catch (error) {
      console.error(error)
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="absolute top-0 left-0 w-screen h-screen flex flex-col">
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center pt-24 md:pt-32">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h1 className="text-display-lg text-neutral mb-2">Welcome Back</h1>
            <p className="text-body-lg text-neutral">Login to your account to continue</p>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <TextInput
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="Email address"
                  leadingIcon={<Mail className="h-5 w-5 text-neutral opacity-60" />}
                />
              </div>

              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <TextInput
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Password"
                  leadingIcon={<Lock className="h-5 w-5 text-neutral opacity-60" />}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Checkbox id="remember-me" name="remember-me" label="Remember me" />
            </div>

            <div>
              <Button
                type="submit"
                disabled={isLoading}
                variant="primary"
                size="lg"
                className="w-full"
                loading={isLoading}
                trailingIcon={<ArrowRight className="w-5 h-5" />}
              >
                Login
              </Button>
            </div>

            <div className="text-center">
              <p className="text-body-md text-neutral">
                Don&apos;t have an account?
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/register')}
                  className="ml-2"
                  trailingIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Get Started
                </Button>
              </p>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

export default function Login() {
  return (
    <Suspense fallback={<div />}>
      <LoginInner />
    </Suspense>
  )
} 