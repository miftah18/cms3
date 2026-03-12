# BaseComponentProps Deep Dive

Complete guide to `BaseComponentProps` and how to extend them for your components.

## What is BaseComponentProps?

`BaseComponentProps` is the foundation interface that all 52 components implement. It provides:

1. **Consistent callback patterns** - `onComplete`, `onBack`, `onError`
2. **State management** - `isLoading`, `isDisabled`, `isOffline`
3. **Accessibility support** - `testId`, `ariaLabel`
4. **Offline-first design** - Automatic offline detection

```typescript
// frontend/components/registry/types.ts

export interface BaseComponentProps {
  // Lifecycle callbacks
  onComplete?: (data: any) => void
  onBack?: () => void
  onError?: (error: Error) => void

  // State indicators
  isLoading?: boolean
  isDisabled?: boolean
  isOffline?: boolean

  // Accessibility & testing
  testId?: string
  ariaLabel?: string
  ariaDescribedBy?: string
}
```

---

## Core Properties Explained

### Callbacks

#### `onComplete?: (data: any) => void`

Called when user completes the primary action in the component.

**When it's called:**
- Component: **ProductGrid** → User selects product and confirms
- Component: **CartSummary** → User reviews cart and proceeds
- Component: **PaymentMethod** → User selects payment and confirms
- Component: **OrderConfirm** → User confirms order

**Data passed varies by component:**

```typescript
// ProductGrid
onComplete({
  selectedProducts: [
    { id: 'prod-123', name: 'Coffee', price: 25000 }
  ]
})

// CartSummary
onComplete({
  items: [...],
  subtotal: 150000,
  tax: 15000,
  total: 165000
})

// PaymentMethod
onComplete({
  method: 'cash',
  amount: 165000,
  timestamp: '2024-01-15T14:30:00Z'
})
```

**Best Practice:**
```typescript
export function OrderPage() {
  const handleProductSelected = (product) => {
    // ProductGrid calls onComplete with selected product
  }

  const handleCartReady = async (cartData) => {
    // CartSummary calls onComplete when ready to checkout
    // Save cart to database/sync queue
    await saveCart(cartData)
  }

  return (
    <StepWizard>
      <ProductGrid onComplete={handleProductSelected} />
      <CartSummary onComplete={handleCartReady} />
    </StepWizard>
  )
}
```

---

#### `onBack?: () => void`

Called when user wants to go back (close, cancel, previous step).

**When it's called:**
- User clicks "Back" button
- User clicks "Cancel" button
- User closes modal
- Component lifecycle requires previous step

**Implementation:**
```typescript
function CheckoutFlow() {
  const [step, setStep] = useState(0)

  return (
    <>
      <ProductGrid onBack={() => setStep(-1)} />
      <CartSummary onBack={() => setStep(0)} />
      <PaymentMethod onBack={() => setStep(1)} />
    </>
  )
}
```

**In modals:**
```typescript
function CheckoutModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen}>
      <OrderConfirm onBack={onClose} />
    </Modal>
  )
}
```

---

#### `onError?: (error: Error) => void`

Called when an error occurs (validation, network, processing).

**When it's called:**
- Validation fails
- API request fails
- Payment processing fails
- Offline sync fails

**Error details:**
```typescript
interface ComponentError extends Error {
  code: string                           // Error code
  details?: Record<string, any>          // Extra context
  severity: 'error' | 'warning'          // Error level
  retry?: () => Promise<void>            // Retry function if available
}
```

**Example:**
```typescript
function OrderCheckout() {
  const [error, setError] = useState<Error | null>(null)

  const handleError = (error: Error) => {
    setError(error)
    // Show error notification
    showNotification({
      type: 'error',
      message: error.message,
      duration: 5000
    })
    
    // Log to error tracking
    logErrorToSentry(error)
  }

  return (
    <>
      {error && <ErrorAlert error={error} />}
      <OrderConfirm
        onError={handleError}
        onComplete={handleSuccess}
      />
    </>
  )
}
```

---

### State Properties

#### `isLoading?: boolean`

Indicates component is waiting for async operation (API call, processing).

**When to set:**
- API request in progress
- Form submission processing
- Payment processing
- Offline sync in progress

**Component behavior when true:**
- Buttons disabled
- Spinner/progress indicator shown
- User input disabled
- "Loading..." text displayed

**Example:**
```typescript
export function CheckoutPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmitOrder = async () => {
    setIsSubmitting(true)
    try {
      const result = await api.orders.create(orderData)
      showSuccess('Order submitted')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <OrderConfirm
      isLoading={isSubmitting}
      onComplete={handleSubmitOrder}
    />
  )
}
```

**In components:**
```typescript
function OrderConfirm({ isLoading, ...props }: OrderConfirmProps) {
  return (
    <div>
      <OrderSummary />
      <button disabled={isLoading}>
        {isLoading ? 'Processing...' : 'Confirm Order'}
      </button>
      {isLoading && <Spinner />}
    </div>
  )
}
```

---

#### `isDisabled?: boolean`

Indicates component is disabled (user cannot interact).

**When to set:**
- User lacks permissions
- Form has validation errors
- Operation not allowed in current state
- Feature requires online mode

**Different from `isLoading`:**
```typescript
// isLoading: "Please wait while we process"
<OrderConfirm isLoading={true} />

// isDisabled: "You don't have permission to do this"
<OrderConfirm isDisabled={!hasPermission} />

// Both: "Please wait, and you'll need permission anyway"
<OrderConfirm isLoading={true} isDisabled={!hasPermission} />
```

**Example:**
```typescript
export function RefundButton() {
  const { userRole } = useAuth()
  const canRefund = ['supervisor', 'manager', 'admin'].includes(userRole)

  return (
    <RefundAction
      isDisabled={!canRefund}
      onError={(e) => {
        if (e.code === 'PERMISSION_DENIED') {
          showNotification('Only supervisors can process refunds')
        }
      }}
    />
  )
}
```

---

#### `isOffline?: boolean`

Indicates device is currently offline.

**Automatically managed by `useSyncStore()`:**

```typescript
function MyComponent() {
  const { isOnline } = useSyncStore()

  return (
    <OrderConfirm
      isOffline={!isOnline}
      // When offline:
      // - Some operations queued instead of submitted
      // - Shows "Will sync when online" message
      // - Uses cached data only
    />
  )
}
```

**Component behavior when true:**
- Limited functionality available
- "Offline mode" indicator shown
- Operations queued instead of submitted
- Uses cached data exclusively
- Some buttons may be disabled

**Which components support offline:**
- ✅ **Full offline:** ProductGrid, CartSummary, TextInput, CustomerSearch
- ⚠️ **Limited offline:** PaymentMethod, OrderConfirm (cash/check only)
- ❌ **Online only:** PaymentGateway, ApprovalRequest

---

### Accessibility Properties

#### `testId?: string`

Unique identifier for testing and debugging.

**Format convention:** `kebab-case`, specific to component

**Examples:**
```typescript
<ProductGrid testId="coffee-product-grid" />
<CartSummary testId="order-cart-summary" />
<PaymentMethod testId="checkout-payment-method" />
```

**Used in tests:**
```typescript
describe('Checkout Flow', () => {
  it('shows payment options', () => {
    const { getByTestId } = render(<CheckoutFlow />)
    
    // Find component by testId
    const paymentComponent = getByTestId('checkout-payment-method')
    expect(paymentComponent).toBeInTheDocument()
    
    // Simulate user action
    fireEvent.click(getByTestId('payment-cash-button'))
  })
})
```

**Used in debugging:**
```bash
# In browser console
document.querySelector('[data-testid="coffee-product-grid"]')
// Returns the ProductGrid component DOM node
```

---

#### `ariaLabel?: string`

Screen reader label for accessibility.

**Format:** Human-readable description of component purpose

**Examples:**
```typescript
<ProductGrid
  ariaLabel="Select products to add to order"
/>

<CartSummary
  ariaLabel="Review items and total amount before checkout"
/>

<PaymentMethod
  ariaLabel="Choose payment method and confirm transaction"
/>
```

**When required:**
- Component has no visible text label
- Icon-only buttons
- Inputs without visible labels
- Dialog content

---

#### `ariaDescribedBy?: string`

Links component to help text or description.

**Pattern:**
```typescript
<div>
  <PaymentMethod
    ariaDescribedBy="payment-help"
  />
  <p id="payment-help">
    Select payment method. Cash payments are allowed offline.
    Card payments require internet connection.
  </p>
</div>
```

---

## Extending BaseComponentProps

### Creating Domain-Specific Props

Extend `BaseComponentProps` for specialized components:

```typescript
// For laundry business type
export interface LaundryInputFormProps extends BaseComponentProps {
  // Base properties inherited:
  // - onComplete, onBack, onError
  // - isLoading, isDisabled, isOffline
  // - testId, ariaLabel

  // Domain-specific properties:
  itemTypes: LaundryItemType[]
  serviceTypes: LaundryServiceType[]
  defaultService?: 'regular' | 'express'
  onServiceTypeChange?: (type: string) => void
}
```

**Full example:**
```typescript
export interface LaundryInputFormProps extends BaseComponentProps {
  // Inherited from BaseComponentProps
  onComplete?: (data: LaundryOrder) => void
  onBack?: () => void
  onError?: (error: Error) => void
  isLoading?: boolean
  isDisabled?: boolean
  isOffline?: boolean
  testId?: string

  // Laundry-specific
  itemTypes: LaundryItemType[]
  serviceTypes: LaundryServiceType[]
  estimatedPrice?: number
  onItemsChange?: (items: LaundryOrderItem[]) => void
}
```

---

### Creating Business-Type Props

For components used across multiple business types:

```typescript
// Shared props across all business types
export interface CommonOrderProps extends BaseComponentProps {
  items: OrderItem[]
  subtotal: number
  tax: number
  total: number
  paymentMethod: string
}

// Coffee Shop specific
export interface CoffeeShopOrderProps extends CommonOrderProps {
  cupSize?: 'small' | 'medium' | 'large'
  temperaturePreference?: 'hot' | 'cold'
}

// Retail specific
export interface RetailOrderProps extends CommonOrderProps {
  discountCode?: string
  loyaltyPoints?: number
}

// Laundry specific
export interface LaundryOrderProps extends CommonOrderProps {
  serviceType: 'regular' | 'express'
  deliveryDate: Date
}
```

---

### Pattern: Callback Composition

Chain callbacks for complex flows:

```typescript
export function CheckoutWizard() {
  const [step, setStep] = useState(0)
  const [error, setError] = useState<Error | null>(null)

  const handleProductComplete = (selected) => {
    setError(null)  // Clear previous errors
    addToCart(selected)
    setStep(1)      // Move to next step
  }

  const handleCartError = (error: Error) => {
    setError(error)
    // Don't advance step, let user fix issue
  }

  const handleCheckoutComplete = async (data) => {
    try {
      const result = await submitOrder(data)
      // Success - move to confirmation
      setStep(3)
    } catch (error) {
      handleCartError(error)
    }
  }

  const steps = [
    <ProductGrid
      onComplete={handleProductComplete}
      testId="step-products"
    />,
    <CartSummary
      onComplete={handleCheckoutComplete}
      onError={handleCartError}
      onBack={() => setStep(0)}
      testId="step-cart"
    />,
    // ...
  ]

  return (
    <>
      {error && <ErrorNotification error={error} />}
      {steps[step]}
    </>
  )
}
```

---

## Error Handling Patterns

### Structured Error Object

```typescript
export interface ComponentErrorInfo {
  code: string                      // Machine-readable code
  message: string                   // User-friendly message
  field?: string                    // Field with error (forms)
  severity: 'error' | 'warning'    // Severity level
  details?: Record<string, any>     // Additional context
  retry?: () => Promise<void>       // Retry callback (if applicable)
}
```

### Handling Different Error Types

```typescript
function OrderCheckout() {
  const handleError = (error: Error) => {
    if (error instanceof ValidationError) {
      // Show validation message
      showNotification({
        type: 'warning',
        message: error.message
      })
    } else if (error instanceof NetworkError) {
      // Handle offline scenario
      showNotification({
        type: 'info',
        message: 'Order will be submitted when online',
        action: { label: 'Undo', onClick: undoOrder }
      })
    } else if (error instanceof PaymentError) {
      // Handle payment failures
      showNotification({
        type: 'error',
        message: `Payment failed: ${error.message}`,
        action: { label: 'Retry', onClick: error.retry }
      })
    } else {
      // Handle unexpected errors
      showNotification({
        type: 'error',
        message: 'An unexpected error occurred',
        action: { label: 'Contact Support', onClick: openSupport }
      })
      logErrorToSentry(error)
    }
  }

  return <OrderConfirm onError={handleError} />
}
```

---

## Loading State Management

### Progressive Enhancement

Show different UI based on loading state:

```typescript
function ProductSelection() {
  const [isLoading, setIsLoading] = useState(false)
  const [products, setProducts] = useState([])

  useEffect(() => {
    setIsLoading(true)
    fetchProducts()
      .then(setProducts)
      .finally(() => setIsLoading(false))
  }, [])

  // Empty state: No products loaded yet
  if (isLoading && products.length === 0) {
    return <LoadingSkeleton />
  }

  // Loading state: Data is updating
  if (isLoading) {
    return (
      <>
        <ProductGrid products={products} isLoading={true} />
        <BottomLoadingIndicator />
      </>
    )
  }

  // Loaded state: Display full UI
  return <ProductGrid products={products} />
}
```

---

## Offline Mode Best Practices

### Checking Offline Status

```typescript
function SmartComponent() {
  const { isOnline } = useSyncStore()

  // Option 1: Pass offline status to component
  return <Component isOffline={!isOnline} />

  // Option 2: Adapt behavior based on connectivity
  if (!isOnline) {
    return <OfflineComponent />
  }
  return <OnlineComponent />

  // Option 3: Show warning when attempting online-only operation
  const handlePayWithCard = async () => {
    if (!isOnline) {
      showError('Card payments require internet connection')
      return
    }
    // Proceed with payment
  }
}
```

### Queuing Operations Offline

```typescript
export function OrderConfirmOfflineSafe(props) {
  const { isOnline } = useSyncStore()
  const { addToQueue } = useSyncStore()

  const handleConfirm = async () => {
    if (isOnline) {
      // Submit immediately
      await api.orders.create(props.order)
    } else {
      // Queue for sync
      addToQueue({
        type: 'create',
        entity_type: 'order',
        data: props.order,
        timestamp: new Date()
      })
      
      // Show user feedback
      showNotification({
        type: 'info',
        message: 'Order saved. Will sync when online.',
        duration: 3000
      })

      // Trigger complete callback
      props.onComplete?.({ queued: true })
    }
  }

  return (
    <OrderConfirm
      {...props}
      isOffline={!isOnline}
      onComplete={handleConfirm}
    />
  )
}
```

---

## Testing with BaseComponentProps

### Test Template

```typescript
describe('Component with BaseComponentProps', () => {
  // Test onComplete callback
  it('calls onComplete with data when action finishes', async () => {
    const onComplete = jest.fn()
    render(<Component onComplete={onComplete} />)

    // Trigger completion
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

    expect(onComplete).toHaveBeenCalledWith(expectedData)
  })

  // Test onBack callback
  it('calls onBack when user clicks back', () => {
    const onBack = jest.fn()
    render(<Component onBack={onBack} />)

    fireEvent.click(screen.getByRole('button', { name: /back/i }))

    expect(onBack).toHaveBeenCalled()
  })

  // Test onError callback
  it('calls onError when operation fails', async () => {
    const onError = jest.fn()
    const { rerender } = render(
      <Component onError={onError} />
    )

    // Simulate error
    rerender(<Component onError={onError} />)
    // Trigger error condition

    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  // Test isLoading state
  it('shows loading indicator when isLoading true', () => {
    const { rerender } = render(<Component isLoading={false} />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()

    rerender(<Component isLoading={true} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  // Test isDisabled state
  it('disables buttons when isDisabled true', () => {
    const { rerender } = render(<Component isDisabled={false} />)
    expect(screen.getByRole('button')).not.toBeDisabled()

    rerender(<Component isDisabled={true} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  // Test offline mode
  it('works offline', () => {
    render(<Component isOffline={true} />)
    // Verify offline behavior
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })

  // Test accessibility
  it('has proper ARIA labels', () => {
    render(<Component ariaLabel="Test component" />)
    expect(screen.getByRole('region', { name: /test component/i }))
      .toBeInTheDocument()
  })

  // Test testId
  it('has testId for test automation', () => {
    const { container } = render(<Component testId="my-component" />)
    expect(container.querySelector('[data-testid="my-component"]'))
      .toBeInTheDocument()
  })
})
```

---

## Common Mistakes to Avoid

### ❌ Not handling onComplete return value

```typescript
// Wrong: onComplete might not be defined
function ProductGrid({ onComplete }: ProductGridProps) {
  return (
    <button onClick={() => onComplete(data)}>
      Select
    </button>
  )
}

// Right: Check if callback exists
function ProductGrid({ onComplete }: ProductGridProps) {
  return (
    <button onClick={() => onComplete?.(data)}>
      Select
    </button>
  )
}
```

### ❌ Not respecting isDisabled state

```typescript
// Wrong: Still allows click even when disabled
<button onClick={handleClick}>Click me</button>

// Right: Disable interaction when isDisabled true
<button
  onClick={handleClick}
  disabled={isDisabled}
  style={{ opacity: isDisabled ? 0.5 : 1 }}
>
  Click me
</button>
```

### ❌ Ignoring offline mode

```typescript
// Wrong: Always tries to make API call
const handleSubmit = async () => {
  await api.submit(data)
}

// Right: Queue when offline
const handleSubmit = async () => {
  if (isOnline) {
    await api.submit(data)
  } else {
    addToQueue({ type: 'submit', data })
  }
}
```

---

## Summary

**BaseComponentProps provides:**
- ✅ Consistent callback patterns (`onComplete`, `onBack`, `onError`)
- ✅ State management (`isLoading`, `isDisabled`, `isOffline`)
- ✅ Accessibility features (`testId`, `ariaLabel`)
- ✅ Offline-first support

**When creating components:**
1. Always extend `BaseComponentProps`
2. Respect all callback properties
3. Handle all state properties
4. Test all state combinations
5. Support offline mode where possible

---

## Next Steps

- [Component Registry](./REGISTRY.md)
- [Custom Hooks Guide](./hooks.md)
- [Component Development](./component-development.md)
- [API Integration](../api/ENDPOINTS.md)
