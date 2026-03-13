'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';

interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

export function usePasswordChange() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validatePassword = useCallback((password: string): PasswordValidation => {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letters');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letters');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain numbers');
    }
    if (!/[!@#$%^&*]/.test(password)) {
      errors.push('Password must contain special characters (!@#$%^&*)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, []);

  const changePassword = useCallback(
    async (data: PasswordChangeInput) => {
      setError(null);
      setSuccess(false);

      // Validate passwords match
      if (data.newPassword !== data.confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      // Validate new password strength
      const validation = validatePassword(data.newPassword);
      if (!validation.isValid) {
        setError(validation.errors.join('; '));
        return;
      }

      setLoading(true);
      try {
        await apiClient.post('/api/v1/auth/change-password/', {
          current_password: data.currentPassword,
          new_password: data.newPassword,
        });
        setSuccess(true);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to change password';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [validatePassword]
  );

  const resetPasswordRequest = useCallback(async (email: string) => {
    setError(null);
    setLoading(true);
    try {
      await apiClient.post('/api/v1/auth/request-password-reset/', { email });
      setSuccess(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to request password reset';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    success,
    validatePassword,
    changePassword,
    resetPasswordRequest,
  };
}
