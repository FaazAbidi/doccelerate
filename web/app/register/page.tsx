'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { ArrowRight, Mail, Lock, User } from "lucide-react"
import { registerUser } from '../actions/register'
import { TextInput } from "../components/TextInput"
import { Alert } from "../components/Alert"
import { Button } from '../components/Button'

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
            setError('Account created but failed to login. Please try logging in manually.')
          } else {
            router.push('/')
          }
        } catch (error) {
          console.error(error)
          setError('Account created but failed to login. Please try logging in manually.')
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

            {error && <Alert variant="error">{error}</Alert>}

            {success && <Alert variant="success">{success}</Alert>}

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="sr-only">
                    Full name
                  </label>
                  <TextInput
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    placeholder="Full name"
                    leadingIcon={<User className="h-5 w-5 text-neutral opacity-60" />}
                  />
                </div>

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
                    autoComplete="new-password"
                    required
                    placeholder="Password"
                    leadingIcon={<Lock className="h-5 w-5 text-neutral opacity-60" />}
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="sr-only">
                    Confirm password
                  </label>
                  <TextInput
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Confirm password"
                    leadingIcon={<Lock className="h-5 w-5 text-neutral opacity-60" />}
                  />
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full"
                  variant="primary"
                  size="lg"
                  trailingIcon={<ArrowRight className="w-5 h-5" />}
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </div>

              <div className="text-center">
                <p className="text-body-md text-neutral">
                  Already have an account?
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/login')}
                    className='ml-2'
                    trailingIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Login
                  </Button>
                </p>
              </div>
            </form>
          </div>
        </main>
      </div>
    </>
  )
} 