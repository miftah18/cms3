import { NextRequest, NextResponse } from 'next/server'

/**
 * Auth Middleware
 * Runs at the edge to check authentication and redirect accordingly
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Get token from cookies
  const accessToken = request.cookies.get('access_token')?.value
  const refreshToken = request.cookies.get('refresh_token')?.value
  const hasAuth = accessToken || refreshToken

  // Public routes that don't require auth
  const publicRoutes = ['/login', '/pin', '/forgot-password', '/reset-password']
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  // API routes are handled separately
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Redirect to login if not authenticated and trying to access protected route
  if (!hasAuth && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect to POS if authenticated and trying to access auth routes
  if (hasAuth && isPublicRoute) {
    // Exception: allow /pin after login
    if (pathname === '/pin' || pathname === '/login?from=') {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL('/pos', request.url))
  }

  // Inject tenant domain from hostname into response headers
  const response = NextResponse.next()
  const hostname = request.headers.get('host') || ''
  
  if (hostname) {
    response.headers.set('x-tenant-domain', hostname)
  }

  // Pass device ID through header if it exists
  const deviceId = request.cookies.get('device_id')?.value
  if (deviceId) {
    response.headers.set('x-device-id', deviceId)
  }

  return response
}

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest|.well-known).*)',
  ],
}
