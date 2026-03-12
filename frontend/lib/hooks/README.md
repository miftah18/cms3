# Custom Hooks

React hooks yang mengabstraksikan logic berulang — terutama untuk offline data fetching, auth, dan sync status.

## Daftar Hooks

```
lib/hooks/
├── useOfflineData.ts      ← Fetch online → fallback ke IndexedDB saat offline
├── useFlowSchema.ts       ← Ambil dan cache flow schema
├── useAuth.ts             ← Auth state + helpers
├── useSyncStatus.ts       ← Status sync, pending count, conflicts
├── useLeaderElection.ts   ← Leader election antar device di cabang
├── usePermission.ts       ← Cek permission role-based
├── useMidtrans.ts         ← Load Snap.js dan handle Midtrans callbacks
└── useOnlineStatus.ts     ← Monitor online/offline dengan debounce
```

## useOfflineData

```typescript
// lib/hooks/useOfflineData.ts
import { useState, useEffect } from 'react'
import { useSyncStore } from '@/lib/store/syncStore'
import { openDB } from '@/lib/sync/indexedDB'

interface UseOfflineDataOptions<T> {
  onlineFetcher:  () => Promise<T[]>
  offlineStore:   string                          // IndexedDB store name
  offlineQuery?:  (store: IDBObjectStore) => Promise<T[]>
  cacheKey:       string                          // Key untuk update cache setelah fetch online
  ttlMs?:         number                          // Max age cache, default 8 jam
}

export function useOfflineData<T>({
  onlineFetcher,
  offlineStore,
  offlineQuery,
  cacheKey,
  ttlMs = 8 * 60 * 60 * 1000,
}: UseOfflineDataOptions<T>) {
  const { isOnline } = useSyncStore()
  const [data,       setData]      = useState<T[]>([])
  const [isLoading,  setIsLoading] = useState(true)
  const [fromCache,  setFromCache] = useState(false)
  const [error,      setError]     = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetch() {
      setIsLoading(true)
      setError(null)

      // Cek apakah cache masih valid
      const db       = await openDB()
      const meta     = await db.get('meta', `${cacheKey}:last_sync`)
      const cacheAge = meta ? Date.now() - new Date(meta).getTime() : Infinity
      const cacheOk  = cacheAge < ttlMs

      if (isOnline && !cacheOk) {
        // Network fetch + update cache
        try {
          const result = await onlineFetcher()
          if (cancelled) return
          setData(result)
          setFromCache(false)
          // Update IndexedDB cache
          const tx = db.transaction(offlineStore, 'readwrite')
          for (const item of result) await tx.store.put(item)
          await db.put('meta', new Date().toISOString(), `${cacheKey}:last_sync`)
        } catch (err) {
          // Network gagal → fallback ke cache
          const cached = await readFromCache(db, offlineStore, offlineQuery)
          if (!cancelled) { setData(cached); setFromCache(true) }
        }
      } else {
        // Offline atau cache masih valid → baca dari IndexedDB
        const cached = await readFromCache(db, offlineStore, offlineQuery)
        if (!cancelled) { setData(cached); setFromCache(true) }
      }

      if (!cancelled) setIsLoading(false)
    }

    fetch().catch(setError)
    return () => { cancelled = true }
  }, [isOnline, cacheKey])

  return { data, isLoading, fromCache, error, isEmpty: !isLoading && data.length === 0 }
}

// Penggunaan di ProductGrid:
// const { data: products, fromCache } = useOfflineData({
//   onlineFetcher: () => productApi.list({ per_page: 500 }),
//   offlineStore: 'products',
//   cacheKey: 'products',
// })
```

## useFlowSchema

```typescript
// lib/hooks/useFlowSchema.ts
export function useFlowSchema() {
  const { schema, setSchema } = useFlowStore()
  const { isOnline } = useSyncStore()

  useEffect(() => {
    async function load() {
      // Coba dari IndexedDB dulu (instant)
      const db     = await openDB()
      const cached = await db.get('flow_schema', 'current')
      if (cached) setSchema(cached)

      // Kalau online → refresh dari server
      if (isOnline) {
        try {
          const fresh = await apiClient.get('/flow/schema/')
          setSchema(fresh)
          await db.put('flow_schema', fresh, 'current')
        } catch { /* pakai cached yang ada */ }
      }
    }
    load()
  }, [isOnline])

  return schema
}
```

## usePermission

```typescript
// lib/hooks/usePermission.ts
import { useAuthStore } from '@/lib/store/authStore'

export function usePermission() {
  const { permissions, user } = useAuthStore()

  const can = (permission: string): boolean =>
    permissions.includes(permission)

  const canAny = (...perms: string[]): boolean =>
    perms.some(p => permissions.includes(p))

  const isRole = (role: string): boolean =>
    user?.role === role

  const isAtLeast = (role: string): boolean => {
    const hierarchy = ['public','customer','cashier','supervisor','branch_manager','tenant_admin','tenant_owner','saas_admin','super_admin']
    const userLevel = hierarchy.indexOf(user?.role || 'public')
    const reqLevel  = hierarchy.indexOf(role)
    return userLevel >= reqLevel
  }

  return { can, canAny, isRole, isAtLeast }
}

// Penggunaan:
// const { can, isAtLeast } = usePermission()
// if (!can('pos:write')) return <AccessDenied />
// if (!isAtLeast('branch_manager')) return <AccessDenied />
```

## useMidtrans

```typescript
// lib/hooks/useMidtrans.ts
export function useMidtrans() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Load Midtrans Snap.js
    const script   = document.createElement('script')
    script.src     = process.env.NEXT_PUBLIC_MIDTRANS_SNAP_URL!
    script.dataset.clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!
    script.onload  = () => setIsLoaded(true)
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [])

  const openSnap = useCallback((snapToken: string, callbacks: {
    onSuccess?: (result: any) => void
    onPending?: (result: any) => void
    onError?:   (result: any) => void
    onClose?:   () => void
  }) => {
    if (!isLoaded || !(window as any).snap) {
      console.error('Midtrans Snap belum dimuat')
      return
    }
    (window as any).snap.pay(snapToken, callbacks)
  }, [isLoaded])

  return { isLoaded, openSnap }
}
```

## useOnlineStatus

```typescript
// lib/hooks/useOnlineStatus.ts
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    let timeout: NodeJS.Timeout

    const setOnline  = () => { clearTimeout(timeout); timeout = setTimeout(() => setIsOnline(true),  500) }
    const setOffline = () => { clearTimeout(timeout); setIsOnline(false) }

    window.addEventListener('online',  setOnline)
    window.addEventListener('offline', setOffline)

    return () => {
      window.removeEventListener('online',  setOnline)
      window.removeEventListener('offline', setOffline)
    }
  }, [])

  return isOnline
}
```
