# Frontend Offline-First Implementation Guide

## Overview

This guide covers the complete offline-first implementation for the SaaS platform frontend, enabling users to work seamlessly even when connectivity is lost.

## Architecture

### Three-Layer Offline System

1. **Service Workers** - Network interception and caching
2. **IndexedDB** - Local persistent storage
3. **Sync Service** - Queue and synchronization logic

## Components & Services

### Offline Storage Service

IndexedDB-based storage for offline data:

```typescript
import { offlineStorage } from '@/lib/services/offlineStorage';

// Save item
await offlineStorage.save('products', {
  id: '123',
  type: 'product',
  data: productData,
  timestamp: Date.now(),
  synced: false,
});

// Get item
const item = await offlineStorage.get('products', '123');

// Get all items
const items = await offlineStorage.getAll('products');

// Get unsynced items
const unsyncedItems = await offlineStorage.getUnsyncedItems('products');
```

### Sync Service

Handles queueing and synchronization of offline operations:

```typescript
import { syncService } from '@/lib/services/syncService';

// Queue operation for sync
await syncService.queueOperation('create', 'products', {
  name: 'New Product',
  price: 99.99,
});

// Start auto sync (runs every 30 seconds)
syncService.startAutoSync();

// Manual sync
await syncService.syncAll();

// Get pending operations
const pending = await syncService.getPendingOperations();

// Clear queue
await syncService.clearQueue();
```

### useOfflineMode Hook

React hook for managing offline state:

```typescript
import { useOfflineMode } from '@/lib/hooks/useOfflineMode';

export function MyComponent() {
  const {
    isOnline,
    isSyncing,
    pendingOperations,
    manualSync,
    queueOperation,
    clearOfflineQueue,
  } = useOfflineMode();

  if (!isOnline) {
    return <div>You are offline. Changes will sync when online.</div>;
  }

  return <div>Online - {pendingOperations} pending changes</div>;
}
```

## Using Offline Features

### Store Data Offline

When creating/updating data while offline:

```typescript
const { queueOperation, isOnline } = useOfflineMode();

const handleSaveProduct = async (product) => {
  if (!isOnline) {
    // Queue for sync when offline
    await queueOperation('create', 'products', product);
    showNotification('Saved offline. Will sync when online.');
  } else {
    // Normal API call when online
    await apiClient.post('/api/v1/products/', product);
  }
};
```

### Display Offline Status

Use the OfflineIndicator component:

```typescript
import { OfflineIndicator } from '@/components/layout/OfflineIndicator';

export default function RootLayout({ children }) {
  return (
    <>
      {children}
      <OfflineIndicator />
    </>
  );
}
```

## Sync Strategies

### Automatic Sync

Syncing happens automatically when:
1. Device comes back online
2. Auto-sync interval triggers (every 30 seconds)
3. User manually clicks sync button

### Conflict Resolution

If a conflict occurs during sync:

1. **Last-Write-Wins** (Default)
   - Later timestamps override earlier ones
   - Simple but can lose data

2. **Server-Wins**
   - Server version always wins
   - Safe but loses offline changes

3. **Client-Wins**
   - Local changes override server
   - Risky but ensures offline work is preserved

4. **Merge**
   - Combine changes when possible
   - Most complex but best UX

5. **Manual Resolution**
   - Show user a dialog to choose
   - Best for critical data

Configure in sync service:

```typescript
class SyncService {
  private conflictResolution: 'last-write-wins' | 'server-wins' | 'client-wins' = 'last-write-wins';
}
```

## Storage Quota

IndexedDB has storage limits:

- **Desktop**: Typically 5-10GB per origin
- **Mobile**: Typically 50MB per origin
- **Exceeding quota** triggers QuotaExceededError

Handle quota errors:

```typescript
try {
  await offlineStorage.save('products', item);
} catch (err) {
  if (err.name === 'QuotaExceededError') {
    // Request persistent storage or clear old data
    await offlineStorage.clear('products');
  }
}
```

Request persistent storage:

```typescript
if (navigator.storage && navigator.storage.persist) {
  const persistent = await navigator.storage.persist();
  console.log(`Storage persisted: ${persistent}`);
}
```

## Service Worker

Enable PWA capabilities:

```typescript
import { registerServiceWorker } from '@/lib/services/serviceWorkerRegister';

useEffect(() => {
  registerServiceWorker();
}, []);
```

Service worker handles:
- Network request caching
- Offline page serving
- Background sync
- Push notifications

## Best Practices

### 1. Always Check Online Status

```typescript
const { isOnline } = useOfflineMode();

// Use isOnline before making API calls
if (isOnline) {
  await apiClient.post('/api/v1/products/', data);
}
```

### 2. Queue Operations When Offline

```typescript
const { queueOperation, isOnline } = useOfflineMode();

if (!isOnline) {
  await queueOperation('create', 'products', data);
} else {
  await apiClient.post('/api/v1/products/', data);
}
```

### 3. Provide User Feedback

```typescript
return (
  <>
    <OfflineIndicator />
    {pendingOperations > 0 && (
      <div>You have {pendingOperations} unsaved changes</div>
    )}
  </>
);
```

### 4. Clean Old Data Periodically

```typescript
const cleanupOldData = async () => {
  const items = await offlineStorage.getAll('products');
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  
  for (const item of items) {
    if (item.timestamp < oneWeekAgo && item.synced) {
      await offlineStorage.delete('products', item.id);
    }
  }
};
```

### 5. Handle Sync Failures Gracefully

```typescript
const { manualSync, isSyncing } = useOfflineMode();

const handleSync = async () => {
  try {
    await manualSync();
    showSuccessNotification('Changes synced successfully');
  } catch (error) {
    showErrorNotification('Sync failed. Will retry automatically.');
  }
};
```

## Testing Offline Mode

### Browser DevTools

1. Open DevTools (F12)
2. Go to Network tab
3. Check "Offline" checkbox
4. Interact with app - changes should queue
5. Uncheck "Offline" - changes should sync

### Programmatic Testing

```typescript
// Simulate going offline
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: false,
});

// Dispatch offline event
window.dispatchEvent(new Event('offline'));

// Simulate coming online
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

window.dispatchEvent(new Event('online'));
```

## Troubleshooting

### Data Not Syncing

1. Check `syncService.getPendingOperations()`
2. Verify network is actually online
3. Check backend API logs
4. Review sync service retry count

### IndexedDB Quota Exceeded

1. Clear old data with `offlineStorage.clear()`
2. Request persistent storage
3. Implement data cleanup schedule

### Service Worker Not Registering

1. Check HTTPS is enabled (required for PWA)
2. Verify `/service-worker.js` exists
3. Check browser console for errors
4. Clear service workers and refresh

## Performance Optimization

### 1. Batch Sync Operations

```typescript
const operations = await syncService.getPendingOperations();
const batches = [];

for (let i = 0; i < operations.length; i += 10) {
  batches.push(operations.slice(i, i + 10));
}

for (const batch of batches) {
  await Promise.all(batch.map(executeOperation));
}
```

### 2. Compress Data

```typescript
import { compress, decompress } from 'lz-string';

const compressed = compress(JSON.stringify(largeData));
await offlineStorage.save('products', {
  id: '123',
  data: compressed,
  compressed: true,
});
```

### 3. Implement Data Pagination

Only store recent data locally:

```typescript
const recentItems = await offlineStorage.getAll('products');
const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
const filtered = recentItems.filter(i => i.timestamp > thirtyDaysAgo);
```

## Security Considerations

### Encrypting Sensitive Data

```typescript
import { encrypt, decrypt } from 'crypto-js';

const encrypted = encrypt(sensitiveData, 'encryption-key');
await offlineStorage.save('users', {
  id: '123',
  data: encrypted,
  encrypted: true,
});
```

### Access Control

- Service workers run with limited privileges
- IndexedDB is origin-specific
- Always validate data on backend
- Never trust offline-submitted data blindly

## Migration Guide

### From Online-Only to Offline-First

1. **Step 1**: Add offline storage service
2. **Step 2**: Add sync service
3. **Step 3**: Add useOfflineMode hook
4. **Step 4**: Update components to check isOnline
5. **Step 5**: Queue operations when offline
6. **Step 6**: Add OfflineIndicator
7. **Step 7**: Register service worker

### Backward Compatibility

Ensure old users can still use the app:

```typescript
const { isOnline } = useOfflineMode();

if (!isOnline && !supportsIndexedDB) {
  return <div>Please check your internet connection</div>;
}
```

---

**Version**: 1.0
**Last Updated**: 2026-03-13
**Status**: Production Ready
