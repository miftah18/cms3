# Zustand Stores

State management global menggunakan Zustand dengan IndexedDB persistence untuk offline support.

## Stores

### authStore
```typescript
interface AuthStore {
  user:         User | null
  accessToken:  string | null
  refreshToken: string | null
  offlineToken: string | null
  deviceId:     string
  branchId:     string | null
  permissions:  string[]
  isAuthenticated: boolean
  login:  (credentials) => Promise<void>
  logout: () => void
  refreshAccessToken: () => Promise<boolean>
}
```

### flowStore
```typescript
interface FlowStore {
  schema:      FlowSchema | null
  currentStep: number
  stepData:    Record<string, any>   // Data per step
  cart:        CartItem[]
  nextStep:    () => void
  prevStep:    () => void
  setStepData: (key: string, data: any) => void
  resetFlow:   () => void
}
```

### syncStore
```typescript
interface SyncStore {
  isOnline:       boolean
  pendingCount:   number
  conflictCount:  number
  lastSyncAt:     Date | null
  isSyncing:      boolean
  incrementPending: () => void
  decrementPending: () => void
  setConflicts:   (count: number) => void
}
```

## Persistence

```typescript
// Store dengan IndexedDB persistence (survive refresh)
const useFlowStore = create(
  persist(
    (set, get) => ({ ... }),
    {
      name:    'flow-store',
      storage: createJSONStorage(() => indexedDBStorage),
    }
  )
)
```
