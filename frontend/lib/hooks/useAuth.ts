import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import { tokenManager } from '@/lib/auth/tokenManager'

/**
 * useAuth Hook
 * Provides auth state and utilities for components
 */
export function useAuth() {
  const router = useRouter()
  const {
    user,
    accessToken,
    refreshToken,
    offlineToken,
    deviceId,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    logoutAllDevices,
    refreshAccessToken,
    setupOfflineToken,
  } = useAuthStore()

  // Get JWT claims from access token
  const getClaims = useCallback(() => {
    if (!accessToken) return null
    try {
      return tokenManager.getClaims(accessToken)
    } catch {
      return null
    }
  }, [accessToken])

  // Check if token is expired
  const isTokenExpired = useCallback(() => {
    if (!accessToken) return true
    return tokenManager.isExpired(accessToken)
  }, [accessToken])

  // Get time remaining until token expires
  const getTimeUntilExpiry = useCallback(() => {
    if (!accessToken) return 0
    return tokenManager.getTimeUntilExpiry(accessToken)
  }, [accessToken])

  // Check if user has specific permission
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!accessToken) return false
      return tokenManager.hasPermission(accessToken, permission)
    },
    [accessToken]
  )

  // Check if user has any of the given permissions
  const hasAnyPermission = useCallback(
    (...permissions: string[]): boolean => {
      if (!accessToken) return false
      return permissions.some((p) => tokenManager.hasPermission(accessToken, p))
    },
    [accessToken]
  )

  // Check if user has specific role
  const hasRole = useCallback(
    (role: string): boolean => {
      const claims = getClaims()
      return claims?.role === role
    },
    [getClaims]
  )

  // Check if user is at least a certain role (based on hierarchy)
  const hasAtLeastRole = useCallback(
    (role: string): boolean => {
      const claims = getClaims()
      if (!claims) return false

      const hierarchy = [
        'public',
        'customer',
        'cashier',
        'supervisor',
        'branch_manager',
        'tenant_admin',
        'tenant_owner',
        'saas_admin',
        'super_admin',
      ]

      const userLevel = hierarchy.indexOf(claims.role)
      const requiredLevel = hierarchy.indexOf(role)

      if (userLevel === -1 || requiredLevel === -1) {
        return false
      }

      return userLevel >= requiredLevel
    },
    [getClaims]
  )

  // Check if token needs refresh
  const needsRefresh = useCallback(() => {
    if (!accessToken) return false
    return tokenManager.needsRefresh(accessToken, 300) // 5 minute threshold
  }, [accessToken])

  // Check if using offline token
  const isOffline = useCallback(() => {
    if (!offlineToken) return false
    return tokenManager.isOfflineToken(offlineToken)
  }, [offlineToken])

  // Logout handler that redirects
  const handleLogout = useCallback(async () => {
    await logout()
    router.push('/login')
  }, [logout, router])

  // Logout all devices handler
  const handleLogoutAll = useCallback(async () => {
    await logoutAllDevices()
    router.push('/login')
  }, [logoutAllDevices, router])

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,
    accessToken,
    refreshToken,
    offlineToken,
    deviceId,

    // Actions
    login,
    logout: handleLogout,
    logoutAllDevices: handleLogoutAll,
    refreshAccessToken,
    setupOfflineToken,

    // Utilities
    getClaims,
    isTokenExpired,
    getTimeUntilExpiry,
    hasPermission,
    hasAnyPermission,
    hasRole,
    hasAtLeastRole,
    needsRefresh,
    isOffline,
  }
}
