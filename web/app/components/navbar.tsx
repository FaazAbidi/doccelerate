'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, Zap, ArrowRight, User, LogOut, FileText } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { data: session, status } = useSession()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll)
      return () => window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const navItems: { href: string; label: string }[] = session 
    ? [{ href: '/docs', label: 'Documentation' }]
    : []

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' })
    setIsMobileMenuOpen(false)
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
        <div className="hidden md:flex items-center space-x-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-body-sm text-neutral hover:text-primary transition-colors duration-200"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center space-x-4">
          {status === 'loading' ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          ) : session ? (
            <>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <span className="text-body-sm text-neutral">
                  {session.user?.name || session.user?.email}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="text-body-sm text-neutral hover:text-primary transition-colors duration-200 flex items-center space-x-1"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-body-sm text-neutral hover:text-primary transition-colors duration-200 cursor-pointer"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="bg-primary text-white px-4 py-2 rounded-full text-body-sm font-medium hover:bg-opacity-90 transition-all duration-200 flex items-center space-x-2 cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 text-neutral hover:text-primary transition-colors duration-200"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-col space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-body-sm text-neutral hover:text-primary transition-colors duration-200 flex items-center space-x-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <FileText className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            ))}
            {status === 'loading' ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            ) : session ? (
              <>
                <div className="flex items-center space-x-2 py-2">
                  <div className="w-8 h-8 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-body-sm text-neutral">
                    {session.user?.name || session.user?.email}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-body-sm text-neutral hover:text-primary transition-colors duration-200 flex items-center space-x-2 w-fit"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-body-sm text-neutral hover:text-primary transition-colors duration-200 cursor-pointer"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="bg-primary text-white px-4 py-2 rounded-full text-body-sm font-medium hover:bg-opacity-90 transition-all duration-200 flex items-center space-x-2 w-fit cursor-pointer"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
} 