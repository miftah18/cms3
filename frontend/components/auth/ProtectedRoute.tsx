'use client'

import { ReactNode } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'

interface ProtectedRouteProps {
  children: ReactNode
  requiredPermissions?: string[] // All required
  requiredAnyPermissions?: string[] // At least one
  requiredRole?: string // Exact role match
  requiredAtLeastRole?: string // Role hierarchy
  fallback?: ReactNode
}

/**
 * ProtectedRoute Component
 * Wraps components to enforce permission/role-based access control
 */
export function ProtectedRoute({
  children,
  requiredPermissions,
  requiredAnyPermissions,
  requiredRole,
  requiredAtLeastRole,
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasPermission, hasAnyPermission, hasRole, hasAtLeastRole } =
    useAuth()

  // Loading state
  if (isLoading) {
    return (
      fallback || (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )
    )
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      fallback || (
        <div className="flex flex-col items-center justify-center h-screen space-y-4">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You must be signed in to view this page</p>
        </div>
      )
    )
  }

  // Check required permissions
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAll = requiredPermissions.every((p) => hasPermission(p))
    if (!hasAll) {
      return (
        fallback || (
          <div className="flex flex-col items-center justify-center h-screen space-y-4">
            <h1 className="text-2xl font-bold">Access Denied</h1>
            <p className="text-muted-foreground">You do not have the required permissions</p>
          </div>
        )
      )
    }
  }

  // Check any required permissions
  if (requiredAnyPermissions && requiredAnyPermissions.length > 0) {
    const hasAny = hasAnyPermission(...requiredAnyPermissions)
    if (!hasAny) {
      return (
        fallback || (
          <div className="flex flex-col items-center justify-center h-screen space-y-4">
            <h1 className="text-2xl font-bold">Access Denied</h1>
            <p className="text-muted-foreground">You do not have the required permissions</p>
          </div>
        )
      )
    }
  }

  // Check required role
  if (requiredRole) {
    const hasRequiredRole = hasRole(requiredRole)
    if (!hasRequiredRole) {
      return (
        fallback || (
          <div className="flex flex-col items-center justify-center h-screen space-y-4">
            <h1 className="text-2xl font-bold">Access Denied</h1>
            <p className="text-muted-foreground">You do not have the required role</p>
          </div>
        )
      )
    }
  }

  // Check required at least role
  if (requiredAtLeastRole) {
    const hasRequiredAtLeast = hasAtLeastRole(requiredAtLeastRole)
    if (!hasRequiredAtLeast) {
      return (
        fallback || (
          <div className="flex flex-col items-center justify-center h-screen space-y-4">
            <h1 className="text-2xl font-bold">Access Denied</h1>
            <p className="text-muted-foreground">Your role does not have sufficient permissions</p>
          </div>
        )
      )
    }
  }

  // All checks passed
  return <>{children}</>
}
