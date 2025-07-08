import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectGithubAccount } from '@/app/actions/githubConnect'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Get the correct base URL (prioritize NEXTAUTH_URL, fallback to request origin)
  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin

  // Handle OAuth errors
  if (error) {
    console.error('GitHub OAuth error:', error)
    return NextResponse.redirect(new URL('/repos?error=github_auth_failed', baseUrl))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/repos?error=no_code', baseUrl))
  }

  // Verify state parameter for security (CSRF protection)
  if (!state) {
    console.error('Missing state parameter in GitHub OAuth callback')
    return NextResponse.redirect(new URL('/repos?error=invalid_state', baseUrl))
  }

  // Check if user is authenticated
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login?error=not_authenticated', baseUrl))
  }

  try {
    // Debug logging
    console.log('GitHub OAuth callback - Code received:', !!code)
    console.log('GitHub OAuth callback - State received:', !!state)
    console.log('GitHub OAuth callback - Client ID exists:', !!process.env.GITHUB_CLIENT_ID)
    console.log('GitHub OAuth callback - Client Secret exists:', !!process.env.GITHUB_CLIENT_SECRET)
    console.log('GitHub OAuth callback - Base URL:', baseUrl)

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!,
        client_secret: process.env.GITHUB_CLIENT_SECRET!,
        code: code,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('GitHub OAuth token exchange error:', tokenData)
      console.error('Token response status:', tokenResponse.status)
      return NextResponse.redirect(new URL('/repos?error=token_exchange_failed', baseUrl))
    }

    const accessToken = tokenData.access_token
    const scope = tokenData.scope // This tells us what permissions we actually got

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })

    if (!userResponse.ok) {
      console.error('Failed to fetch GitHub user info:', userResponse.status)
      return NextResponse.redirect(new URL('/repos?error=user_fetch_failed', baseUrl))
    }

    const githubUser = await userResponse.json()

    // Connect the GitHub account with the received token and scopes
    const result = await connectGithubAccount(
      {
        id: githubUser.id.toString(),
        login: githubUser.login,
        email: githubUser.email,
        name: githubUser.name,
        avatar_url: githubUser.avatar_url,
      },
      accessToken,
      scope // Pass the actual scopes we received
    )

    if (result.success) {
      // Redirect to repository management page for fine-grained access setup
      return NextResponse.redirect(new URL('/repos?success=github_connected&setup=repos', baseUrl))
    } else {
      return NextResponse.redirect(new URL(`/repos?error=${encodeURIComponent(result.error || 'connection_failed')}`, baseUrl))
    }

  } catch (error) {
    console.error('GitHub OAuth callback error:', error)
    return NextResponse.redirect(new URL('/repos?error=callback_failed', baseUrl))
  }
} 