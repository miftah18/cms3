'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/lib/store/authStore';

export const PERMISSIONS = {
  // User Management
  VIEW_USERS: 'users.view',
  CREATE_USER: 'users.create',
  EDIT_USER: 'users.change',
  DELETE_USER: 'users.delete',
  MANAGE_PERMISSIONS: 'users.manage_permissions',

  // Products
  VIEW_PRODUCTS: 'products.view',
  CREATE_PRODUCT: 'products.create',
  EDIT_PRODUCT: 'products.change',
  DELETE_PRODUCT: 'products.delete',

  // Transactions
  VIEW_TRANSACTIONS: 'transactions.view',
  CREATE_TRANSACTION: 'transactions.create',
  EDIT_TRANSACTION: 'transactions.change',
  DELETE_TRANSACTION: 'transactions.delete',

  // Reports
  VIEW_REPORTS: 'reports.view',
  EXPORT_REPORTS: 'reports.export',

  // Settings
  VIEW_SETTINGS: 'settings.view',
  EDIT_SETTINGS: 'settings.change',

  // Payments
  VIEW_PAYMENTS: 'payments.view',
  PROCESS_PAYMENT: 'payments.process',
  REFUND_PAYMENT: 'payments.refund',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export function usePermissions() {
  const { user } = useAuthStore();

  const permissionsList = useMemo(() => {
    return user?.permissions || [];
  }, [user?.permissions]);

  const hasPermission = (permission: Permission | string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true; // Admins have all permissions
    return permissionsList.includes(permission);
  };

  const hasAnyPermission = (permissions: Permission[] | string[]): boolean => {
    return permissions.some(p => hasPermission(p));
  };

  const hasAllPermissions = (permissions: Permission[] | string[]): boolean => {
    return permissions.every(p => hasPermission(p));
  };

  const canViewUsers = hasPermission(PERMISSIONS.VIEW_USERS);
  const canCreateUser = hasPermission(PERMISSIONS.CREATE_USER);
  const canEditUser = hasPermission(PERMISSIONS.EDIT_USER);
  const canDeleteUser = hasPermission(PERMISSIONS.DELETE_USER);
  const canManagePermissions = hasPermission(PERMISSIONS.MANAGE_PERMISSIONS);

  const canViewProducts = hasPermission(PERMISSIONS.VIEW_PRODUCTS);
  const canCreateProduct = hasPermission(PERMISSIONS.CREATE_PRODUCT);
  const canEditProduct = hasPermission(PERMISSIONS.EDIT_PRODUCT);
  const canDeleteProduct = hasPermission(PERMISSIONS.DELETE_PRODUCT);

  const canViewTransactions = hasPermission(PERMISSIONS.VIEW_TRANSACTIONS);
  const canCreateTransaction = hasPermission(PERMISSIONS.CREATE_TRANSACTION);

  const canViewReports = hasPermission(PERMISSIONS.VIEW_REPORTS);
  const canExportReports = hasPermission(PERMISSIONS.EXPORT_REPORTS);

  const canEditSettings = hasPermission(PERMISSIONS.EDIT_SETTINGS);

  return {
    permissions: permissionsList,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canViewUsers,
    canCreateUser,
    canEditUser,
    canDeleteUser,
    canManagePermissions,
    canViewProducts,
    canCreateProduct,
    canEditProduct,
    canDeleteProduct,
    canViewTransactions,
    canCreateTransaction,
    canViewReports,
    canExportReports,
    canEditSettings,
  };
}
