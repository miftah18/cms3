# Offline Transactions Guide

This guide covers implementing offline-first transaction handling in the CMS3 platform, allowing users to continue working without internet connectivity.

## Overview

The offline transaction system enables:
- **Create transactions offline**: Full transaction entry without network
- **Queue for sync**: Transactions stored locally until online
- **Automatic sync**: One-click or automatic sync when connection restored
- **Conflict resolution**: Handle conflicts when offline data conflicts with server
- **Status tracking**: Monitor offline and synced transactions
- **Error recovery**: Graceful failure handling and retry mechanisms

## Architecture

```
User Action (Offline)
  ↓
Local State (Zustand)
  ↓
IndexedDB Storage
  ↓
Service Worker
  ↓
Sync Queue
  ↓
[WHEN ONLINE]
  ↓
Batch API Request
  ↓
Server Validation
  ↓
Database Transaction
  ↓
Response with IDs
  ↓
Update IndexedDB
  ↓
Update UI State
```

## Setup Offline Support

### 1. Initialize IndexedDB for Transaction Storage

```typescript
// frontend/lib/offline-db.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineDB extends DBSchema {
  transactions: {
    key: string;
    value: {
      id: string;
      tempId: string;
      type: 'sale' | 'purchase' | 'return' | 'adjustment';
      status: 'pending' | 'syncing' | 'synced' | 'failed';
      data: any;
      createdAt: number;
      syncedAt?: number;
      error?: string;
      retries: number;
    };
  };
  products: {
    key: string;
    value: any;
  };
  customers: {
    key: string;
    value: any;
  };
  offlineQueue: {
    key: string;
    value: {
      action: 'create' | 'update' | 'delete';
      entityType: 'transaction' | 'product' | 'customer';
      entityId: string;
      data: any;
      timestamp: number;
      synced: boolean;
    };
  };
}

export async function initOfflineDB() {
  return openDB<OfflineDB>('cms3-offline', 1, {
    upgrade(db) {
      // Transactions store
      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('status', 'status');
        txStore.createIndex('createdAt', 'createdAt');
        txStore.createIndex('tempId', 'tempId');
      }

      // Products cache
      if (!db.objectStoreNames.contains('products')) {
        const prodStore = db.createObjectStore('products', { keyPath: 'id' });
        prodStore.createIndex('tenantId', 'tenantId');
      }

      // Customers cache
      if (!db.objectStoreNames.contains('customers')) {
        const custStore = db.createObjectStore('customers', { keyPath: 'id' });
        custStore.createIndex('tenantId', 'tenantId');
      }

      // Offline queue
      if (!db.objectStoreNames.contains('offlineQueue')) {
        const queueStore = db.createObjectStore('offlineQueue', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        queueStore.createIndex('synced', 'synced');
        queueStore.createIndex('timestamp', 'timestamp');
      }
    },
  });
}

export const offlineDB = await initOfflineDB();
```

### 2. Create Offline Transaction Hook

```typescript
// frontend/hooks/useOfflineTransaction.ts
import { useState, useCallback } from 'react';
import { offlineDB } from '@/lib/offline-db';
import { generateId } from '@/lib/utils';

export interface OfflineTransaction {
  id: string;
  tempId: string;
  type: 'sale' | 'purchase' | 'return' | 'adjustment';
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  data: {
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
      discount?: number;
    }>;
    customerId?: string;
    notes?: string;
    paymentMethod?: string;
  };
  createdAt: number;
  syncedAt?: number;
  error?: string;
  retries: number;
}

export function useOfflineTransaction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create offline transaction
  const createOfflineTransaction = useCallback(
    async (data: Omit<OfflineTransaction, 'id' | 'tempId' | 'status' | 'createdAt' | 'retries'>) => {
      setLoading(true);
      setError(null);

      try {
        const tempId = generateId();
        const transaction: OfflineTransaction = {
          id: tempId,
          tempId,
          status: 'pending',
          createdAt: Date.now(),
          retries: 0,
          ...data,
        };

        await offlineDB.put('transactions', transaction);
        return transaction;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save transaction';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Get offline transactions
  const getOfflineTransactions = useCallback(async (status?: string) => {
    try {
      const allTx = await offlineDB.getAll('transactions');
      
      if (status) {
        return allTx.filter(tx => tx.status === status);
      }
      
      return allTx;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
      return [];
    }
  }, []);

  // Update offline transaction
  const updateOfflineTransaction = useCallback(async (id: string, updates: Partial<OfflineTransaction>) => {
    try {
      const tx = await offlineDB.get('transactions', id);
      if (!tx) throw new Error('Transaction not found');
      
      const updated = { ...tx, ...updates };
      await offlineDB.put('transactions', updated);
      
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update transaction');
      throw err;
    }
  }, []);

  // Delete offline transaction
  const deleteOfflineTransaction = useCallback(async (id: string) => {
    try {
      await offlineDB.delete('transactions', id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transaction');
      throw err;
    }
  }, []);

  return {
    createOfflineTransaction,
    getOfflineTransactions,
    updateOfflineTransaction,
    deleteOfflineTransaction,
    loading,
    error,
  };
}
```

## Creating Transactions Offline

### Complete Example: POS Sales Transaction

```typescript
// frontend/components/OfflineSalesForm.tsx
import React, { useState } from 'react';
import { useOfflineTransaction } from '@/hooks/useOfflineTransaction';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function OfflineSalesForm() {
  const { isOnline } = useNetworkStatus();
  const { createOfflineTransaction, loading, error } = useOfflineTransaction();
  
  const [items, setItems] = useState<any[]>([]);
  const [notes, setNotes] = useState('');

  const handleAddItem = (productId: string, quantity: number, price: number) => {
    setItems([
      ...items,
      {
        productId,
        quantity,
        price,
        discount: 0,
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const transaction = await createOfflineTransaction({
        type: 'sale',
        data: {
          items,
          notes,
          paymentMethod: 'cash',
        },
      });

      // Show success message with offline indicator
      console.log('Transaction saved:', transaction);
      console.log('[v0] Transaction status:', isOnline ? 'will sync' : 'queued offline');

      // Reset form
      setItems([]);
      setNotes('');
    } catch (err) {
      console.error('Failed to create transaction:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="sales-form">
      <div className="header">
        <h2>Sales Transaction</h2>
        {!isOnline && <span className="offline-badge">Offline Mode</span>}
      </div>

      <div className="items-section">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Subtotal</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td>{item.productId}</td>
                <td>{item.quantity}</td>
                <td>${item.price}</td>
                <td>${item.quantity * item.price}</td>
                <td>
                  <button onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes..."
      />

      {error && <div className="error">{error}</div>}

      <button type="submit" disabled={loading || items.length === 0}>
        {loading ? 'Saving...' : 'Save Transaction'}
      </button>
    </form>
  );
}
```

## Syncing Offline Transactions

### Sync Service

```typescript
// frontend/services/offline-sync-service.ts
import { offlineDB } from '@/lib/offline-db';
import { getAuthToken } from '@/lib/auth';

export class OfflineSyncService {
  async syncPendingTransactions() {
    console.log('[v0] Starting offline sync');
    
    const pendingTxs = await offlineDB.getAllFromIndex(
      'transactions',
      'status',
      'pending'
    );

    if (pendingTxs.length === 0) {
      console.log('[v0] No pending transactions to sync');
      return { synced: 0, failed: 0 };
    }

    const results = { synced: 0, failed: 0 };
    const token = getAuthToken();

    for (const tx of pendingTxs) {
      try {
        await this.syncTransaction(tx, token);
        results.synced++;
      } catch (error) {
        console.error('[v0] Failed to sync transaction:', tx.id, error);
        results.failed++;
        
        // Update transaction with error
        await offlineDB.put('transactions', {
          ...tx,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          retries: tx.retries + 1,
        });
      }
    }

    return results;
  }

  private async syncTransaction(tx: any, token: string) {
    console.log('[v0] Syncing transaction:', tx.id);

    // Mark as syncing
    await offlineDB.put('transactions', {
      ...tx,
      status: 'syncing',
    });

    // Send to server
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(tx.data),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const { id: serverId } = await response.json();

    // Update with server ID
    await offlineDB.put('transactions', {
      ...tx,
      id: serverId,
      status: 'synced',
      syncedAt: Date.now(),
    });

    console.log('[v0] Transaction synced:', serverId);
  }

  async handleSyncConflict(localTx: any, serverTx: any) {
    // Implement conflict resolution strategy
    // Options: server wins, local wins, merge, ask user

    const strategy = 'server-wins'; // Default strategy

    if (strategy === 'server-wins') {
      // Update local transaction with server data
      await offlineDB.put('transactions', {
        ...localTx,
        data: serverTx,
        status: 'synced',
      });
    } else if (strategy === 'local-wins') {
      // Keep local transaction as-is
      await offlineDB.put('transactions', {
        ...localTx,
        status: 'synced',
      });
    } else if (strategy === 'merge') {
      // Merge local and server changes
      const merged = this.mergeTransactions(localTx.data, serverTx);
      await offlineDB.put('transactions', {
        ...localTx,
        data: merged,
        status: 'synced',
      });
    }
  }

  private mergeTransactions(local: any, server: any) {
    // Custom merge logic for your business domain
    return {
      ...server,
      items: [...new Map(
        [...(server.items || []), ...(local.items || [])].map(item => [item.productId, item])
      ).values()],
    };
  }
}

export const offlineSyncService = new OfflineSyncService();
```

### Sync Hook

```typescript
// frontend/hooks/useSyncOffline.ts
import { useState, useCallback, useEffect } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { offlineSyncService } from '@/services/offline-sync-service';

export function useSyncOffline() {
  const { isOnline } = useNetworkStatus();
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  const performSync = useCallback(async () => {
    if (!isOnline) {
      setSyncMessage('Device is offline');
      return;
    }

    setSyncing(true);
    setSyncStatus('syncing');
    setSyncMessage('Syncing transactions...');

    try {
      const results = await offlineSyncService.syncPendingTransactions();
      
      setSyncStatus('success');
      setSyncMessage(`Synced ${results.synced} transaction(s)`);
      
      console.log('[v0] Sync complete:', results);
    } catch (error) {
      setSyncStatus('error');
      setSyncMessage(error instanceof Error ? error.message : 'Sync failed');
      console.error('[v0] Sync error:', error);
    } finally {
      setSyncing(false);
    }
  }, [isOnline]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && syncStatus !== 'syncing') {
      console.log('[v0] Device came online, starting sync');
      performSync();
    }
  }, [isOnline, performSync, syncStatus]);

  return {
    performSync,
    syncing,
    syncStatus,
    syncMessage,
  };
}
```

## Handling Offline Data Conflicts

### Conflict Resolution Strategy

```typescript
// frontend/lib/conflict-resolution.ts

export enum ConflictResolutionStrategy {
  SERVER_WINS = 'server-wins',
  LOCAL_WINS = 'local-wins',
  MERGE = 'merge',
  ASK_USER = 'ask-user',
}

export interface ConflictData {
  localVersion: any;
  serverVersion: any;
  lastModified: {
    local: number;
    server: number;
  };
}

export function resolveConflict(
  data: ConflictData,
  strategy: ConflictResolutionStrategy
): any {
  switch (strategy) {
    case ConflictResolutionStrategy.SERVER_WINS:
      return data.serverVersion;

    case ConflictResolutionStrategy.LOCAL_WINS:
      return data.localVersion;

    case ConflictResolutionStrategy.MERGE:
      return mergeVersions(data.localVersion, data.serverVersion);

    case ConflictResolutionStrategy.ASK_USER:
      // Show UI for user to choose
      return null;

    default:
      return data.serverVersion;
  }
}

function mergeVersions(local: any, server: any): any {
  // Three-way merge logic
  // For transactions: merge items arrays, keep latest prices
  
  if (local.type === 'transaction' && server.type === 'transaction') {
    const mergedItems = mergeArrays(local.items, server.items, 'productId');
    
    return {
      ...server,
      items: mergedItems,
      metadata: {
        ...server.metadata,
        mergedAt: Date.now(),
      },
    };
  }

  return server; // Fallback
}

function mergeArrays<T extends { [key: string]: any }>(
  local: T[],
  server: T[],
  keyField: string
): T[] {
  const map = new Map<string, T>();

  // Add server items first (server wins for duplicates)
  server.forEach(item => {
    map.set(item[keyField], item);
  });

  // Add local items that don't exist in server
  local.forEach(item => {
    if (!map.has(item[keyField])) {
      map.set(item[keyField], item);
    }
  });

  return Array.from(map.values());
}
```

### Conflict Detection UI Component

```typescript
// frontend/components/ConflictResolver.tsx
import React, { useState } from 'react';
import { resolveConflict, ConflictResolutionStrategy } from '@/lib/conflict-resolution';

export function ConflictResolver({
  localData,
  serverData,
  onResolve,
}: {
  localData: any;
  serverData: any;
  onResolve: (resolved: any) => void;
}) {
  const [strategy, setStrategy] = useState<ConflictResolutionStrategy>(
    ConflictResolutionStrategy.SERVER_WINS
  );

  const handleResolve = () => {
    const resolved = resolveConflict(
      {
        localVersion: localData,
        serverVersion: serverData,
        lastModified: {
          local: localData.updatedAt,
          server: serverData.updatedAt,
        },
      },
      strategy
    );

    onResolve(resolved);
  };

  return (
    <div className="conflict-resolver">
      <h3>Conflict Detected</h3>
      <p>Your changes conflict with server data. Choose how to resolve:</p>

      <div className="options">
        <label>
          <input
            type="radio"
            value={ConflictResolutionStrategy.SERVER_WINS}
            checked={strategy === ConflictResolutionStrategy.SERVER_WINS}
            onChange={(e) => setStrategy(e.target.value as ConflictResolutionStrategy)}
          />
          Keep Server Version
        </label>

        <label>
          <input
            type="radio"
            value={ConflictResolutionStrategy.LOCAL_WINS}
            checked={strategy === ConflictResolutionStrategy.LOCAL_WINS}
            onChange={(e) => setStrategy(e.target.value as ConflictResolutionStrategy)}
          />
          Keep Your Changes
        </label>

        <label>
          <input
            type="radio"
            value={ConflictResolutionStrategy.MERGE}
            checked={strategy === ConflictResolutionStrategy.MERGE}
            onChange={(e) => setStrategy(e.target.value as ConflictResolutionStrategy)}
          />
          Merge Both Versions
        </label>
      </div>

      <button onClick={handleResolve}>Resolve Conflict</button>
    </div>
  );
}
```

## Service Worker for Sync

### Register Service Worker

```typescript
// frontend/lib/register-service-worker.ts
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      
      console.log('[v0] Service Worker registered:', registration);
      
      // Listen for messages from SW
      navigator.serviceWorker.onmessage = (event) => {
        if (event.data.type === 'OFFLINE_SYNC_COMPLETE') {
          console.log('[v0] Offline sync completed in SW');
          // Trigger UI refresh
        }
      };
      
      return registration;
    } catch (error) {
      console.error('[v0] Service Worker registration failed:', error);
    }
  }
}
```

### Service Worker Implementation

```javascript
// public/sw.js
const CACHE_NAME = 'cms3-offline-v1';
const SYNC_TAG = 'offline-sync';

self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(clients.claim());
});

// Background Sync API
self.addEventListener('sync', async (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  try {
    console.log('[SW] Performing background sync');
    
    const db = await openDB('cms3-offline');
    const pendingTxs = await db.getAllFromIndex(
      'transactions',
      'status',
      'pending'
    );

    for (const tx of pendingTxs) {
      try {
        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tx.data),
        });

        if (response.ok) {
          await db.put('transactions', {
            ...tx,
            status: 'synced',
            syncedAt: Date.now(),
          });
        }
      } catch (error) {
        console.error('[SW] Failed to sync:', error);
      }
    }

    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'OFFLINE_SYNC_COMPLETE',
      });
    });
  } catch (error) {
    console.error('[SW] Sync error:', error);
  }
}
```

## Offline Transaction Testing

```typescript
// frontend/__tests__/offline-transactions.test.ts
import { renderHook, act } from '@testing-library/react';
import { useOfflineTransaction } from '@/hooks/useOfflineTransaction';

describe('Offline Transactions', () => {
  it('should create offline transaction', async () => {
    const { result } = renderHook(() => useOfflineTransaction());

    let transaction;
    await act(async () => {
      transaction = await result.current.createOfflineTransaction({
        type: 'sale',
        data: {
          items: [{ productId: '1', quantity: 2, price: 10 }],
          customerId: 'cust-123',
        },
      });
    });

    expect(transaction).toBeDefined();
    expect(transaction.status).toBe('pending');
  });

  it('should sync offline transactions when online', async () => {
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    const { result } = renderHook(() => useOfflineTransaction());

    // Create and sync
    await act(async () => {
      await result.current.createOfflineTransaction({
        type: 'sale',
        data: { items: [] },
      });
    });

    // Perform sync
    // ... (test sync logic)
  });
});
```

## Best Practices

1. **Always cache essential data**: Products, customers, configuration for offline access
2. **Use IndexedDB for large data**: Better than localStorage for offline queues
3. **Implement smart retry logic**: Exponential backoff for failed syncs
4. **Show offline indicators**: Clear UI feedback for offline status
5. **Validate before sync**: Ensure data quality before sending to server
6. **Handle quota exceeded**: IndexedDB storage can be limited
7. **Test offline thoroughly**: Use DevTools offline mode, slow 3G
8. **Monitor sync failures**: Log failures for debugging
9. **Implement conflict resolution**: Don't silently overwrite server data
10. **Educate users**: Explain offline limitations and how to recover

## Offline Transaction Checklist

- [ ] Setup IndexedDB for offline storage
- [ ] Implement offline transaction creation hook
- [ ] Create offline sync service with retry logic
- [ ] Implement conflict resolution strategy
- [ ] Register Service Worker for background sync
- [ ] Add offline status indicator to UI
- [ ] Test offline flow with DevTools offline mode
- [ ] Verify sync on reconnection
- [ ] Monitor and log sync failures
- [ ] Document offline behavior for users

