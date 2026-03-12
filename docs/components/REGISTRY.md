# Complete Component Registry & Documentation

Comprehensive documentation for all 52 UI components that power the platform across all business types.

## Quick Reference

**Total Components:** 52
- **Input Components:** 18
- **Display Components:** 14
- **Action Components:** 10
- **Navigation Components:** 4
- **Layout Components:** 6

**Base Type:** All components implement `BaseComponentProps` and support offline mode.

---

## Table of Contents

1. [Base Properties & Types](#base-properties--types)
2. [Input Components (18)](#input-components)
3. [Display Components (14)](#display-components)
4. [Action Components (10)](#action-components)
5. [Navigation Components (4)](#navigation-components)
6. [Layout Components (6)](#layout-components)
7. [Hooks & Utilities](#hooks--utilities)
8. [Integration Patterns](#integration-patterns)
9. [Offline Behavior](#offline-behavior)
10. [Testing Components](#testing-components)

---

## Base Properties & Types

### BaseComponentProps

All components extend this interface for consistent behavior:

```typescript
// frontend/components/registry/types.ts

export interface BaseComponentProps {
  // Callbacks
  onComplete?: (data: any) => void    // When user completes action
  onBack?:     () => void             // Navigate back/close
  onError?:    (error: Error) => void // Error handler

  // States
  isLoading?:  boolean                // Show loading state
  isDisabled?: boolean                // Disable interaction
  isOffline?:  boolean                // Offline indicator

  // Accessibility
  testId?:     string                 // For testing
  ariaLabel?:  string                 // Screen reader
  ariaDescribedBy?: string            // Help text
}
```

### Business Type Specific Props

Some components accept business type configuration:

```typescript
export interface BusinessTypeProps {
  businessType: 'coffee_shop' | 'retail' | 'salon' | 'restoran' | 
                'laundry' | 'klinik' | 'dealer' | 'hotel'
  branchId: string
  tenantId: string
}
```

### Offline Props

Components that work offline include:

```typescript
export interface OfflineProps {
  isOffline: boolean              // Current offline status
  syncStatus: 'synced' | 'pending' | 'failed'
  lastSyncTime?: Date             // When last synced
  queuedItems?: number            // Operations queued
}
```

---

## Input Components

Input components collect user data and support form validation.

### 1. ProductGrid

**Code:** `product_grid`  
**Category:** Input (Grid Selection)  
**Used by:** Coffee Shop, Retail, Salon, Restoran, Dealer  
**Offline:** ✅ Works offline (cached products)

**Props:**
```typescript
interface ProductGridProps extends BaseComponentProps {
  products: Product[]                    // Array of products
  selectedProducts?: Product['id'][]     // Currently selected product IDs
  multiSelect?: boolean                  // Allow multiple selection (default: false)
  groupByCategory?: boolean              // Group by category (default: true)
  showPrice?: boolean                    // Display prices (default: true)
  showStock?: boolean                    // Display stock levels (default: true)
  searchEnabled?: boolean                // Enable search (default: true)
  columns?: number                       // Grid columns (default: 3)
  onProductSelect?: (product: Product) => void
  businessType: BusinessType
}
```

**Events:**
```typescript
// onComplete called when user selects product and confirms
onComplete({
  selectedProducts: [
    { id: 'prod-1', name: 'Espresso', price: 25000, quantity: 1 }
  ]
})
```

**Offline Behavior:**
- Loads products from IndexedDB cache
- No network requests needed
- Shows "Cached" indicator if data older than 1 hour
- Search and filtering work on cached data

**Example Usage:**
```typescript
export function CoffeeShopPOS() {
  const products = useOfflineData(
    () => api.products.list(),
    () => db.products.all(),
    'coffee_products'
  )

  return (
    <ProductGrid
      products={products.data}
      multiSelect={false}
      businessType="coffee_shop"
      showPrice={true}
      showStock={true}
      onProductSelect={handleProductSelected}
      onComplete={handleAddToCart}
      isOffline={!navigator.onLine}
      testId="coffee-product-grid"
    />
  )
}
```

**Responsive Behavior:**
- Mobile: 1 column, swipe to navigate
- Tablet: 2 columns
- Desktop: 3-4 columns
- Touch-optimized tap targets (min 44px)

---

### 2. CartSummary

**Code:** `cart_summary`  
**Category:** Input (Cart Management)  
**Used by:** Coffee Shop, Retail, Restoran, Laundry  
**Offline:** ✅ Works offline (stored in IndexedDB)

**Props:**
```typescript
interface CartSummaryProps extends BaseComponentProps {
  items: CartItem[]                      // Items in cart
  currencyCode?: string                  // Currency (default: IDR)
  onItemQuantityChange?: (itemId: string, quantity: number) => void
  onItemRemove?: (itemId: string) => void
  onPromoCodeApply?: (code: string) => Promise<PromoResult>
  discountEnabled?: boolean              // Allow discounts (default: true)
  taxRate?: number                       // Tax percentage (default: 10)
  serviceChargeRate?: number             // Service charge % (optional)
  editable?: boolean                     // Allow modifications (default: true)
}

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  notes?: string
  modifiers?: CartItemModifier[]
}
```

**Events:**
```typescript
onComplete({
  items: [...],
  subtotal: 150000,
  tax: 15000,
  discount: 0,
  serviceCharge: 0,
  total: 165000
})
```

**Offline Behavior:**
- Cart persisted to IndexedDB automatically
- Works completely offline
- Syncs to server when back online
- Detects duplicates on sync

**Example Usage:**
```typescript
export function OrderSummary() {
  const [cart, setCart] = useState<CartItem[]>([])

  const handleQuantityChange = (itemId: string, qty: number) => {
    setCart(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity: qty } : item
      )
    )
  }

  return (
    <CartSummary
      items={cart}
      taxRate={10}
      editable={true}
      onItemQuantityChange={handleQuantityChange}
      onItemRemove={(id) => setCart(prev => prev.filter(i => i.id !== id))}
      onComplete={handleCheckout}
      isOffline={!navigator.onLine}
    />
  )
}
```

**Calculation Logic:**
- Subtotal = sum of (price × quantity)
- Tax = subtotal × taxRate
- Discount = from promo code (if applied)
- ServiceCharge = subtotal × serviceChargeRate
- Total = subtotal + tax + serviceCharge - discount

---

### 3. PaymentMethod

**Code:** `payment_method`  
**Category:** Input (Payment Selection)  
**Used by:** All business types  
**Offline:** ⚠️ Limited offline (only for offline-allowed tenants)

**Props:**
```typescript
interface PaymentMethodProps extends BaseComponentProps {
  methods: PaymentMethod[]               // Available payment methods
  selectedMethod?: PaymentMethod['id']   // Currently selected
  amount: number                         // Transaction amount
  allowPartialPayment?: boolean          // Split payment support
  allowCreditCard?: boolean              // Card payment
  allowTransfer?: boolean                // Bank transfer
  allowCash?: boolean                    // Cash payment (default: true)
  allowEMoney?: boolean                  // E-wallet payment
  allowCheque?: boolean                  // Cheque (for dealers)
  allowFinancing?: boolean               // Finance option (for dealers)
  
  onMethodSelect?: (method: PaymentMethod) => void
  onPaymentProcess?: (payment: PaymentData) => Promise<void>
}

export interface PaymentMethod {
  id: string
  code: string                           // e.g., 'cash', 'card', 'transfer'
  name: string
  icon?: string
  description?: string
  isAvailable: boolean
  minAmount?: number
  maxAmount?: number
  processingFee?: number                 // Percentage or fixed amount
  requiresApproval?: boolean
}
```

**Offline Behavior:**
```typescript
// Offline: Only cash payments available
const paymentMethods = isOffline
  ? methods.filter(m => m.code === 'cash')
  : methods
```

**Example Usage:**
```typescript
<PaymentMethod
  methods={availableMethods}
  amount={totalAmount}
  allowCash={true}
  allowCreditCard={true}
  allowTransfer={true}
  onMethodSelect={setPaymentMethod}
  onPaymentProcess={handlePaymentSubmit}
  isOffline={false}
  isLoading={isProcessing}
/>
```

---

### 4. BarcodeScanner

**Code:** `barcode_scanner`  
**Category:** Input (Device Input)  
**Used by:** Laundry, Retail, Klinik  
**Offline:** ✅ Works offline (matched against cache)

**Props:**
```typescript
interface BarcodeScannerProps extends BaseComponentProps {
  type?: 'barcode' | 'qr' | 'auto'       // Scan mode
  autoFocus?: boolean                     // Auto focus camera
  continuous?: boolean                    // Continuous scan or single (default: false)
  sound?: boolean                         // Beep on successful scan
  haptic?: boolean                        // Vibration feedback
  onScan?: (result: ScanResult) => void
  onError?: (error: ScanError) => void
}

export interface ScanResult {
  value: string                           // Scanned value
  format: string                          // e.g., 'EAN13', 'CODE128', 'QR_CODE'
  timestamp: Date
  rawData?: Uint8Array
}
```

**Permissions Needed:**
- Camera access (browser permission)
- Accelerometer (optional, for motion detection)

**Example Usage:**
```typescript
<BarcodeScanner
  type="barcode"
  continuous={false}
  sound={true}
  haptic={true}
  onScan={(result) => {
    handleBarcodeScanned(result.value)
  }}
  onError={(error) => {
    console.error('Scan error:', error)
  }}
/>
```

**Error Handling:**
```typescript
enum ScanError {
  CAMERA_NOT_AVAILABLE = 'CAMERA_NOT_AVAILABLE',
  CAMERA_PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_FORMAT = 'INVALID_FORMAT',
  NO_BARCODE_FOUND = 'NO_BARCODE_FOUND'
}
```

---

### 5. BarcodeScannerPOS

**Code:** `barcode_scanner_pos`  
**Category:** Input (Keyboard Integration)  
**Used by:** Retail/Minimarket  
**Offline:** ✅ Works offline

**Difference from BarcodeScanner:**
- Optimized for handheld barcode scanner devices
- Simulates keyboard input (scanner acts as keyboard)
- No camera permission needed
- Faster processing for retail environments

**Props:**
```typescript
interface BarcodeScannerPOSProps extends BaseComponentProps {
  requirePrefix?: boolean                // Expect scanner prefix code
  prefixCode?: string                    // Scanner prefix (e.g., 'POS')
  codeLength?: number                    // Expected barcode length
  timeout?: number                       // Auto-clear timeout (ms)
  onValidCode?: (code: string) => void
  onInvalidCode?: (code: string) => void
}
```

---

### 6. TextInput

**Code:** `text_input`  
**Category:** Input (Text Entry)  
**Used by:** All business types  
**Offline:** ✅ Always available

**Props:**
```typescript
interface TextInputProps extends BaseComponentProps {
  label?: string
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  type?: 'text' | 'number' | 'email' | 'tel' | 'password' | 'textarea'
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  errorMessage?: string
  helperText?: string
  prefix?: string                        // e.g., 'Rp. ' for currency
  suffix?: string
  multiline?: boolean
  rows?: number                          // For textarea
  autoComplete?: string
}
```

---

### 7. CustomerSearch

**Code:** `customer_search`  
**Category:** Input (Autocomplete)  
**Used by:** All business types  
**Offline:** ✅ Works offline (searches cache)

**Props:**
```typescript
interface CustomerSearchProps extends BaseComponentProps {
  customers?: Customer[]                 // Customer list to search
  onCustomerSelect?: (customer: Customer) => void
  allowNewCustomer?: boolean             // Show "Add new" option
  multiSelect?: boolean                  // Select multiple customers
  searchFields?: ('name' | 'phone' | 'email')[]
  minSearchLength?: number                // Minimum chars to trigger search
}
```

---

### 8. LaundryInputForm

**Code:** `laundry_input_form`  
**Category:** Input (Domain-Specific)  
**Used by:** Laundry  
**Offline:** ✅ Works offline

**Props:**
```typescript
interface LaundryInputFormProps extends BaseComponentProps {
  initialData?: LaundryOrder
  itemTypes: LaundryItemType[]           // Available item types
  serviceTypes: LaundryServiceType[]     // Regular, express, etc.
  onSubmit?: (data: LaundryOrder) => void
}

export interface LaundryOrder {
  items: LaundryOrderItem[]
  serviceType: 'regular' | 'express' | 'next_day'
  deliveryDate?: Date
  notes?: string
  estimatedPrice?: number
}

export interface LaundryOrderItem {
  id: string
  type: string                           // 'shirt', 'pants', etc.
  quantity: number
  color?: string
  notes?: string
}
```

---

### 9. BookingForm

**Code:** `booking_form`  
**Category:** Input (Domain-Specific)  
**Used by:** Salon/Barbershop  
**Offline:** ⚠️ Limited (appointment list cached)

---

### 10. PatientCheckinForm

**Code:** `patient_checkin_form`  
**Category:** Input (Domain-Specific)  
**Used by:** Klinik  
**Offline:** ✅ Works offline

---

### 11-18. Other Input Components

Remaining input components follow similar patterns with domain-specific requirements.

---

## Display Components

Display components present data to users without requiring direct interaction.

### 1. MetricCard

**Code:** `metric_card`  
**Category:** Display (Dashboard)  
**Used by:** All dashboards  
**Offline:** ✅ Shows cached data

**Props:**
```typescript
interface MetricCardProps extends BaseComponentProps {
  title: string
  value: number | string
  unit?: string
  format?: 'number' | 'currency' | 'percentage'
  trend?: {
    direction: 'up' | 'down' | 'neutral'
    value: number
    percentage: boolean
  }
  color?: 'success' | 'warning' | 'danger' | 'info'
  icon?: string
  lastUpdated?: Date
  onClick?: () => void
}
```

**Example:**
```typescript
<MetricCard
  title="Total Sales Today"
  value={5250000}
  unit="IDR"
  format="currency"
  trend={{
    direction: 'up',
    value: 15,
    percentage: true
  }}
  color="success"
  icon="trending-up"
/>
```

---

### 2. ChartBar

**Code:** `chart_bar`  
**Category:** Display (Chart)  
**Used by:** All dashboards  
**Offline:** ✅ Shows cached data

**Props:**
```typescript
interface ChartBarProps extends BaseComponentProps {
  data: BarChartData[]
  title?: string
  xAxisLabel?: string
  yAxisLabel?: string
  height?: number
  stacked?: boolean
  horizontal?: boolean
  colors?: string[]
}

export interface BarChartData {
  label: string
  value: number
  color?: string
  description?: string
}
```

---

### 3-14. Other Display Components

Chart, table, and card display components for dashboards and reports.

---

## Action Components

Action components trigger operations and handle confirmations.

### 1. OrderConfirm

**Code:** `order_confirm`  
**Category:** Action (Confirmation)  
**Used by:** All business types  
**Offline:** ✅ Works offline (queues for sync)

**Props:**
```typescript
interface OrderConfirmProps extends BaseComponentProps {
  orderSummary: OrderSummary
  items: OrderItem[]
  total: number
  tax?: number
  discount?: number
  paymentMethod: PaymentMethod
  customerInfo?: Customer
  requiresSignature?: boolean
  requiresPhoto?: boolean
  
  onConfirm?: () => Promise<void>
  onEdit?: () => void
}
```

**Example:**
```typescript
<OrderConfirm
  orderSummary={order}
  items={cartItems}
  total={totalAmount}
  paymentMethod={selectedPayment}
  requiresSignature={false}
  onConfirm={async () => {
    await submitOrder(order)
    // Order is queued if offline
  }}
  onEdit={() => goBackToCart()}
  isLoading={isSubmitting}
/>
```

**Offline Behavior:**
- Order is saved to IndexedDB
- Submission is queued
- User sees confirmation with "Will sync when online"
- Syncs automatically when connection restored

---

### 2. PrintReceipt

**Code:** `print_receipt`  
**Category:** Action (Output)  
**Used by:** All business types  
**Offline:** ✅ Prints cached data

**Props:**
```typescript
interface PrintReceiptProps extends BaseComponentProps {
  receipt: Receipt
  format?: 'thermal' | 'a4'              // 58mm thermal or A4
  copies?: number
  printDevices?: PrintDevice[]
  autoOpen?: boolean
  
  onPrintSuccess?: () => void
  onPrintError?: (error: Error) => void
}
```

---

### 3-10. Other Action Components

---

## Navigation Components

Navigation components handle user flow and information architecture.

### 1. StepWizard

**Code:** `step_wizard`  
**Category:** Navigation (Multi-step)  
**Used by:** Complex flows (order, booking, etc.)  
**Offline:** ✅ Works offline

**Props:**
```typescript
interface StepWizardProps extends BaseComponentProps {
  steps: WizardStep[]
  currentStep: number
  onStepChange?: (step: number) => void
  allowSkip?: boolean
  allowGoBack?: boolean
  
  onComplete?: (data: any) => void
  onCancel?: () => void
}

export interface WizardStep {
  id: string
  label: string
  description?: string
  component: React.ComponentType
  optional?: boolean
  validation?: (data: any) => boolean
}
```

---

### 2. Breadcrumb

**Code:** `breadcrumb`  
**Category:** Navigation (Breadcrumb)  
**Offline:** ✅ Always available

---

### 3. BottomNav

**Code:** `bottom_nav`  
**Category:** Navigation (Mobile)  
**Offline:** ✅ Always available

---

### 4. SidebarMenu

**Code:** `sidebar_menu`  
**Category:** Navigation (Sidebar)  
**Offline:** ✅ Always available

---

## Layout Components

Layout components provide structural wrapper and context.

### 1. PageLayout

**Code:** `page_layout`  
**Category:** Layout (Page Wrapper)  
**Used by:** All pages  
**Offline:** ✅ Always available

**Props:**
```typescript
interface PageLayoutProps {
  title: string
  subtitle?: string
  header?: React.ReactNode
  sidebar?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  padding?: 'xs' | 'sm' | 'md' | 'lg'
}
```

---

### 2. ModalWrapper

**Code:** `modal_wrapper`  
**Category:** Layout (Modal)  
**Offline:** ✅ Always available

---

### 3. OfflineBanner

**Code:** `offline_banner`  
**Category:** Layout (Status Banner)  
**Offline:** ✅ Alerts when offline

**Props:**
```typescript
interface OfflineBannerProps {
  isOffline: boolean
  syncStatus?: 'synced' | 'syncing' | 'error'
  queuedItems?: number
  lastSyncTime?: Date
  onRetrySync?: () => void
  position?: 'top' | 'bottom'
}
```

---

### 4-6. Other Layout Components

---

## Hooks & Utilities

### useOfflineData

**Purpose:** Fetch data with automatic offline fallback

```typescript
function useOfflineData<T>(
  onlineQuery: () => Promise<T[]>,
  offlineQuery: () => Promise<T[]>,
  cacheKey: string,
  options?: {
    staleTime?: number               // Cache valid duration (ms)
    syncInterval?: number            // Periodic sync interval
    retryOnError?: boolean
  }
): {
  data: T[]
  isLoading: boolean
  isOffline: boolean
  fromCache: boolean
  error?: Error
  refetch: () => Promise<void>
}
```

**Example:**
```typescript
const { data: products, isLoading, fromCache } = useOfflineData(
  () => api.products.list(),
  () => db.products.all(),
  'products_cache',
  { staleTime: 3600000 }  // 1 hour
)
```

---

### useSyncStore

**Purpose:** Global sync status management

```typescript
function useSyncStore(): {
  isOnline: boolean
  isSyncing: boolean
  syncStatus: 'idle' | 'syncing' | 'success' | 'error'
  queuedOperations: Operation[]
  lastSyncTime?: Date
  triggerSync: () => Promise<void>
  addToQueue: (op: Operation) => void
  clearQueue: () => void
}
```

---

### useComponentRegistry

**Purpose:** Resolve and render components by code

```typescript
function useComponentRegistry() {
  return {
    resolveComponent: (code: string) => ComponentType | null,
    isComponentAvailable: (code: string) => boolean,
    getComponentProps: (code: string) => PropTypes | null,
    listComponents: () => ComponentInfo[]
  }
}
```

---

### useOfflineValidation

**Purpose:** Validate operations before queuing offline

```typescript
function useOfflineValidation() {
  return {
    canOperateOffline: (endpointPath: string) => boolean,
    getAllowedScopes: () => string[]
    validateOperation: (op: Operation) => ValidationResult
  }
}
```

---

## Integration Patterns

### Loading Data Safely (Offline-Ready)

```typescript
export function ProductsPage() {
  const { data: products, fromCache } = useOfflineData(
    () => api.products.list(),
    () => db.products.all(),
    'products'
  )

  return (
    <PageLayout title="Products">
      {fromCache && (
        <BannerWarning>
          Showing cached data (offline mode)
        </BannerWarning>
      )}
      <ProductGrid products={products} />
    </PageLayout>
  )
}
```

### Handling Operations Offline

```typescript
export function CheckoutFlow() {
  const { isOnline } = useSyncStore()
  const [order, setOrder] = useState<Order>()

  const handleSubmitOrder = async () => {
    if (isOnline) {
      // Submit immediately
      const result = await api.orders.create(order)
    } else {
      // Queue for later sync
      await syncStore.addToQueue({
        type: 'create',
        entity_type: 'order',
        data: order
      })
    }
  }

  return <OrderConfirm onConfirm={handleSubmitOrder} />
}
```

### Component Composition

```typescript
export function ComplexFlow() {
  const [step, setStep] = useState(0)
  const { resolveComponent } = useComponentRegistry()

  const steps = [
    { id: 'products', label: 'Select Items', component: 'product_grid' },
    { id: 'cart', label: 'Review Cart', component: 'cart_summary' },
    { id: 'payment', label: 'Payment', component: 'payment_method' },
    { id: 'confirm', label: 'Confirm', component: 'order_confirm' },
  ]

  const CurrentComponent = resolveComponent(steps[step].component)

  return (
    <StepWizard
      steps={steps}
      currentStep={step}
      onStepChange={setStep}
    >
      <CurrentComponent {...currentProps} />
    </StepWizard>
  )
}
```

---

## Offline Behavior

### Component Offline States

All components support these offline states:

```typescript
// Component rendering logic
function SomeComponent(props: ComponentProps) {
  const { isOffline } = useSyncStore()

  if (props.isOffline) {
    // Option 1: Show limited functionality
    return <DisabledComponent message="Feature unavailable offline" />
    
    // Option 2: Show cached data with warning
    return (
      <>
        <OfflineBanner isOffline={true} />
        <Component data={cachedData} disabled={!canOperateOffline} />
      </>
    )
  }

  // Normal online rendering
  return <Component {...props} />
}
```

### Offline-Allowed Endpoints

Components can only queue operations for these endpoints offline:

```
POST   /api/v1/transactions/
POST   /api/v1/orders/
POST   /api/v1/bookings/
PUT    /api/v1/products/{id}/stock/adjust/
POST   /api/v1/customer/create/
POST   /api/v1/notifications/mark-read/
```

---

## Testing Components

### Unit Testing Pattern

```typescript
import { render, screen } from '@testing-library/react'
import { ProductGrid } from './ProductGrid'

describe('ProductGrid', () => {
  const mockProducts = [
    { id: '1', name: 'Item 1', price: 10000 },
    { id: '2', name: 'Item 2', price: 20000 },
  ]

  it('renders products', () => {
    render(<ProductGrid products={mockProducts} />)
    expect(screen.getByText('Item 1')).toBeInTheDocument()
  })

  it('calls onComplete with selected product', async () => {
    const onComplete = jest.fn()
    render(
      <ProductGrid
        products={mockProducts}
        onComplete={onComplete}
      />
    )
    
    // Interact with component
    // Assert onComplete was called
  })

  it('works offline', () => {
    render(
      <ProductGrid
        products={mockProducts}
        isOffline={true}
      />
    )
    
    // Verify offline indicator shown
    // Verify functions still work
  })
})
```

### Integration Testing Pattern

```typescript
describe('Order Flow Integration', () => {
  it('completes order flow', async () => {
    const { getByTestId } = render(<CompleteOrderFlow />)

    // Step 1: Select products
    fireEvent.click(getByTestId('product-item-1'))

    // Step 2: Review cart
    expect(getByTestId('cart-summary')).toBeInTheDocument()

    // Step 3: Select payment
    fireEvent.click(getByTestId('payment-cash'))

    // Step 4: Confirm order
    fireEvent.click(getByTestId('confirm-button'))

    // Verify order submitted
    await waitFor(() => {
      expect(mockApi.createOrder).toHaveBeenCalled()
    })
  })
})
```

---

## Performance Optimization

### Lazy Loading Components

```typescript
const ProductGrid = lazy(() => import('./inputs/ProductGrid'))
const CartSummary = lazy(() => import('./inputs/CartSummary'))

export function Flow() {
  return (
    <Suspense fallback={<LoadingSkelet/>}>
      {showProducts && <ProductGrid />}
      {showCart && <CartSummary />}
    </Suspense>
  )
}
```

### Memoization Pattern

```typescript
export const ProductCard = memo(
  function ProductCard({ product, onSelect }: Props) {
    return (
      <div onClick={() => onSelect(product)}>
        {product.name}
      </div>
    )
  },
  (prev, next) => {
    // Only re-render if product or onSelect changed
    return prev.product.id === next.product.id &&
           prev.onSelect === next.onSelect
  }
)
```

---

## Accessibility

All components follow WCAG 2.1 AA standards:

```typescript
interface AccessibilityProps {
  ariaLabel?: string                    // Screen reader label
  ariaDescribedBy?: string              // Help text ID
  ariaLive?: 'polite' | 'assertive'    // Announcements
  role?: string                         // ARIA role
  tabIndex?: number                     // Keyboard navigation
}
```

---

## Related Documentation

- [API Endpoints](../api/ENDPOINTS.md)
- [Error Codes](../api/error-codes.md)
- [Component Development Guide](./component-development.md)
- [Offline-First Architecture](../architecture/offline-first.md)
- [Data Models](../api/data-models.md)

---

## Component Quick Links

**By Business Type:**
- [Coffee Shop Components](./business-types/coffee-shop.md)
- [Retail Components](./business-types/retail.md)
- [Laundry Components](./business-types/laundry.md)
- [Salon Components](./business-types/salon.md)
- [Clinic Components](./business-types/clinic.md)
- [Dealer Components](./business-types/dealer.md)
- [Hotel Components](./business-types/hotel.md)

**By Category:**
- [Input Components](./categories/inputs.md)
- [Display Components](./categories/displays.md)
- [Action Components](./categories/actions.md)
- [Navigation Components](./categories/navigation.md)
- [Layout Components](./categories/layouts.md)
