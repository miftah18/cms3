# API Client

Axios-based HTTP client dengan interceptors untuk JWT auth, auto-refresh, tenant context, dan offline detection.

## File

```
lib/api/
├── client.ts          ← Axios instance dengan semua interceptors
├── endpoints/
│   ├── auth.ts        ← login(), refreshToken(), setupPIN(), verifyPIN()
│   ├── flow.ts        ← getFlowSchema(), getUISchema()
│   ├── products.ts    ← listProducts(), getProduct(), deltaSync()
│   ├── stock.ts       ← getStock(), adjustStock()
│   ├── transactions.ts← createTransaction(), listTransactions(), refund()
│   ├── sync.ts        ← uploadDelta(), getSyncStatus(), resolveConflict()
│   ├── payments.ts    ← initiatePayment(), getPaymentStatus()
│   ├── reports.ts     ← getDailyReport(), getShiftReport(), exportReport()
│   └── notifications.ts ← listNotifications(), markRead()
└── types.ts           ← TypeScript interfaces semua response
```

## client.ts

```typescript
// lib/api/client.ts
import axios, { AxiosInstance, AxiosError } from 'axios'
import { useAuthStore } from '@/lib/store/authStore'
import { syncManager } from '@/lib/sync/syncManager'

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + '/api/v1',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request Interceptor ──────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const { accessToken, offlineToken, deviceId, branchId, isAuthenticated } = useAuthStore.getState()

  // Inject auth token
  if (isAuthenticated) {
    // Gunakan offline token jika offline, access token jika online
    const token = navigator.onLine ? accessToken : offlineToken
    if (token) config.headers.Authorization = `Bearer ${token}`
  }

  // Inject device context — wajib untuk POS endpoint
  if (deviceId) config.headers['X-Device-ID'] = deviceId
  if (branchId) config.headers['X-Branch-ID'] = branchId

  return config
})

// ── Response Interceptor ─────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response.data,  // Unwrap data envelope

  async (error: AxiosError) => {
    const original = error.config as any

    // Auto-refresh saat 401 (token expired)
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshed = await useAuthStore.getState().refreshAccessToken()
      if (refreshed) {
        return apiClient(original)   // Retry request dengan token baru
      }
      // Refresh gagal → logout
      useAuthStore.getState().logout()
      window.location.href = '/login'
      return
    }

    // Offline → queue untuk sync nanti
    if (!navigator.onLine) {
      // Hanya queue mutation, bukan GET
      if (original.method !== 'get') {
        await syncManager.queueFailedRequest(original)
      }
      return Promise.reject(new OfflineError('Sedang offline'))
    }

    return Promise.reject(normalizeError(error))
  }
)

// ── Error Normalization ───────────────────────────────────────
function normalizeError(error: AxiosError): AppError {
  const data = error.response?.data as any
  return {
    code:    data?.error?.code    || 'UNKNOWN_ERROR',
    message: data?.error?.message || 'Terjadi kesalahan',
    details: data?.error?.details || {},
    status:  error.response?.status || 0,
  }
}

export { apiClient }
```

## Endpoints

```typescript
// lib/api/endpoints/transactions.ts
import { apiClient } from '../client'
import { Transaction, CreateTransactionPayload } from '../types'

export const transactionApi = {
  create: (payload: CreateTransactionPayload): Promise<Transaction> =>
    apiClient.post('/transactions/', payload),

  list: (params?: {
    branch_id?: string
    date_from?: string
    date_to?: string
    status?: string
    page?: number
  }): Promise<PaginatedResponse<Transaction>> =>
    apiClient.get('/transactions/', { params }),

  get: (id: string): Promise<Transaction> =>
    apiClient.get(`/transactions/${id}/`),

  refund: (id: string, payload: { reason: string; refund_amount: number }) =>
    apiClient.post(`/transactions/${id}/refund/`, payload),
}


// lib/api/endpoints/products.ts
export const productApi = {
  list: (params?: { category_id?: string; search?: string; updated_after?: string; per_page?: number }) =>
    apiClient.get('/products/', { params }),

  deltaSync: (since: string) =>
    apiClient.get('/products/', { params: { updated_after: since, per_page: 500 } }),
}
```

## Types

```typescript
// lib/api/types.ts

export interface PaginatedResponse<T> {
  count:    number
  next:     string | null
  previous: string | null
  results:  T[]
}

export interface ApiError {
  code:    string
  message: string
  details: Record<string, any>
  status:  number
}

export interface Transaction {
  id:                 string
  local_id:           string
  transaction_number: string
  branch_id:          string
  cashier_id:         string
  status:             'pending' | 'completed' | 'cancelled' | 'refunded'
  subtotal:           number
  discount_amount:    number
  tax_amount:         number
  total_amount:       number
  payment_status:     'paid' | 'partial' | 'pending' | 'refunded'
  is_offline:         boolean
  items:              TransactionItem[]
  payments:           Payment[]
  created_at:         string
}

export interface FlowSchema {
  business_type:    string
  version:          string
  transaction_flow: FlowStep[]
  business_rules:   BusinessRules
  offline_strategy: OfflineStrategy
  cache_ttl_seconds: number
}

export interface FlowStep {
  step:         number
  key:          string
  label:        string
  component:    string
  props:        Record<string, any>
  validation?:  Record<string, any>
  on_complete:  string
  can_go_back:  boolean
}
```
