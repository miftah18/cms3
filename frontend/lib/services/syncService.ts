'use client';

import { offlineStorage } from './offlineStorage';
import { apiClient } from '@/lib/api/client';

/**
 * Sync Service
 * Handles synchronization between offline IndexedDB and backend API
 */

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  resource: string;
  data: unknown;
  timestamp: number;
  retryCount: number;
}

class SyncService {
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private maxRetries = 3;
  private retryDelay = 5000; // 5 seconds

  startAutoSync(intervalMs = 30000): void {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      this.syncAll().catch(err => console.error('Auto sync failed:', err));
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async syncAll(): Promise<void> {
    if (this.isSyncing) return;

    this.isSyncing = true;
    try {
      const syncQueue = await offlineStorage.getAll('sync-queue');
      
      for (const operation of syncQueue) {
        try {
          await this.executeOperation(operation as SyncOperation);
          await offlineStorage.delete('sync-queue', operation.id);
        } catch (err) {
          const op = operation as SyncOperation;
          op.retryCount++;
          
          if (op.retryCount < this.maxRetries) {
            await offlineStorage.save('sync-queue', operation);
          } else {
            console.error(`Operation ${operation.id} failed after ${this.maxRetries} retries`);
            await offlineStorage.delete('sync-queue', operation.id);
          }
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private async executeOperation(operation: SyncOperation): Promise<void> {
    const { type, resource, data } = operation;
    const endpoint = `/api/v1/${resource}/`;

    switch (type) {
      case 'create':
        await apiClient.post(endpoint, data);
        break;
      case 'update':
        const updateData = data as { id: string };
        await apiClient.patch(`${endpoint}${updateData.id}/`, data);
        break;
      case 'delete':
        const deleteData = data as { id: string };
        await apiClient.delete(`${endpoint}${deleteData.id}/`);
        break;
    }
  }

  async queueOperation(
    type: 'create' | 'update' | 'delete',
    resource: string,
    data: unknown
  ): Promise<void> {
    const operation: SyncOperation = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      resource,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    await offlineStorage.save('sync-queue', operation);
  }

  async getPendingOperations(): Promise<SyncOperation[]> {
    return (await offlineStorage.getAll('sync-queue')) as SyncOperation[];
  }

  async clearQueue(): Promise<void> {
    await offlineStorage.clear('sync-queue');
  }

  isSyncingInProgress(): boolean {
    return this.isSyncing;
  }
}

export const syncService = new SyncService();
