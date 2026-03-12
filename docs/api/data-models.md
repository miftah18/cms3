# Data Models & Schemas

Complete TypeScript interfaces and data structures used throughout the platform.

## Core Models

### User

```typescript
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar_url?: string
  phone?: string
  is_active: boolean
  created_at: string                 // ISO 8601 timestamp
  updated_at: string
}

export enum UserRole {
  ADMIN = 'admin'                    // Full system access
  MANAGER = 'manager'                // Tenant-level management
  STAFF = 'staff'                    // Daily operations
  SUPERVISOR = 'supervisor'          // Staff oversight
  GUEST = 'guest'                    // Limited access
}
```

### Tenant

```typescript
export interface Tenant {
  id: string
  name: string
  slug: string                        // URL-friendly name
  industry: BusinessType
  is_active: boolean
  owner_id: string                    // User.id of owner
  settings: TenantSettings
  created_at: string
  updated_at: string
}

export enum BusinessType {
  COFFEE_SHOP = 'coffee_shop'
  RETAIL = 'retail'
  SALON = 'salon'
  RESTORAN = 'restoran'
  LAUNDRY = 'laundry'
  KLINIK = 'klinik'
  DEALER = 'dealer'
  HOTEL = 'hotel'
}

export interface TenantSettings {
  currency: string                    // 'IDR', 'USD', etc.
  timezone: string                    // 'Asia/Jakarta'
  locale: string                      // 'id-ID'
  tax_rate: number                    // Percentage (0-100)
  service_charge_rate?: number
  offline_enabled: boolean
  offline_strategy: 'full' | 'limited' | 'online_only'
  max_queue_size: number
}
```

### Branch

```typescript
export interface Branch {
  id: string
  tenant_id: string
  name: string
  location: Location
  is_active: boolean
  manager_id?: string
  created_at: string
  updated_at: string
}

export interface Location {
  address: string
  city: string
  province: string
  postal_code: string
  latitude: number
  longitude: number
  phone?: string
}
```

---

## Transaction Models

### Transaction

```typescript
export interface Transaction {
  id: string
  tenant_id: string
  branch_id: string
  transaction_number: string          // User-facing receipt number
  
  // Customer info
  customer_id?: string
  customer_name: string
  customer_phone?: string
  
  // Items
  items: TransactionItem[]
  
  // Pricing
  subtotal: number                    // Sum of item prices
  tax: number                         // Calculated tax
  discount: number                    // Applied discount
  service_charge: number
  total: number                       // Final amount
  
  // Payment
  payment_method: PaymentMethod
  payment_reference?: string          // e.g., transaction ID from gateway
  is_paid: boolean
  
  // Status
  status: TransactionStatus           // draft, processing, completed, voided
  
  // Notes
  notes?: string
  
  // Metadata
  created_by: string                  // User.id
  created_at: string
  completed_at?: string
  voided_at?: string
  voided_reason?: string
}

export enum TransactionStatus {
  DRAFT = 'draft'                    // Not finalized
  PROCESSING = 'processing'           // Payment in progress
  COMPLETED = 'completed'             // Finalized
  VOIDED = 'voided'                  // Cancelled
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'e_wallet' | 
                          'cheque' | 'financing' | 'invoice'
```

### TransactionItem

```typescript
export interface TransactionItem {
  id: string
  transaction_id: string
  product_id: string
  product_code: string
  product_name: string
  quantity: number
  unit_price: number                 // Price at time of transaction
  total_price: number                // quantity × unit_price
  discount?: number
  notes?: string
  modifiers?: ItemModifier[]         // e.g., size, temperature, toppings
}

export interface ItemModifier {
  name: string                        // e.g., 'Size', 'Temperature'
  value: string                       // e.g., 'Large', 'Hot'
  additional_price?: number
}
```

---

## Product Models

### Product

```typescript
export interface Product {
  id: string
  tenant_id: string
  branch_id?: string                  // null = tenant-wide
  code: string                        // SKU/barcode
  name: string
  description?: string
  category_id: string
  
  // Pricing
  cost_price: number                  // Buying cost
  selling_price: number
  min_price?: number                  // Minimum allowed discount price
  
  // Stock
  current_stock: number
  minimum_stock: number
  reorder_point: number
  
  // Classification
  is_active: boolean
  is_taxable: boolean
  requires_serial_number: boolean
  
  // Media
  image_url?: string
  
  // Metadata
  created_at: string
  updated_at: string
}

export interface ProductCategory {
  id: string
  tenant_id: string
  name: string
  description?: string
  image_url?: string
  display_order: number
  is_active: boolean
}
```

---

## Authentication Models

### TokenResponse

```typescript
export interface TokenResponse {
  access_token: string               // JWT for authenticated requests
  refresh_token: string              // JWT for token refresh
  offline_token: string              // JWT for offline operations
  
  expires_in: number                 // Access token TTL (seconds)
  refresh_expires_in: number
  offline_expires_in: number
  
  token_type: 'Bearer'
  user: UserInfo
}

export interface UserInfo {
  id: string
  email: string
  name: string
}

export interface TokenClaims {
  sub: string                        // Subject (user_id)
  user_id: string
  tenant_id: string
  device_id: string
  
  iat: number                        // Issued at (timestamp)
  exp: number                        // Expiration (timestamp)
  jti: string                        // JWT ID (unique identifier)
  
  token_type: 'access' | 'refresh' | 'offline'
  permissions: string[]              // User permissions/scopes
  allowed_scopes: string[]           // For offline token
}
```

### Session

```typescript
export interface Session {
  user_id: string
  device_id: string
  device_type: 'web' | 'mobile-ios' | 'mobile-android' | 'desktop'
  device_name?: string
  
  ip_address?: string
  user_agent?: string
  
  created_at: string
  last_activity_at: string
  expires_at: string
  
  is_active: boolean
}
```

---

## Offline Models

### OfflineOperation

```typescript
export interface OfflineOperation {
  id: string                         // Unique ID for deduplication
  type: 'create' | 'update' | 'delete'
  entity_type: string                // e.g., 'transaction', 'product'
  entity_id: string
  
  endpoint: string                   // API endpoint path
  method: 'POST' | 'PUT' | 'DELETE'
  
  data: Record<string, any>          // Request body
  
  timestamp: string                  // When operation was queued
  priority: 'normal' | 'high'        // Processing priority
  
  retry_count: number
  last_error?: Error
  
  status: 'pending' | 'syncing' | 'synced' | 'failed'
}
```

### SyncConflict

```typescript
export interface SyncConflict {
  entity_type: string
  entity_id: string
  
  conflict_type: 'concurrent_modification' | 'delete_conflict' | 'version_mismatch'
  
  server_version: {
    version: number
    data: any
    modified_at: string
    modified_by?: string
  }
  
  offline_version: {
    version: number
    data: any
    modified_at: string
  }
  
  resolution_strategy: 'server_wins' | 'client_wins' | 'merge' | 'manual'
}
```

---

## Payment Models

### Payment

```typescript
export interface Payment {
  id: string
  transaction_id: string
  
  amount: number
  method: PaymentMethod
  reference: string                  // External transaction ID
  
  status: PaymentStatus
  
  // For card payments
  card_last_four?: string
  card_brand?: string
  
  // For transfers
  bank_name?: string
  account_number?: string
  
  created_at: string
  completed_at?: string
}

export enum PaymentStatus {
  PENDING = 'pending'
  PROCESSING = 'processing'
  COMPLETED = 'completed'
  FAILED = 'failed'
  REFUNDED = 'refunded'
}
```

### PaymentGatewayConfig

```typescript
export interface PaymentGatewayConfig {
  provider: 'midtrans' | 'stripe' | 'xendit'
  is_active: boolean
  
  // Credentials (encrypted in database)
  api_key: string
  secret_key: string
  
  // Settings
  sandbox_mode: boolean
  
  // Supported methods
  allowed_methods: PaymentMethod[]
  
  // Fee configuration
  processing_fee: {
    percentage: number               // 0-100
    fixed_amount?: number            // IDR
  }
}
```

---

## Report Models

### DailyReport

```typescript
export interface DailyReport {
  id: string
  tenant_id: string
  branch_id: string
  report_date: string                // YYYY-MM-DD
  
  // Transactions
  transaction_count: number
  total_amount: number
  
  // By payment method
  by_payment_method: Record<PaymentMethod, PaymentMethodStats>
  
  // By category
  by_category: Record<string, CategoryStats>
  
  // Hourly breakdown
  hourly_breakdown: Record<string, HourlyStats>
  
  created_at: string
}

export interface PaymentMethodStats {
  count: number
  amount: number
  percentage: number                 // % of total
}

export interface CategoryStats {
  product_count: number
  items_sold: number
  revenue: number
}

export interface HourlyStats {
  hour: number                       // 0-23
  transaction_count: number
  revenue: number
}
```

---

## Notification Models

### Notification

```typescript
export interface Notification {
  id: string
  user_id: string
  
  title: string
  message: string
  type: NotificationType
  
  data?: Record<string, any>         // Additional context
  action_url?: string                // Where to navigate on click
  
  is_read: boolean
  read_at?: string
  
  priority: 'low' | 'normal' | 'high'
  
  created_at: string
  expires_at?: string                // Auto-delete after
}

export enum NotificationType {
  INFO = 'info'
  SUCCESS = 'success'
  WARNING = 'warning'
  ERROR = 'error'
  ALERT = 'alert'
}
```

---

## API Request/Response Models

### Standard API Response

```typescript
export interface ApiResponse<T> {
  status: 'success' | 'error'
  data?: T                           // Payload
  error?: ApiError
  meta?: ResponseMeta
}

export interface ApiError {
  code: string                       // Machine-readable error code
  message: string                    // User-friendly message
  details?: Record<string, any>      // Additional context
  retry_after?: number               // Seconds to wait before retry
}

export interface ResponseMeta {
  timestamp: string
  request_id: string
  version: string                    // API version
}
```

### Pagination

```typescript
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: ResponseMeta & {
    pagination: Pagination
  }
}

export interface Pagination {
  page: number                       // Current page (1-indexed)
  page_size: number                  // Items per page
  total_count: number                // Total items available
  total_pages: number
  has_next: boolean
  has_previous: boolean
}
```

### Filters & Search

```typescript
export interface SearchParams {
  q?: string                         // Search query
  page?: number
  limit?: number
  sort?: string                      // field:asc or field:desc
  filters?: Record<string, any>      // Arbitrary filters
}

export interface FilterOptions {
  category?: string[]
  date_from?: string                 // ISO 8601
  date_to?: string
  amount_min?: number
  amount_max?: number
  payment_method?: PaymentMethod[]
  status?: string[]
}
```

---

## Domain-Specific Models

### LaundryModels

```typescript
export interface LaundryOrder extends Transaction {
  service_type: 'regular' | 'express' | 'next_day'
  items: LaundryOrderItem[]
  delivery_date?: string
  pickup_date?: string
  is_pressed: boolean
  packaging_type?: 'plastic' | 'box'
}

export interface LaundryOrderItem {
  id: string
  item_type: string                  // 'shirt', 'pants', 'dress', etc.
  quantity: number
  color?: string
  condition?: string                 // 'normal', 'delicate', 'heavily_soiled'
  notes?: string
  unit_price: number
}
```

### SalonModels

```typescript
export interface SalonBooking extends Transaction {
  service_ids: string[]
  services: SalonService[]
  stylist_id: string
  appointment_date: string
  duration_minutes: number
  notes?: string
}

export interface SalonService {
  id: string
  name: string
  duration_minutes: number
  price: number
  category: string                   // 'haircut', 'coloring', etc.
}
```

### DealerModels

```typescript
export interface DealerTransaction extends Transaction {
  vehicle: Vehicle
  is_new: boolean                    // New or used
  negotiation_price?: number
  down_payment: number
  is_financing: boolean
  financing_details?: FinancingDetails
  test_drive_done: boolean
  documents: DocumentChecklistItem[]
}

export interface Vehicle {
  make: string                       // Brand
  model: string
  year: number
  color: string
  license_plate?: string
  vin?: string                       // Vehicle Identification Number
  mileage?: number
}

export interface FinancingDetails {
  amount: number
  tenor_months: number
  interest_rate: number
  monthly_payment: number
  bank_name: string
  approval_status: 'pending' | 'approved' | 'rejected'
}
```

---

## Validation Schemas

### For forms and API validation:

```typescript
// Email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Phone validation (international format)
const PHONE_REGEX = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/

// Postal code (Indonesia)
const POSTAL_CODE_REGEX = /^\d{5}$/

// Product code/SKU
const PRODUCT_CODE_REGEX = /^[A-Z0-9-]{3,20}$/

// Transaction number (user-facing)
const TRANSACTION_NUMBER_REGEX = /^[A-Z]{2}\d{8,}$/

// UUID v4
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
```

---

## Type Guards

Useful for runtime type checking:

```typescript
// Check if value is a valid PaymentMethod
function isPaymentMethod(value: any): value is PaymentMethod {
  return ['cash', 'card', 'transfer', 'e_wallet', 'cheque', 'financing', 'invoice']
    .includes(value)
}

// Check if value is valid BusinessType
function isBusinessType(value: any): value is BusinessType {
  return Object.values(BusinessType).includes(value)
}

// Check if user has required role
function hasRole(user: User, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    [UserRole.ADMIN]: 4,
    [UserRole.MANAGER]: 3,
    [UserRole.SUPERVISOR]: 2,
    [UserRole.STAFF]: 1,
    [UserRole.GUEST]: 0,
  }
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole]
}
```

---

## Database Schema Overview

### Tables (PostgreSQL)

- `users` - User accounts
- `tenants` - Organizations/businesses
- `branches` - Tenant branches
- `products` - Product catalog
- `product_categories` - Product categorization
- `transactions` - Sales/orders
- `transaction_items` - Line items in transactions
- `payments` - Payment records
- `notifications` - User notifications
- `sessions` - Active user sessions
- `audit_logs` - Change tracking
- `offline_operations` - Queued offline operations
- `sync_conflicts` - Detected conflicts
- `reports` - Generated reports

### Indexes

Critical indexes for performance:

- `transactions(tenant_id, branch_id, created_at)`
- `products(tenant_id, code)`
- `transaction_items(transaction_id)`
- `sessions(user_id, is_active)`
- `notifications(user_id, is_read)`

---

## Related Documentation

- [API Endpoints](./ENDPOINTS.md)
- [Error Codes](./error-codes.md)
- [Database Schema](../database/README.md)
- [Component Registry](../components/REGISTRY.md)
