import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })
  const { pathname } = request.nextUrl
  
  console.log(`Middleware: ${pathname}, Token exists: ${!!token}`)
  
  // Redirect authenticated users from public pages to docs
  if (token) {
    if (pathname === '/') {
      console.log('Redirecting from homepage to docs')
      return NextResponse.redirect(new URL('/docs', request.url))
    }
    
    if (pathname === '/login' || pathname.startsWith('/login')) {
      console.log('Redirecting from login to docs')
      return NextResponse.redirect(new URL('/docs', request.url))
    }
    
    if (pathname === '/register' || pathname.startsWith('/register')) {
      console.log('Redirecting from register to docs')
      return NextResponse.redirect(new URL('/docs', request.url))
    }
  }
  
  // Redirect unauthenticated users from protected routes to login
  if (!token && pathname.startsWith('/docs')) {
    console.log('Redirecting from docs to login')
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  console.log('No redirect needed')
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
} 