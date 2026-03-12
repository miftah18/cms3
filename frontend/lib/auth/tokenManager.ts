import type { JWTClaims } from '@/lib/api/types'

/**
 * Token Manager
 * Handles JWT token parsing, validation, and expiration checks
 * without verifying the signature (frontend doesn't have the secret)
 */

export const tokenManager = {
  /**
   * Decode JWT token and extract claims
   * Note: This does NOT verify the signature - verification happens on the backend
   */
  getClaims: (token: string): JWTClaims => {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid token format')
      }

      // Decode payload (second part)
      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
      )

      return payload as JWTClaims
    } catch (error) {
      console.error('[tokenManager] Failed to decode token:', error)
      throw new Error('Invalid token')
    }
  },

  /**
   * Check if token is expired
   */
  isExpired: (token: string): boolean => {
    try {
      const claims = tokenManager.getClaims(token)
      const now = Math.floor(Date.now() / 1000)
      return claims.exp <= now
    } catch {
      return true // Treat invalid token as expired
    }
  },

  /**
   * Get time remaining until token expires (in seconds)
   */
  getTimeUntilExpiry: (token: string): number => {
    try {
      const claims = tokenManager.getClaims(token)
      const now = Math.floor(Date.now() / 1000)
      return Math.max(0, claims.exp - now)
    } catch {
      return 0
    }
  },

  /**
   * Check if token needs refresh
   * Returns true if token will expire within the given threshold
   */
  needsRefresh: (token: string, thresholdSeconds: number = 300): boolean => {
    const timeLeft = tokenManager.getTimeUntilExpiry(token)
    return timeLeft <= thresholdSeconds
  },

  /**
   * Extract user ID from token
   */
  getUserId: (token: string): string => {
    try {
      const claims = tokenManager.getClaims(token)
      return claims.sub
    } catch {
      return ''
    }
  },

  /**
   * Extract user email from token
   */
  getUserEmail: (token: string): string => {
    try {
      const claims = tokenManager.getClaims(token)
      return claims.email
    } catch {
      return ''
    }
  },

  /**
   * Extract permissions from token
   */
  getPermissions: (token: string): string[] => {
    try {
      const claims = tokenManager.getClaims(token)
      return claims.permissions || []
    } catch {
      return []
    }
  },

  /**
   * Check if token has specific permission
   */
  hasPermission: (token: string, permission: string): boolean => {
    const permissions = tokenManager.getPermissions(token)
    return permissions.includes(permission)
  },

  /**
   * Check if token is an offline token
   */
  isOfflineToken: (token: string): boolean => {
    try {
      const claims = tokenManager.getClaims(token)
      return claims.offline === true
    } catch {
      return false
    }
  },

  /**
   * Get token scope
   */
  getScope: (token: string): string => {
    try {
      const claims = tokenManager.getClaims(token)
      return claims.scope || 'full'
    } catch {
      return 'full'
    }
  },

  /**
   * Check if token has full scope
   */
  hasFullScope: (token: string): boolean => {
    return tokenManager.getScope(token) === 'full'
  },
}
