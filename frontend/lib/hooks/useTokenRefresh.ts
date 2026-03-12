import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from './useAuth'
import { tokenManager } from '@/lib/auth/tokenManager'

interface UseTokenRefreshOptions {
  refreshThresholdSeconds?: number // Refresh when this many seconds remain (default 5 min)
  checkIntervalSeconds?: number // How often to check token status (default 30 sec)
  onRefreshError?: (error: Error) => void
}

/**
 * useTokenRefresh Hook
 * Automatically refreshes JWT token before expiration
 */
export function useTokenRefresh({
  refreshThresholdSeconds = 300, // 5 minutes
  checkIntervalSeconds = 30,
  onRefreshError,
}: UseTokenRefreshOptions = {}) {
  const { accessToken, refreshAccessToken, isAuthenticated } = useAuth()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRefreshingRef = useRef(false)

  // Check if we're online
  const isOnline = useCallback(() => {
    return typeof window !== 'undefined' && navigator.onLine
  }, [])

  // Perform token refresh
  const performRefresh = useCallback(async () => {
    if (isRefreshingRef.current || !isOnline()) {
      return
    }

    // Check if token needs refresh
    if (!accessToken || !tokenManager.needsRefresh(accessToken, refreshThresholdSeconds)) {
      return
    }

    isRefreshingRef.current = true

    try {
      console.log('[useTokenRefresh] Refreshing access token...')
      const success = await refreshAccessToken()
      if (!success) {
        console.warn('[useTokenRefresh] Token refresh failed')
      } else {
        console.log('[useTokenRefresh] Token refreshed successfully')
      }
    } catch (error) {
      console.error('[useTokenRefresh] Token refresh error:', error)
      if (onRefreshError && error instanceof Error) {
        onRefreshError(error)
      }
    } finally {
      isRefreshingRef.current = false
    }
  }, [accessToken, refreshAccessToken, refreshThresholdSeconds, isOnline, onRefreshError])

  // Setup token refresh interval
  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      // Clear interval if not authenticated
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Perform initial check immediately
    performRefresh()

    // Setup interval
    intervalRef.current = setInterval(() => {
      performRefresh()
    }, checkIntervalSeconds * 1000)

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isAuthenticated, accessToken, checkIntervalSeconds, performRefresh])

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('[useTokenRefresh] Back online, checking token refresh...')
      performRefresh()
    }

    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [performRefresh])

  // Expose manual refresh function
  return { performRefresh }
}
