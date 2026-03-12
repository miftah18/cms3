# Custom Hooks Guide

All custom hooks used by components for data fetching, state management, and offline support.

## Table of Contents

1. [Data Fetching Hooks](#data-fetching-hooks)
2. [State Management Hooks](#state-management-hooks)
3. [Offline Hooks](#offline-hooks)
4. [Component Hooks](#component-hooks)
5. [Utility Hooks](#utility-hooks)
6. [Advanced Patterns](#advanced-patterns)

---

## Data Fetching Hooks

### useOfflineData

**Purpose:** Fetch data with automatic offline fallback and caching.

**Location:** `frontend/hooks/useOfflineData.ts`

**Signature:**
```typescript
function useOfflineData<T>(
  onlineQuery: () => Promise<T[]>,
  offlineQuery: () => Promise<T[]>,
  cacheKey: string,
  options?: {
    staleTime?: number              // Cache valid duration (ms)
    syncInterval?: number            // Auto-sync interval (ms)
    retryOnError?: boolean           // Auto-retry failed requests
    retryDelay?: number              // Delay before retry (ms)
  }
): {
  data: T[]                          // Fetched or cached data
  isLoading: boolean                 // Fetching in progress
  isOffline: boolean                 // Current offline status
  fromCache: boolean                 // Data from cache indicator
  error?: Error                      // Error (if any)
  refetch: () => Promise<void>       // Manual refetch
}
```

**Usage:**
```typescript
export function ProductsPage() {
  const { data: products, isLoading, fromCache, error } = useOfflineData(
    // Online: Fetch from API
    () => api.products.list({ tenantId, branchId }),
    
    // Offline: Fetch from IndexedDB cache
    () => db.products.all(),
    
    // Cache key for IndexedDB
    'products_list',
    
    // Options
    {
      staleTime: 3600000,        // 1 hour - when to re-fetch
      syncInterval: 600000,      // 10 minutes - periodic sync
      retryOnError: true,
      retryDelay: 3000
    }
  )

  if (isLoading && products.length === 0) {
    return <LoadingSkeleton />
  }

  return (
    <div>
      {fromCache && <CacheWarning />}
      {error && <ErrorAlert error={error} />}
      <ProductList products={products} />
    </div>
  )
}
```

**Behavior:**

1. **First load (online):**
   - Calls `onlineQuery()`
   - Saves result to IndexedDB with key `cacheKey`
   - Returns data

2. **First load (offline):**
   - `onlineQuery()` fails
   - Falls back to `offlineQuery()`
   - Returns cached data, `fromCache=true`

3. **Subsequent loads:**
   - Returns cached data immediately
   - If `staleTime` elapsed, fetches fresh data in background
   - Updates UI when fresh data arrives

4. **Manual refetch:**
   ```typescript
   const { refetch } = useOfflineData(...)
   const handleRefresh = () => await refetch()
   ```

---

### useSWR (External - SWR library)

**Purpose:** Data fetching with caching and revalidation (from swr package).

**Signature:**
```typescript
function useSWR<T>(
  key: string | null,                // Cache key (null = disabled)
  fetcher: (key: string) => Promise<T>,
  options?: {
    revalidateOnFocus?: boolean      // Revalidate when window focused
    revalidateOnReconnect?: boolean  // Revalidate when online
    dedupingInterval?: number        // Merge requests in interval (ms)
    focusThrottleInterval?: number   // Focus revalidation cooldown (ms)
  }
): {
  data: T
  isLoading: boolean
  error: Error
  mutate: (data?: T) => Promise<T>   // Update cached data
}
```

**Usage:**
```typescript
// Simple fetch
const { data: products, error } = useSWR(
  '/api/products',
  fetcher
)

// With key parameters
const { data: orders } = useSWR(
  `/api/orders?date=${selectedDate}`,
  fetcher
)

// Conditional fetch (key = null to disable)
const { data } = useSWR(
  isOffline ? null : '/api/products',
  fetcher
)

// Manual mutation
const { mutate } = useSWR('/api/products', fetcher)
const handleAddProduct = async (product) => {
  await api.products.create(product)
  // Revalidate cache
  mutate()
}
```

---

### useQuery (React Query - Alternative)

**Purpose:** Advanced data fetching with query deduplication and background updates.

Used for complex data requirements with multiple cache strategies.

---

## State Management Hooks

### useSyncStore

**Purpose:** Global sync state and offline queue management.

**Location:** `frontend/stores/syncStore.ts`

**Signature:**
```typescript
function useSyncStore(): {
  // Connectivity status
  isOnline: boolean                  // Current online status
  wasEverOnline: boolean             // Ever connected in session
  
  // Sync state
  isSyncing: boolean                 // Sync in progress
  syncStatus: 'idle' | 'syncing' | 'success' | 'error'
  lastSyncTime?: Date                // When last synced
  syncError?: Error                  // Last sync error
  
  // Queue management
  queuedOperations: Operation[]      // Pending operations
  queueSize: number                  // Number of queued ops
  
  // Actions
  triggerSync: () => Promise<void>   // Manual sync
  addToQueue: (op: Operation) => void
  removeFromQueue: (opId: string) => void
  clearQueue: () => void
  
  // Subscriptions
  subscribe: (callback: () => void) => Unsubscribe
}
```

**Usage:**
```typescript
export function Header() {
  const { isOnline, isSyncing, queueSize } = useSyncStore()

  return (
    <header>
      {!isOnline && (
        <OfflineBanner
          queuedItems={queueSize}
          isSyncing={isSyncing}
        />
      )}
    </header>
  )
}
```

**Queue Operations:**
```typescript
export function OrderCheckout() {
  const { isOnline, addToQueue } = useSyncStore()

  const handleSubmitOrder = async (order) => {
    if (isOnline) {
      // Submit immediately
      await api.orders.create(order)
    } else {
      // Queue for sync
      addToQueue({
        id: `order-${Date.now()}`,
        type: 'create',
        entity_type: 'order',
        data: order,
        timestamp: new Date(),
        endpoint: '/api/orders/'
      })
    }
  }

  return <OrderConfirm onComplete={handleSubmitOrder} />
}
```

---

### useAuth

**Purpose:** Authentication state and user management.

**Signature:**
```typescript
function useAuth(): {
  // User state
  user?: User                        // Current user
  isAuthenticated: boolean           // Is logged in
  isLoading: boolean                 // Auth check in progress
  
  // Tokens
  accessToken?: string               // JWT access token
  offlineToken?: string              // Offline token
  
  // User role & permissions
  role: UserRole                     // 'admin', 'manager', 'staff', etc.
  permissions: string[]              // User permissions
  canAccess: (resource: string) => boolean
  
  // Actions
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  
  // Device management
  activeDevices: Device[]
  revokeDevice: (deviceId: string) => Promise<void>
  revokeAllDevices: () => Promise<void>
}
```

**Usage:**
```typescript
export function ProtectedPage() {
  const { isAuthenticated, user, canAccess } = useAuth()

  if (!isAuthenticated) {
    return <Redirect to="/login" />
  }

  if (!canAccess('products.view')) {
    return <AccessDenied />
  }

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
    </div>
  )
}
```

---

### useCart

**Purpose:** Shopping cart state management.

**Signature:**
```typescript
function useCart(): {
  items: CartItem[]                  // Items in cart
  subtotal: number                   // Sum of item prices
  tax: number                        // Calculated tax
  discount: number                   // Applied discount
  total: number                      // Final total
  itemCount: number                  // Number of items
  
  // Actions
  addItem: (product: Product, quantity?: number) => void
  removeItem: (itemId: string) => void
  updateItemQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  
  // Discounts
  applyPromoCode: (code: string) => Promise<DiscountResult>
  removePromoCode: () => void
  
  // Persistence
  save: () => Promise<void>          // Save to IndexedDB
  restore: () => Promise<void>       // Load from IndexedDB
}
```

**Usage:**
```typescript
export function ShoppingFlow() {
  const { items, addItem, total } = useCart()

  const handleAddProduct = (product: Product) => {
    addItem(product, 1)
  }

  return (
    <>
      <ProductGrid onProductSelect={handleAddProduct} />
      <CartSummary
        items={items}
        total={total}
        onComplete={handleCheckout}
      />
    </>
  )
}
```

---

## Offline Hooks

### useOfflineQueue

**Purpose:** Manage operations queued for offline sync.

**Signature:**
```typescript
function useOfflineQueue(): {
  // Queue state
  operations: Operation[]            // Queued operations
  count: number                      // Total operations
  countByType: Record<string, number>
  
  // Status
  canSync: boolean                   // Ready to sync
  lastError?: Error
  
  // Queue management
  addOperation: (op: Operation) => void
  removeOperation: (id: string) => void
  clearQueue: () => void
  getOperation: (id: string) => Operation | undefined
  
  // Sync
  beginSync: () => void
  endSync: () => void
  markOperationSynced: (id: string) => void
  markOperationFailed: (id: string, error: Error) => void
}
```

---

### useOfflineStrategy

**Purpose:** Get offline strategy configuration for business type.

**Signature:**
```typescript
function useOfflineStrategy(): {
  strategy: OfflineStrategy          // Selected strategy config
  canOperateOffline: (endpoint: string) => boolean
  getAllowedEndpoints: () => string[]
  getAllowedScopes: () => string[]
  requiresSync: boolean              // Must sync on reconnect
  maxQueueSize: number               // Max operations to queue
}
```

**Usage:**
```typescript
export function PaymentProcessor() {
  const { canOperateOffline } = useOfflineStrategy()

  const handlePayment = async (method: string) => {
    if (method === 'card' && !canOperateOffline('/api/payments/')) {
      showError('Card payments require internet connection')
      return
    }

    // Process payment
  }

  return <PaymentMethod onComplete={handlePayment} />
}
```

---

### useOfflineNotification

**Purpose:** Show offline status notifications.

**Signature:**
```typescript
function useOfflineNotification(): {
  showOfflineWarning: (message?: string) => void
  showSyncStatus: (status: 'syncing' | 'synced' | 'error') => void
  showQueueAlert: (count: number) => void
  dismiss: (id?: string) => void
}
```

---

## Component Hooks

### useComponentRegistry

**Purpose:** Access and resolve components by code.

**Signature:**
```typescript
function useComponentRegistry(): {
  // Component resolution
  resolveComponent: (code: string) => React.ComponentType<any> | null
  isComponentAvailable: (code: string) => boolean
  getComponentProps: (code: string) => PropTypes | null
  
  // Component info
  listComponents: () => ComponentInfo[]
  getComponent: (code: string) => ComponentInfo | undefined
  getComponentsByCategory: (category: string) => ComponentInfo[]
  getComponentsByBusinessType: (type: string) => ComponentInfo[]
  
  // Registration
  registerComponent: (code: string, component: React.ComponentType) => void
}
```

**Usage:**
```typescript
// Server-driven UI: Render from config
export function FlowRenderer({ flowSteps }: Props) {
  const { resolveComponent } = useComponentRegistry()

  return flowSteps.map((step) => {
    const Component = resolveComponent(step.component_code)
    return Component ? <Component key={step.id} {...step.props} /> : null
  })
}
```

---

### useFlow

**Purpose:** Execute flows defined in server configuration.

**Signature:**
```typescript
function useFlow(flowKey: string): {
  // Flow state
  currentStep: number
  isComplete: boolean
  steps: FlowStep[]
  
  // Navigation
  nextStep: () => Promise<boolean>   // Returns success
  previousStep: () => void
  goToStep: (stepNumber: number) => void
  skipStep: (stepNumber: number) => void
  
  // Data
  flowData: Record<string, any>      // Accumulated data
  setStepData: (data: any) => void
  
  // Actions
  reset: () => void
  complete: () => Promise<any>       // Returns final result
}
```

**Usage:**
```typescript
export function OrderFlow() {
  const { 
    currentStep, 
    steps, 
    nextStep, 
    previousStep,
    flowData,
    complete 
  } = useFlow('order_checkout')

  const handleStepComplete = async (data) => {
    setStepData(data)
    const canProceed = await nextStep()
    if (!canProceed) {
      showError('Step validation failed')
    }
  }

  return (
    <StepWizard
      steps={steps}
      currentStep={currentStep}
      onComplete={complete}
    >
      <CurrentStepComponent
        onNext={handleStepComplete}
        onBack={previousStep}
      />
    </StepWizard>
  )
}
```

---

## Utility Hooks

### useAsync

**Purpose:** Handle async operations with loading and error states.

**Signature:**
```typescript
function useAsync<T, E = Error>(
  asyncFunction: () => Promise<T>,
  immediate?: boolean
): {
  status: 'idle' | 'pending' | 'success' | 'error'
  data: T | null
  error: E | null
  isLoading: boolean
  execute: () => Promise<T>
  reset: () => void
}
```

**Usage:**
```typescript
export function DataLoader() {
  const { data, isLoading, error, execute } = useAsync(
    () => api.data.fetch(),
    true  // Execute immediately
  )

  return (
    <div>
      {isLoading && <Spinner />}
      {error && <ErrorAlert error={error} />}
      {data && <DataDisplay data={data} />}
      <button onClick={execute}>Refresh</button>
    </div>
  )
}
```

---

### useDebounce

**Purpose:** Debounce value changes (e.g., search input).

**Signature:**
```typescript
function useDebounce<T>(value: T, delay: number): T
```

**Usage:**
```typescript
export function ProductSearch() {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const { data: results } = useSWR(
    debouncedSearchTerm ? `/api/products?q=${debouncedSearchTerm}` : null,
    fetcher
  )

  return (
    <>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search products..."
      />
      {results && <ProductList products={results} />}
    </>
  )
}
```

---

### useLocalStorage

**Purpose:** Persist state to browser localStorage.

**Signature:**
```typescript
function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void]
```

**Usage:**
```typescript
export function UserPreferences() {
  const [darkMode, setDarkMode] = useLocalStorage('darkMode', false)

  return (
    <button onClick={() => setDarkMode(!darkMode)}>
      {darkMode ? 'Light Mode' : 'Dark Mode'}
    </button>
  )
}
```

---

### useIndexedDB

**Purpose:** Access IndexedDB for offline data storage.

**Signature:**
```typescript
function useIndexedDB<T>(
  storeName: string,
  key?: string | null
): {
  data: T | null
  isLoading: boolean
  error: Error | null
  put: (data: T) => Promise<void>
  get: (key: string) => Promise<T | undefined>
  getAll: () => Promise<T[]>
  delete: (key: string) => Promise<void>
  clear: () => Promise<void>
}
```

---

## Advanced Patterns

### Combining Multiple Hooks

```typescript
export function SmartProductPage() {
  // Data fetching with offline fallback
  const {
    data: products,
    isLoading,
    fromCache
  } = useOfflineData(
    () => api.products.list(),
    () => db.products.all(),
    'products'
  )

  // Global sync state
  const { isOnline, isSyncing } = useSyncStore()

  // User authentication
  const { user, canAccess } = useAuth()

  // Shopping cart
  const { addItem, total } = useCart()

  if (!canAccess('products.view')) {
    return <AccessDenied />
  }

  return (
    <PageLayout
      title="Products"
      isLoading={isLoading && !fromCache}
    >
      {fromCache && (
        <CacheWarning message="Showing cached products" />
      )}
      {!isOnline && <OfflineBanner />}

      <ProductGrid
        products={products}
        onProductSelect={(p) => addItem(p)}
        isOffline={!isOnline}
      />

      <CartSummary
        onComplete={handleCheckout}
        total={total}
      />
    </PageLayout>
  )
}
```

---

### Creating Custom Hooks

```typescript
// Custom hook that combines useOfflineData + useAuth
export function useProtectedData<T>(
  endpoint: string,
  dbQuery: () => Promise<T[]>
) {
  const { canAccess } = useAuth()
  const { data, ...rest } = useOfflineData(
    () => api.get(endpoint),
    dbQuery,
    endpoint
  )

  if (!canAccess(endpoint)) {
    return { data: [], ...rest, error: new Error('Access denied') }
  }

  return { data, ...rest }
}

// Usage
const { data } = useProtectedData(
  '/api/sensitive-data',
  () => db.sensitiveData.all()
)
```

---

### Error Recovery Pattern

```typescript
export function useErrorRecovery<T>(
  asyncFunction: () => Promise<T>,
  maxRetries: number = 3
) {
  const [retryCount, setRetryCount] = useState(0)
  const { execute, ...rest } = useAsync(asyncFunction, false)

  const executeWithRetry = useCallback(async () => {
    try {
      return await execute()
    } catch (error) {
      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
        return executeWithRetry()
      }
      throw error
    }
  }, [execute, retryCount, maxRetries])

  return { ...rest, execute: executeWithRetry }
}
```

---

## Best Practices

1. **Always check null/undefined:**
   ```typescript
   const { data } = useOfflineData(...)
   // Safe: data is [] if not loaded
   data?.forEach(...)
   ```

2. **Handle loading states:**
   ```typescript
   const { isLoading, data } = useAsync(...)
   if (isLoading) return <Loader />
   if (!data) return <EmptyState />
   ```

3. **Clean up subscriptions:**
   ```typescript
   const { subscribe } = useSyncStore()
   useEffect(() => {
     const unsubscribe = subscribe(() => {
       console.log('State changed')
     })
     return unsubscribe  // Cleanup
   }, [])
   ```

4. **Avoid calling hooks conditionally:**
   ```typescript
   // ❌ Wrong
   if (condition) {
     const data = useOfflineData(...)
   }

   // ✅ Right
   const data = useOfflineData(...)
   if (condition) {
     // Use data
   }
   ```

---

## Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react-hooks'

describe('useOfflineData', () => {
  it('returns cached data when offline', async () => {
    const { result } = renderHook(() =>
      useOfflineData(
        () => Promise.reject('offline'),
        () => Promise.resolve([{ id: 1 }]),
        'test'
      )
    )

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.fromCache).toBe(true)
    expect(result.current.data).toEqual([{ id: 1 }])
  })
})
```

---

## Performance Tips

1. Use SWR's deduplication to prevent duplicate requests
2. Set appropriate `staleTime` for cache validity
3. Use `useCallback` for component callbacks passed to hooks
4. Lazy-load heavy data with `useSWR(condition ? key : null)`
5. Implement pagination for large datasets

---

## Next Steps

- [Component Registry](./REGISTRY.md)
- [BaseComponentProps](./base-props.md)
- [API Integration Guide](../guides/api-integration.md)
- [Testing Components](../testing/components.md)
