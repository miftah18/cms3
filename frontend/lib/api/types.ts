/**
 * Authentication Types
 */

export interface User {
  id: string
  email: string
  first_name?: string
  last_name?: string
  role: string
  permissions?: string[]
  is_active: boolean
  created_at?: string
}

export interface TokenResponse {
  user: User
  access_token: string
  refresh_token: string
  offline_token?: string
  expires_in: number
}

export interface SessionInfo {
  id: string
  device_id: string
  device_name?: string
  user_agent: string
  ip_address: string
  is_current: boolean
  login_at: string
  last_activity_at: string
  expires_at: string
}

export interface JWTClaims {
  sub: string // user_id
  email: string
  exp: number // expiration timestamp
  iat: number // issued at timestamp
  nbf?: number // not before timestamp
  jti?: string // JWT ID (for revocation)
  tenant_id?: string
  role: string
  permissions: string[]
  device_id?: string
  offline?: boolean
  scope?: string // 'full' or 'offline'
}

export interface OfflineSyncPayload {
  device_id: string
  timestamp: number
  changes: Array<{
    id: string
    action: 'create' | 'update' | 'delete'
    entity: string
    data: Record<string, any>
  }>
}

export interface TokenRefreshPayload {
  refresh_token: string
}

/**
 * API Response Types
 */

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, any>
  }
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/**
 * Error Types
 */

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>,
    public status?: number
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class OfflineError extends Error {
  constructor(message = 'Application is offline') {
    super(message)
    this.name = 'OfflineError'
  }
}

export class AuthError extends AppError {
  constructor(
    code: string = 'AUTH_ERROR',
    message: string = 'Authentication failed',
    details?: Record<string, any>
  ) {
    super(code, message, details, 401)
    this.name = 'AuthError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super('VALIDATION_ERROR', message, details, 400)
    this.name = 'ValidationError'
  }
}
