'use client';

import { useState, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { apiClient } from '@/lib/api/client';

export interface Profile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  role: 'admin' | 'manager' | 'staff' | 'customer';
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

interface UpdateProfileInput {
  name?: string;
  phone?: string;
  avatar?: string;
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/users/${user.id}/`);
      setProfile(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const updateProfile = useCallback(async (data: UpdateProfileInput) => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.patch(`/users/${user.id}/`, data);
      setProfile(response.data);
      return response.data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  return {
    profile,
    loading,
    error,
    fetchProfile,
    updateProfile,
  };
}
