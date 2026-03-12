import axios, { AxiosInstance, AxiosError, AxiosConfig } from 'axios'
import type { AppError, OfflineError } from './types'

/**
 * API Client
 * Axios instance with interceptors for JWT auth, auto-refresh, error handling
 */

const apiClient: AxiosInstance = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── Request Interceptor ──────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    // Import here to avoid circular dependencies
    const { useAuthStore } = require('@/lib/store/authStore')
    const { getDeviceInfo } = require('@/lib/utils/device')

    const store = useAuthStore.getState()
    const deviceInfo = getDeviceInfo()

    // Inject auth token
    if (store.accessToken) {
      config.headers.Authorization = `Bearer ${store.accessToken}`
    }

    // Inject device ID for multi-device tracking
    if (deviceInfo.device_id) {
      config.headers['X-Device-ID'] = deviceInfo.device_id
    }

    // Inject tenant domain from header (set by middleware.ts)
    if (typeof window !== 'undefined') {
      const tenantDomain = document.documentElement.getAttribute('data-tenant-domain')
      if (tenantDomain) {
        config.headers['X-Tenant-Domain'] = tenantDomain
      }
    }

    return config
  },
  (error) => Promise.reject(error)
)

// ── Response Interceptor ─────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => {
    // Unwrap data envelope if it exists
    return response.data?.data || response.data
  },

  async (error: AxiosError) => {
    const { useAuthStore } = require('@/lib/store/authStore')
    const { tokenManager } = require('@/lib/auth/tokenManager')

    const originalConfig = error.config as AxiosConfig & { _retry?: boolean }
    const store = useAuthStore.getState()

    // Auto-refresh on 401 (token expired)
    if (error.response?.status === 401 && !originalConfig._retry) {
      originalConfig._retry = true

      try {
        // Try to refresh token
        const refreshed = await store.refreshAccessToken()

        if (refreshed) {
          // Retry original request with new token
          return apiClient(originalConfig)
        }
      } catch (refreshError) {
        console.error('[apiClient] Token refresh failed:', refreshError)
      }

      // Refresh failed or no refresh token → logout and redirect
      store.logout()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      return Promise.reject(normalizeError(error))
    }

    // Handle offline mode
    if (!navigator.onLine) {
      const offlineError: OfflineError = new Error('Application is offline') as any
      offlineError.name = 'OfflineError'
      return Promise.reject(offlineError)
    }

    // Normalize other errors
    return Promise.reject(normalizeError(error))
  }
)

/**
 * Normalize axios error to AppError
 */
function normalizeError(error: AxiosError): AppError {
  const data = error.response?.data as any
  const message =
    data?.error?.message ||
    data?.message ||
    error.message ||
    'An error occurred'

  const code =
    data?.error?.code || `HTTP_${error.response?.status || 'UNKNOWN'}`

  const appError = new Error(message) as any as AppError
  appError.code = code
  appError.details = data?.error?.details || {}
  appError.status = error.response?.status

  return appError
}

export { apiClient }
