import { useState, useEffect, useCallback } from 'react'
import { authApi } from '@/lib/api/endpoints/auth'
import type { SessionInfo } from '@/lib/api/types'

interface UseActiveSessionsOptions {
  autoRefresh?: boolean
  refreshIntervalSeconds?: number
}

/**
 * useActiveSessions Hook
 * Fetch and manage active sessions/devices for current user
 */
export function useActiveSessions({
  autoRefresh = true,
  refreshIntervalSeconds = 30,
}: UseActiveSessionsOptions = {}) {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await authApi.getSessions()
      setSessions(Array.isArray(data) ? data : [])
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to fetch sessions'
      setError(errorMsg)
      console.error('[useActiveSessions] Error fetching sessions:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Revoke a session
  const revokeSession = useCallback(
    async (sessionId: string) => {
      try {
        await authApi.revokeSession(sessionId)
        // Remove from local state
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      } catch (err: any) {
        const errorMsg = err?.message || 'Failed to revoke session'
        setError(errorMsg)
        throw err
      }
    },
    []
  )

  // Update session metadata
  const updateSessionMetadata = useCallback(
    async (sessionId: string, metadata: { device_name?: string }) => {
      try {
        const updated = await authApi.updateSessionMetadata(sessionId, metadata)
        // Update local state
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, ...updated } : s))
        )
        return updated
      } catch (err: any) {
        const errorMsg = err?.message || 'Failed to update session'
        setError(errorMsg)
        throw err
      }
    },
    []
  )

  // Get current session
  const currentSession = sessions.find((s) => s.is_current)

  // Get other sessions
  const otherSessions = sessions.filter((s) => !s.is_current)

  // Setup auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    // Fetch immediately
    fetchSessions()

    // Setup interval
    const interval = setInterval(() => {
      fetchSessions()
    }, refreshIntervalSeconds * 1000)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshIntervalSeconds, fetchSessions])

  return {
    sessions,
    currentSession,
    otherSessions,
    isLoading,
    error,
    refetch: fetchSessions,
    revokeSession,
    updateSessionMetadata,
  }
}
