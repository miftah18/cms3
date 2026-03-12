'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'

/**
 * AuthInitializer Component
 * Initializes authentication on app startup
 * Checks for existing tokens and refreshes if needed
 */
export function AuthInitializer({ children }: { children: ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true)
  const { accessToken, refreshAccessToken, isTokenExpired } = useAuth()

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // If we have an access token and it's expired, try to refresh
        if (accessToken && isTokenExpired()) {
          console.log('[v0] Access token expired, attempting refresh...')
          const refreshed = await refreshAccessToken()
          if (!refreshed) {
            console.log('[v0] Token refresh failed')
          }
        }
      } catch (error) {
        console.error('[v0] Auth initialization error:', error)
      } finally {
        setIsInitializing(false)
      }
    }

    initializeAuth()
  }, [])

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Initializing...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
