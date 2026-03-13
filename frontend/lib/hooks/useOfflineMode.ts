'use client';

import { useState, useEffect, useCallback } from 'react';
import { syncService } from '@/lib/services/syncService';
import { offlineStorage } from '@/lib/services/offlineStorage';

export function useOfflineMode() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingOperations, setPendingOperations] = useState(0);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);

    // Listen to online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      // Auto sync when coming back online
      syncService.syncAll();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start auto sync when component mounts
    syncService.startAutoSync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      syncService.stopAutoSync();
    };
  }, []);

  // Fetch pending operations count
  useEffect(() => {
    const fetchPending = async () => {
      const operations = await syncService.getPendingOperations();
      setPendingOperations(operations.length);
    };

    fetchPending();
    const interval = setInterval(fetchPending, 5000);

    return () => clearInterval(interval);
  }, []);

  const manualSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncService.syncAll();
      const operations = await syncService.getPendingOperations();
      setPendingOperations(operations.length);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const queueOperation = useCallback(
    async (type: 'create' | 'update' | 'delete', resource: string, data: unknown) => {
      if (!isOnline) {
        await syncService.queueOperation(type, resource, data);
        const operations = await syncService.getPendingOperations();
        setPendingOperations(operations.length);
      }
    },
    [isOnline]
  );

  const clearOfflineQueue = useCallback(async () => {
    await syncService.clearQueue();
    setPendingOperations(0);
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingOperations,
    manualSync,
    queueOperation,
    clearOfflineQueue,
  };
}
