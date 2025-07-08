'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, Zap, ArrowRight, User, LogOut, Home, Github } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { Button } from './Button'
import { useRouter, usePathname } from 'next/navigation'
import { CircularLoader } from './CircularLoader'

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll)
      return () => window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const navItems: { href: string; label: string; icon: React.ReactNode }[] = session 
    ? [{ href: '/docs', label: 'Home', icon: <Home className="w-4 h-4" /> },
      { href: '/repos', label: 'Repositories', icon: <Github className="w-4 h-4" /> },
    ]
    : []

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <nav className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] transition-all duration-300 ${
      isScrolled ? 'floating-nav' : 'floating-nav'
    } rounded-full px-6 py-3 w-full max-w-4xl mx-auto`}>
      <div className="flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-heading-md text-primary font-bold">Doccelerate</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-4">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant={pathname.startsWith(item.href) ? "primary" : "ghost"}
              size="sm"
              className='px-4'
              onClick={() => router.push(item.href)}
              leadingIcon={item.icon}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center space-x-4">
          {status === 'loading' ? (
            <CircularLoader />
          ) : session ? (
            <>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon={<User className="w-4 h-4" />}
                >
                  {session.user?.name || session.user?.email}
                </Button>
              </div>
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                trailingIcon={<LogOut className="w-4 h-4" />}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                leadingIcon={<User className="w-4 h-4" />}
                onClick={() => router.push('/login')}
              >
                Login
              </Button>
              <Button
                variant="primary"
                size="sm"
                trailingIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => router.push('/register')}
              >
                Get Started
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-col space-y-3">
            {navItems.map((item) => (
              <Button
                key={item.href}
                onClick={() => {
                  router.push(item.href)
                  setIsMobileMenuOpen(false)
                }}
                variant={pathname.startsWith(item.href) ? "primary" : "ghost"}
                size="sm"
                className='px-4'
                leadingIcon={item.icon}
              >
                  {item.label}
              </Button>
            ))}
            {status === 'loading' ? (
                <CircularLoader />
            ) : session ? (
              <>
                <div className="flex items-center space-x-2 py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    leadingIcon={<User className="w-4 h-4" />}
                  >
                    {session.user?.name || session.user?.email}
                  </Button>
                </div>
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  size="sm"
                  trailingIcon={<LogOut className="w-4 h-4" />}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon={<User className="w-4 h-4" />}
                  onClick={() => {
                    router.push('/login')
                    setIsMobileMenuOpen(false)
                  }}
                >
                  Login
                </Button>
                <Button
                  onClick={() => {
                    router.push('/register')
                    setIsMobileMenuOpen(false)
                  }}
                  variant="primary"
                  size="sm"
                  trailingIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
} 