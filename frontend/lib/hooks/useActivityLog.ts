'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

export interface ActivityLogEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failed';
  timestamp: string;
}

interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ActivityLogEntry[];
}

export function useActivityLog() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ count: 0, page: 1, pageSize: 20 });

  const fetchLogs = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/v1/activity-logs/', {
        params: { page, page_size: pageSize },
      });
      const data = response.data as PaginatedResponse;
      setLogs(data.results);
      setPagination({
        count: data.count,
        page,
        pageSize,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch activity logs');
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteLog = useCallback(async (logId: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.delete(`/api/v1/activity-logs/${logId}/`);
      setLogs(prev => prev.filter(l => l.id !== logId));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete log';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    pagination,
    fetchLogs,
    deleteLog,
  };
}
