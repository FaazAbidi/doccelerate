import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectGithubAccount } from '@/app/actions/githubConnect'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(new URL('/repos?error=github_auth_failed', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/repos?error=no_code', request.url))
  }

  // Check if user is authenticated
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login?error=not_authenticated', request.url))
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID!,
        client_secret: process.env.GITHUB_CLIENT_SECRET!,
        code: code,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData)
      return NextResponse.redirect(new URL('/repos?error=token_exchange_failed', request.url))
    }

    const accessToken = tokenData.access_token

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })

    const githubUser = await userResponse.json()

    // Connect the GitHub account
    const result = await connectGithubAccount(
      {
        id: githubUser.id.toString(),
        login: githubUser.login,
        email: githubUser.email,
        name: githubUser.name,
        avatar_url: githubUser.avatar_url,
      },
      accessToken
    )

    if (result.success) {
      return NextResponse.redirect(new URL('/repos?success=github_connected', request.url))
    } else {
      return NextResponse.redirect(new URL(`/repos?error=${encodeURIComponent(result.error || 'connection_failed')}`, request.url))
    }

  } catch (error) {
    console.error('GitHub OAuth callback error:', error)
    return NextResponse.redirect(new URL('/repos?error=callback_failed', request.url))
  }
} 