import { useEffect, useState, useCallback } from 'react'
import { useAuth } from './useAuth'

interface UseOfflineAuthOptions {
  onOfflineModeEnter?: () => void
  onOfflineModeExit?: () => void
}

/**
 * useOfflineAuth Hook
 * Manage offline authentication and token switching
 */
export function useOfflineAuth({
  onOfflineModeEnter,
  onOfflineModeExit,
}: UseOfflineAuthOptions = {}) {
  const { offlineToken, isOffline } = useAuth()
  const [isInOfflineMode, setIsInOfflineMode] = useState(false)

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      console.log('[useOfflineAuth] Back online')
      setIsInOfflineMode(false)
      onOfflineModeExit?.()
    }

    const handleOffline = () => {
      console.log('[useOfflineAuth] Went offline')
      if (offlineToken) {
        setIsInOfflineMode(true)
        onOfflineModeEnter?.()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check initial status
    if (!navigator.onLine && offlineToken) {
      setIsInOfflineMode(true)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [offlineToken, onOfflineModeEnter, onOfflineModeExit])

  // Check if critical operation can be performed
  const canPerformCriticalOperation = useCallback((): boolean => {
    // Can't revoke sessions or logout all from offline mode
    return !isInOfflineMode
  }, [isInOfflineMode])

  // Get warning message if in offline mode
  const getOfflineWarning = useCallback((): string | null => {
    if (!isInOfflineMode) return null
    return 'You are in offline mode. Some features like session management are limited.'
  }, [isInOfflineMode])

  return {
    isInOfflineMode,
    hasOfflineToken: !!offlineToken,
    canPerformCriticalOperation,
    getOfflineWarning,
  }
}
