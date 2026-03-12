# Sync Manager

Mengelola siklus hidup offline queue — dari simpan ke IndexedDB hingga upload ke server.

## File

```
lib/sync/
├── syncManager.ts     ← Orchestrator utama
├── indexedDB.ts       ← IndexedDB operations (wrapper pakai 'idb' library)
├── checksum.ts        ← HMAC-SHA256 generator untuk payload
└── types.ts           ← TypeScript interfaces
```

## SyncManager

```typescript
// lib/sync/syncManager.ts
class SyncManager {
  private interval: NodeJS.Timer | null = null

  start() {
    // Monitor online/offline
    window.addEventListener('online',  () => this.triggerSync())
    window.addEventListener('offline', () => this.stopInterval())
    // Auto-sync setiap 30 detik saat online
    this.interval = setInterval(() => this.sync(), 30_000)
  }

  async queueItem(entityType: string, localId: string, payload: object) {
    const db = await openDB()
    await db.add('sync_queue', {
      id:         crypto.randomUUID(),
      entity_type: entityType,
      entity_id:  localId,
      payload,
      status:     'pending',
      created_at: new Date().toISOString()
    })
    syncStore.incrementPending()
  }

  async sync() {
    if (!navigator.onLine) return
    const queue = await this.getPendingItems()
    if (queue.length === 0) return

    const checksum = await generateChecksum({ queue, device_id: deviceId })
    const result = await apiClient.post('/sync/delta/', {
      device_id: deviceId,
      branch_id: branchId,
      checksum,
      queue
    })

    // Update status per item
    for (const id of result.synced_ids) {
      await this.markSynced(id)
    }
    for (const conflict of result.conflicts) {
      await this.markConflict(conflict.queue_item_id, conflict)
    }
  }
}

export const syncManager = new SyncManager()
```

## IndexedDB Stores

| Store | Key | Data |
|-------|-----|------|
| `sync_queue` | UUID | Pending sync items |
| `products` | product_id | Product cache |
| `stock` | product_id+branch_id | Stock cache |
| `flow_schema` | business_type | Flow schema JSON |
| `meta` | key | Metadata (last_sync timestamps, dll) |
