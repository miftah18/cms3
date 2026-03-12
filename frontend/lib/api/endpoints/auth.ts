import { apiClient } from '../client'
import type { TokenResponse, User, SessionInfo } from '../types'

export const authApi = {
  /**
   * Login with email and password
   */
  loginWithCredentials: async (
    email: string,
    password: string
  ): Promise<TokenResponse> => {
    const response = await apiClient.post('/auth/login/', {
      email,
      password,
    })
    return response
  },

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken: async (
    refreshToken: string
  ): Promise<{ access_token: string; refresh_token: string }> => {
    const response = await apiClient.post('/auth/refresh/', {
      refresh_token: refreshToken,
    })
    return response
  },

  /**
   * Logout from current device/session
   */
  logout: async (deviceId: string): Promise<void> => {
    await apiClient.post('/auth/logout/', {
      device_id: deviceId,
    })
  },

  /**
   * Logout from all devices/sessions
   */
  logoutAllDevices: async (): Promise<void> => {
    await apiClient.post('/auth/logout-all/', {})
  },

  /**
   * Get current token status and claims
   */
  getTokenStatus: async (): Promise<{
    is_valid: boolean
    expires_at: string
    claims: Record<string, any>
  }> => {
    const response = await apiClient.get('/auth/token-status/')
    return response
  },

  /**
   * Setup offline token for critical operations
   * Used when user wants to enable offline support
   */
  setupOfflineToken: async (
    password: string
  ): Promise<{ offline_token: string; expires_at: string }> => {
    const response = await apiClient.post('/auth/offline/request-token/', {
      password,
    })
    return response
  },

  /**
   * Sync offline changes back to server
   */
  syncOfflineChanges: async (
    changes: Record<string, any>
  ): Promise<{
    synced_count: number
    conflict_count: number
    conflicts: Array<{ id: string; error: string }>
  }> => {
    const response = await apiClient.post('/auth/offline/sync/', {
      changes,
    })
    return response
  },

  /**
   * Get active sessions/devices for current user
   */
  getSessions: async (): Promise<SessionInfo[]> => {
    const response = await apiClient.get('/auth/sessions/list/')
    return response.results || response
  },

  /**
   * Revoke a specific session by session ID
   */
  revokeSession: async (sessionId: string): Promise<void> => {
    await apiClient.post(`/auth/sessions/${sessionId}/revoke/`, {})
  },

  /**
   * Update session metadata (e.g., device name)
   */
  updateSessionMetadata: async (
    sessionId: string,
    metadata: { device_name?: string }
  ): Promise<SessionInfo> => {
    const response = await apiClient.patch(
      `/auth/sessions/${sessionId}/`,
      metadata
    )
    return response
  },

  /**
   * Get offline sync status
   */
  getOfflineSyncStatus: async (): Promise<{
    is_synced: boolean
    pending_count: number
    last_sync_at: string | null
  }> => {
    const response = await apiClient.get('/auth/offline/sync-status/')
    return response
  },
}
