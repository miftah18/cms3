# Frontend JWT Authentication Integration Guide

Complete guide for integrating JWT authentication with the Next.js 14 frontend.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [File Structure](#file-structure)
- [Core Concepts](#core-concepts)
- [Usage Patterns](#usage-patterns)
- [Error Handling](#error-handling)
- [Offline Support](#offline-support)
- [Testing](#testing)
- [Common Issues](#common-issues)

## Quick Start

### 1. Environment Setup

Create `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_ENV=development
```

### 2. Install Dependencies

```bash
npm install zustand axios date-fns
```

### 3. Use Auth in Components

```typescript
'use client'

import { useAuth } from '@/lib/hooks/useAuth'

export function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth()

  if (!isAuthenticated) return <p>Not logged in</p>

  return (
    <div>
      <p>Welcome, {user?.email}</p>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```

## Architecture Overview

### Token Flow

```
┌─────────────┐
│   Login     │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│ Get Tokens (JWT)     │
│ - access_token       │
│ - refresh_token      │
│ - offline_token      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Store Tokens         │
│ - accessToken        │
│ - refreshToken       │
│ - offlineToken       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Auto-Refresh         │
│ Before Expiry        │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Make API Requests    │
│ With Bearer Token    │
└──────────────────────┘
```

### State Management

**Zustand Store** (`authStore.ts`):
- Manages JWT tokens and user state
- Persists to localStorage
- Handles login, logout, refresh
- Exposes actions for components

**API Client** (`lib/api/client.ts`):
- Axios instance with interceptors
- Auto-injects Authorization header
- Auto-refreshes on 401
- Handles offline mode

## File Structure

```
frontend/
├── lib/
│   ├── store/
│   │   └── authStore.ts              ← Zustand auth state
│   ├── api/
│   │   ├── client.ts                 ← Axios client with interceptors
│   │   ├── endpoints/auth.ts         ← JWT API functions
│   │   └── types.ts                  ← Auth TypeScript types
│   ├── auth/
│   │   ├── tokenManager.ts           ← JWT parsing & expiration
│   │   └── offlineAuthSync.ts        ← Offline sync logic
│   ├── hooks/
│   │   ├── useAuth.ts                ← Main auth hook
│   │   ├── useTokenRefresh.ts        ← Auto-refresh effect
│   │   ├── useOfflineAuth.ts         ← Offline mode detection
│   │   └── useActiveSessions.ts      ← Session management
│   └── utils/
│       └── device.ts                 ← Device detection
├── components/
│   └── auth/
│       ├── LoginForm.tsx             ← Login form
│       ├── PINSetup.tsx              ← PIN setup modal
│       ├── ProtectedRoute.tsx        ← Route protection HOC
│       └── SessionManager.tsx        ← Session management UI
├── app/
│   ├── middleware.ts                 ← Auth guard middleware
│   ├── (auth)/
│   │   ├── login/page.tsx            ← Login page
│   │   └── pin/page.tsx              ← PIN setup page
│   └── (tenant)/
│       └── settings/sessions/page.tsx ← Session management page
└── FRONTEND_AUTH_INTEGRATION.md      ← This file
```

## Core Concepts

### 1. JWT Tokens

Three types of tokens:

**Access Token** (15 minutes)
- Used for API requests
- Short-lived, auto-refreshes
- Contains user info and permissions

**Refresh Token** (7 days)
- Stored securely in sessionStorage
- Used to get new access token
- Longer-lived for persistent sessions

**Offline Token** (12 hours)
- Optional, for offline operations
- Limited permissions/scope
- Generated during login if "Remember device" checked

### 2. Token Manager

Utility for JWT operations without signature verification:

```typescript
import { tokenManager } from '@/lib/auth/tokenManager'

// Get claims from token
const claims = tokenManager.getClaims(token)

// Check if expired
if (tokenManager.isExpired(token)) { ... }

// Get time remaining
const seconds = tokenManager.getTimeUntilExpiry(token)

// Check permission
if (tokenManager.hasPermission(token, 'pos:write')) { ... }
```

### 3. Auth Store

Zustand store for global auth state:

```typescript
import { useAuthStore } from '@/lib/store/authStore'

const { 
  user,           // Current user info
  accessToken,    // JWT access token
  isAuthenticated, // Auth status
  login,          // Login action
  logout,         // Logout action
  refreshAccessToken, // Manual refresh
} = useAuthStore()
```

### 4. Middleware

Edge middleware for auth protection:

- Redirects unauthenticated users to `/login`
- Redirects authenticated users away from auth pages
- Passes tenant domain to backend via headers

## Usage Patterns

### Pattern 1: Protected Component

```typescript
'use client'

import { useAuth } from '@/lib/hooks/useAuth'

export function AdminDashboard() {
  const { isAuthenticated, hasRole } = useAuth()

  if (!isAuthenticated) return <p>Not logged in</p>
  if (!hasRole('admin')) return <p>Access denied</p>

  return <div>Admin content</div>
}
```

### Pattern 2: Protected Route with HOC

```typescript
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

export default function SettingsPage() {
  return (
    <ProtectedRoute requiredRole="tenant_admin">
      <AdminSettings />
    </ProtectedRoute>
  )
}
```

### Pattern 3: API Request with Auto-Refresh

```typescript
'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { apiClient } from '@/lib/api/client'

export function DataFetcher() {
  const { accessToken } = useAuth()

  // API client automatically injects token and refreshes on 401
  const fetchData = async () => {
    try {
      const data = await apiClient.get('/data/')
      return data
    } catch (err) {
      console.error('API error:', err)
    }
  }

  return <button onClick={fetchData}>Fetch</button>
}
```

### Pattern 4: Manual Token Refresh

```typescript
'use client'

import { useAuth } from '@/lib/hooks/useAuth'

export function TokenStatus() {
  const { 
    refreshAccessToken, 
    getTimeUntilExpiry,
    needsRefresh 
  } = useAuth()

  const handleRefresh = async () => {
    const success = await refreshAccessToken()
    if (success) console.log('Token refreshed')
  }

  const timeLeft = getTimeUntilExpiry()
  const willExpireSoon = needsRefresh()

  return (
    <div>
      <p>Time until expiry: {timeLeft}s</p>
      {willExpireSoon && (
        <button onClick={handleRefresh}>Refresh Now</button>
      )}
    </div>
  )
}
```

### Pattern 5: Offline Mode Detection

```typescript
'use client'

import { useOfflineAuth } from '@/lib/hooks/useOfflineAuth'

export function OfflineIndicator() {
  const { isInOfflineMode, canPerformCriticalOperation } = useOfflineAuth()

  return (
    <div>
      {isInOfflineMode && <p>Working offline</p>}
      {!canPerformCriticalOperation && (
        <p>Session management disabled in offline mode</p>
      )}
    </div>
  )
}
```

### Pattern 6: Session Management

```typescript
'use client'

import { useActiveSessions } from '@/lib/hooks/useActiveSessions'

export function SessionList() {
  const { sessions, revokeSession } = useActiveSessions()

  return (
    <div>
      {sessions.map((session) => (
        <div key={session.id}>
          <p>{session.device_name}</p>
          <button onClick={() => revokeSession(session.id)}>
            Remove Device
          </button>
        </div>
      ))}
    </div>
  )
}
```

## Error Handling

### Common Error Types

```typescript
import { AuthError, OfflineError, ValidationError } from '@/lib/api/types'

try {
  await login(email, password)
} catch (err) {
  if (err instanceof AuthError) {
    console.error('Auth failed:', err.message)
  } else if (err instanceof OfflineError) {
    console.error('Offline:', err.message)
  } else if (err instanceof ValidationError) {
    console.error('Invalid input:', err.details)
  }
}
```

### API Error Response Format

```typescript
{
  error: {
    code: 'INVALID_CREDENTIALS',
    message: 'Email or password is incorrect',
    details: {
      email: 'User not found',
    },
    status: 401
  }
}
```

### Error Handling in Components

```typescript
'use client'

import { useAuth } from '@/lib/hooks/useAuth'

export function LoginForm() {
  const { login, error, isLoading, clearError } = useAuth()

  return (
    <form onSubmit={async (e) => {
      e.preventDefault()
      clearError() // Clear previous errors
      
      try {
        await login(email, password)
      } catch (err) {
        // Error is automatically stored in state
      }
    }}>
      {error && <p className="text-red-500">{error}</p>}
      <input type="email" />
      <input type="password" />
      <button disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}
```

## Offline Support

### Offline Token Setup

During login with "Remember device" checked:

```typescript
// User gets offline token with 12-hour expiry
const { offlineToken } = await authApi.setupOfflineToken(password)

// Store in auth store
useAuthStore.setState({ offlineToken })
```

### Offline Mode Behavior

When offline:
- API client uses `offlineToken` instead of `accessToken`
- Limited API operations available
- Session management disabled
- Changes queued for sync when online

### Offline Indicator

```typescript
<OfflineBanner /> // Shows when isInOfflineMode = true
```

### Sync on Reconnect

```typescript
useEffect(() => {
  window.addEventListener('online', async () => {
    // Queue and sync offline changes
    await authApi.syncOfflineChanges(pendingChanges)
  })
}, [])
```

## Testing

### Unit Tests

```typescript
import { renderHook, act } from '@testing-library/react'
import { useAuth } from '@/lib/hooks/useAuth'

describe('useAuth', () => {
  it('should login with credentials', async () => {
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.login('user@test.com', 'password123')
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toBeDefined()
  })

  it('should handle login errors', async () => {
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      try {
        await result.current.login('invalid@test.com', 'wrong')
      } catch {
        // Expected
      }
    })

    expect(result.current.error).toBeTruthy()
  })
})
```

### Integration Tests

Test complete auth flow including:
- Login/logout
- Token refresh
- Protected routes
- Offline mode
- Session management

## Common Issues

### Issue 1: Token Always Expired

**Cause**: Client and server clocks not synchronized

**Solution**: Check server time, ensure NTP sync

### Issue 2: Auto-refresh Loop

**Cause**: Refresh token also invalid/expired

**Solution**: User must login again. Implement fallback.

### Issue 3: Offline Token Not Working

**Cause**: Password verification failed during setup

**Solution**: Ask user to re-enter password, re-setup offline token

### Issue 4: CORS Errors

**Cause**: API not configured for frontend origin

**Solution**: Add frontend URL to CORS whitelist in backend

### Issue 5: Tokens Not Persisting

**Cause**: localStorage cleared or disabled

**Solution**: Use sessionStorage for refresh token instead

## Environment Variables

```bash
# Required
NEXT_PUBLIC_API_URL=http://localhost:8000

# Optional
NEXT_PUBLIC_ENV=development
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

## API Endpoints Required

The frontend expects these backend endpoints:

```
POST   /api/v1/auth/login/                 # Login
POST   /api/v1/auth/refresh/               # Refresh token
POST   /api/v1/auth/logout/                # Logout current device
POST   /api/v1/auth/logout-all/            # Logout all devices
GET    /api/v1/auth/token-status/          # Token status
POST   /api/v1/auth/offline/request-token/ # Setup offline token
POST   /api/v1/auth/offline/sync/          # Sync offline changes
GET    /api/v1/auth/sessions/list/         # Get active sessions
POST   /api/v1/auth/sessions/{id}/revoke/  # Revoke session
PATCH  /api/v1/auth/sessions/{id}/         # Update session metadata
```

## Security Best Practices

1. **Never log tokens** - Tokens are sensitive data
2. **Use HTTPS** - Always use HTTPS in production
3. **HttpOnly cookies** - Refresh token stored in httpOnly cookie (handled by backend)
4. **Validate on backend** - Always validate tokens on backend
5. **Rate limiting** - Implement rate limiting on login/refresh endpoints
6. **CSRF protection** - Use CSRF tokens for state-changing requests
7. **Token rotation** - Refresh token should rotate on each refresh
8. **Offline token scope** - Offline token should have limited permissions

## Troubleshooting

### Debug Token Issues

```typescript
import { tokenManager } from '@/lib/auth/tokenManager'

const { useAuthStore } = require('@/lib/store/authStore')
const { accessToken } = useAuthStore.getState()

console.log('[DEBUG] Claims:', tokenManager.getClaims(accessToken))
console.log('[DEBUG] Expired:', tokenManager.isExpired(accessToken))
console.log('[DEBUG] Time left:', tokenManager.getTimeUntilExpiry(accessToken))
console.log('[DEBUG] Permissions:', tokenManager.getPermissions(accessToken))
```

### Check Store State

```typescript
import { useAuthStore } from '@/lib/store/authStore'

const state = useAuthStore.getState()
console.log('[DEBUG] Auth State:', {
  isAuthenticated: state.isAuthenticated,
  user: state.user,
  hasAccessToken: !!state.accessToken,
  hasRefreshToken: !!state.refreshToken,
  hasOfflineToken: !!state.offlineToken,
  error: state.error,
})
```

## References

- [JWT.io](https://jwt.io) - JWT standard documentation
- [Zustand Docs](https://github.com/pmndrs/zustand) - State management
- [Axios Docs](https://axios-http.com/) - HTTP client
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware) - Edge middleware
