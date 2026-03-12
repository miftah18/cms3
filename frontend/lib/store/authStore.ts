import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User, TokenResponse } from '@/lib/api/types'
import { authApi } from '@/lib/api/endpoints/auth'
import { tokenManager } from '@/lib/auth/tokenManager'
import { generateDeviceId } from '@/lib/utils/device'

export interface AuthStore {
  // State
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  offlineToken: string | null
  deviceId: string
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (email: string, password: string) => Promise<void>
  refreshAccessToken: () => Promise<boolean>
  logout: () => Promise<void>
  logoutAllDevices: () => Promise<void>
  setupOfflineToken: (password: string) => Promise<void>
  clearError: () => void
}

const authStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      refreshToken: null,
      offlineToken: null,
      deviceId: generateDeviceId(),
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Login action
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authApi.loginWithCredentials(email, password)
          const { user, access_token, refresh_token, offline_token } = response

          // Parse JWT claims
          const claims = tokenManager.getClaims(access_token)
          
          set({
            user: { ...user, permissions: claims.permissions || [] },
            accessToken: access_token,
            refreshToken: refresh_token,
            offlineToken: offline_token || null,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })

          // Save refresh token to secure storage
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('refresh_token', refresh_token)
          }
        } catch (err: any) {
          set({
            isLoading: false,
            error: err.message || 'Login failed',
            isAuthenticated: false,
          })
          throw err
        }
      },

      // Refresh access token
      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) {
          set({ isAuthenticated: false })
          return false
        }

        try {
          const response = await authApi.refreshAccessToken(refreshToken)
          const { access_token, refresh_token } = response

          set({
            accessToken: access_token,
            refreshToken: refresh_token,
            error: null,
          })

          // Update refresh token in secure storage
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('refresh_token', refresh_token)
          }

          return true
        } catch (err: any) {
          set({
            isAuthenticated: false,
            accessToken: null,
            refreshToken: null,
            user: null,
            error: err.message || 'Token refresh failed',
          })
          return false
        }
      },

      // Logout from current device
      logout: async () => {
        set({ isLoading: true })
        try {
          const { deviceId } = get()
          await authApi.logout(deviceId)
        } catch (err) {
          console.error('Logout error:', err)
        } finally {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            offlineToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          })

          // Clear secure storage
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('refresh_token')
            localStorage.removeItem('auth_store')
          }
        }
      },

      // Logout from all devices
      logoutAllDevices: async () => {
        set({ isLoading: true })
        try {
          await authApi.logoutAllDevices()
        } catch (err) {
          console.error('Logout all devices error:', err)
        } finally {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            offlineToken: null,
            isAuthenticated: false,
            isLoading: false,
          })

          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('refresh_token')
            localStorage.removeItem('auth_store')
          }
        }
      },

      // Setup offline token for critical operations
      setupOfflineToken: async (password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authApi.setupOfflineToken(password)
          set({
            offlineToken: response.offline_token,
            isLoading: false,
          })
        } catch (err: any) {
          set({
            isLoading: false,
            error: err.message || 'Failed to setup offline token',
          })
          throw err
        }
      },

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth_store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist user and tokens, not loading/error states
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        offlineToken: state.offlineToken,
        deviceId: state.deviceId,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export const useAuthStore = authStore
