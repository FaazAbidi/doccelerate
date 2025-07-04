import { withAuth } from "next-auth/middleware"

export default withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function middleware(req) {
    // You can add additional middleware logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        
        // Allow access to auth routes without token
        if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
          return !token // Allow access only if not authenticated
        }
        
        // Protected routes require a token
        if (pathname.startsWith('/docs')) {
          return !!token
        }
        
        // Allow access to all other routes
        return true
      },
    },
    pages: {
      signIn: "/login",
      error: "/login",
    },
  }
)

export const config = {
  matcher: ["/docs/:path*", "/login", "/register"]
} 