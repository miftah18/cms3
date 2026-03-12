'use client'

import { useState } from 'react'
import { useActiveSessions } from '@/lib/hooks/useActiveSessions'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatDistanceToNow } from 'date-fns'

/**
 * SessionManager Component
 * Display and manage active sessions across devices
 */
export function SessionManager() {
  const { logoutAllDevices } = useAuth()
  const { sessions, isLoading, error, revokeSession } = useActiveSessions()
  const [revoking, setRevoking] = useState<string | null>(null)

  const currentSession = sessions.find((s) => s.is_current)
  const otherSessions = sessions.filter((s) => !s.is_current)

  const handleRevokeSession = async (sessionId: string) => {
    setRevoking(sessionId)
    try {
      await revokeSession(sessionId)
    } finally {
      setRevoking(null)
    }
  }

  const handleLogoutAll = async () => {
    if (confirm('Are you sure? You will be logged out on all devices.')) {
      await logoutAllDevices()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Active Sessions</h2>
        <p className="text-sm text-muted-foreground">
          Manage your active sessions and logged-in devices
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {/* Current Session */}
      {currentSession && !isLoading && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{currentSession.device_name}</h3>
                <span className="inline-block px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded">
                  This Device
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{currentSession.user_agent}</p>
              <p className="text-xs text-muted-foreground">
                IP: {currentSession.ip_address}
              </p>
              <p className="text-xs text-muted-foreground">
                Signed in{' '}
                {formatDistanceToNow(new Date(currentSession.login_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Other Sessions */}
      {otherSessions.length > 0 && !isLoading && (
        <div className="space-y-3">
          <h3 className="font-medium text-sm">Other Devices</h3>
          {otherSessions.map((session) => (
            <div key={session.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <h3 className="font-medium">{session.device_name}</h3>
                  <p className="text-xs text-muted-foreground">{session.user_agent}</p>
                  <p className="text-xs text-muted-foreground">
                    IP: {session.ip_address}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Signed in{' '}
                    {formatDistanceToNow(new Date(session.login_at), {
                      addSuffix: true,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last active{' '}
                    {formatDistanceToNow(new Date(session.last_activity_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                <button
                  onClick={() => handleRevokeSession(session.id)}
                  disabled={revoking === session.id}
                  className="rounded-md bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                >
                  {revoking === session.id ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {sessions.length === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed border-border bg-muted/50 p-6 text-center">
          <p className="text-sm text-muted-foreground">No sessions found</p>
        </div>
      )}

      {/* Logout All Button */}
      {sessions.length > 1 && !isLoading && (
        <button
          onClick={handleLogoutAll}
          className="w-full rounded-md bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20"
        >
          Logout from All Devices
        </button>
      )}
    </div>
  )
}
