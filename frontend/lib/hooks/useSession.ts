'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

export interface SessionData {
  id: string;
  device: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  ipAddress: string;
  userAgent: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export function useSession() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/v1/sessions/');
      setSessions(response.data.results || response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  const revokeSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.delete(`/api/v1/sessions/${sessionId}/`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to revoke session';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const revokeAllOtherSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post('/api/v1/sessions/revoke-all-other/', {});
      // Keep only current session
      setSessions(prev => prev.filter(s => s.isCurrent));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to revoke sessions';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    revokeSession,
    revokeAllOtherSessions,
  };
}
