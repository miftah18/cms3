# Component Development Guide

This guide covers building reusable, testable components in the CMS3 platform component system.

## Component Architecture

All components in CMS3 extend `BaseComponentProps` and follow a consistent pattern:

```
BaseComponent
  ├── Input Components (18)
  │   ├── TextInput, NumberInput, DateInput, etc.
  │   └── Custom validation, error handling
  ├── Display Components (14)
  │   ├── Table, Card, List, etc.
  │   └── Formatting, pagination, sorting
  ├── Action Components (10)
  │   ├── Button, Modal, Form, etc.
  │   └── User interactions, callbacks
  ├── Navigation Components (4)
  │   ├── Sidebar, Breadcrumb, etc.
  │   └── Route handling
  └── Layout Components (6)
      ├── Container, Grid, Flex, etc.
      └── Responsive behavior
```

## Creating a New Component

### Step 1: Define Component Props

```typescript
// frontend/components/ProductInput/ProductInput.tsx
import { BaseComponentProps } from '@/types/components';

export interface ProductInputProps extends BaseComponentProps {
  /**
   * Product ID to edit (if editing existing product)
   */
  productId?: string;

  /**
   * Callback when product is selected/created
   */
  onProductSelected?: (product: Product) => void;

  /**
   * Whether to allow creating new products inline
   */
  allowCreate?: boolean;

  /**
   * Filter by category
   */
  category?: string;

  /**
   * Business type for filtering products
   */
  businessType?: string;

  /**
   * Show product images
   */
  showImages?: boolean;
}
```

### Step 2: Implement Component

```typescript
// frontend/components/ProductInput/ProductInput.tsx
import React, { useState, useEffect } from 'react';
import { BaseComponentProps } from '@/types/components';

export const ProductInput: React.FC<ProductInputProps> = ({
  // Base props
  id,
  isLoading = false,
  isDisabled = false,
  isOffline = false,
  error,
  onComplete,
  onError,
  onBack,

  // Custom props
  productId,
  onProductSelected,
  allowCreate = false,
  category,
  businessType,
  showImages = true,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch products on mount or category change
  useEffect(() => {
    if (isOffline) {
      // Load from IndexedDB
      loadProductsOffline();
    } else {
      loadProductsFromServer();
    }
  }, [category, businessType, isOffline]);

  const loadProductsFromServer = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(category && { category }),
        ...(businessType && { businessType }),
        ...(searchTerm && { search: searchTerm }),
      });

      const response = await fetch(`/api/products?${params}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load products');
      }

      const data = await response.json();
      setProducts(data.products);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadProductsOffline = async () => {
    setLoading(true);
    try {
      const db = await initOfflineDB();
      const cachedProducts = await db.getAll('products');
      setProducts(cachedProducts);
    } catch (err) {
      console.error('[v0] Error loading offline products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    onProductSelected?.(product);
    onComplete?.({
      value: product.id,
      data: product,
    });
  };

  const handleCreateProduct = async () => {
    // Implementation for creating new product
  };

  if (loading && !products.length) {
    return <div className="loading">Loading products...</div>;
  }

  return (
    <div className={cn('product-input', {
      'is-disabled': isDisabled,
      'is-offline': isOffline,
      'has-error': error,
    })}>
      <label htmlFor={id}>Select Product</label>

      <input
        type="text"
        id={id}
        placeholder="Search products..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        disabled={isDisabled || isLoading}
      />

      {isOffline && (
        <div className="offline-notice">
          Showing cached products. Updates will sync when online.
        </div>
      )}

      <div className="product-list">
        {products.map((product) => (
          <div
            key={product.id}
            className="product-item"
            onClick={() => handleSelectProduct(product)}
          >
            {showImages && (
              <img src={product.image} alt={product.name} />
            )}
            <div className="product-info">
              <h4>{product.name}</h4>
              <p className="sku">SKU: {product.sku}</p>
              <p className="price">${product.price}</p>
            </div>
          </div>
        ))}
      </div>

      {allowCreate && (
        <button onClick={handleCreateProduct} disabled={isDisabled}>
          + Create New Product
        </button>
      )}

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <div className="actions">
        {onBack && (
          <button onClick={onBack} variant="secondary">
            Back
          </button>
        )}
      </div>
    </div>
  );
};

ProductInput.displayName = 'ProductInput';
```

## Component Pattern: Base Props

All components must support these base props:

```typescript
// frontend/types/components.ts
export interface BaseComponentProps {
  /**
   * Unique component instance ID
   */
  id?: string;

  /**
   * Is component in loading state
   */
  isLoading?: boolean;

  /**
   * Is component disabled
   */
  isDisabled?: boolean;

  /**
   * Is component running offline
   */
  isOffline?: boolean;

  /**
   * Error message to display
   */
  error?: string;

  /**
   * Callback when component flow completes
   */
  onComplete?: (data: { value: any; data?: any }) => void;

  /**
   * Callback when error occurs
   */
  onError?: (error: string) => void;

  /**
   * Callback for back navigation
   */
  onBack?: () => void;

  /**
   * CSS class name
   */
  className?: string;

  /**
   * Inline styles
   */
  style?: React.CSSProperties;

  /**
   * Test ID for e2e tests
   */
  testID?: string;

  /**
   * Component variant
   */
  variant?: string;

  /**
   * Component size
   */
  size?: 'sm' | 'md' | 'lg';
}
```

## Component Lifecycle Hooks

### useComponentInit Hook

```typescript
// frontend/hooks/useComponentInit.ts
import { useEffect, useRef } from 'react';

export function useComponentInit(
  componentId: string,
  onInit?: () => void
) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      onInit?.();
      
      // Log component mount for analytics
      console.log(`[v0] Component mounted: ${componentId}`);
    }

    return () => {
      console.log(`[v0] Component unmounted: ${componentId}`);
    };
  }, [componentId, onInit]);
}
```

### useComponentValidation Hook

```typescript
// frontend/hooks/useComponentValidation.ts
import { useState } from 'react';

export interface ValidationRule {
  rule: (value: any) => boolean;
  message: string;
}

export function useComponentValidation(rules: ValidationRule[]) {
  const [error, setError] = useState<string | null>(null);

  const validate = (value: any): boolean => {
    for (const { rule, message } of rules) {
      if (!rule(value)) {
        setError(message);
        return false;
      }
    }
    setError(null);
    return true;
  };

  const clearError = () => setError(null);

  return { error, validate, clearError };
}
```

### useComponentState Hook

```typescript
// frontend/hooks/useComponentState.ts
import { useCallback, useSyncExternalStore } from 'react';
import { createStore } from 'zustand';

export function useComponentState<T>(initialState: T) {
  const storeRef = useCallback(() => {
    return createStore<T>(() => initialState);
  }, [initialState]);

  const subscribe = useCallback((listener: () => void) => {
    const store = storeRef();
    return store.subscribe(listener);
  }, [storeRef]);

  const getSnapshot = useCallback(() => {
    const store = storeRef();
    return store.getState() as T;
  }, [storeRef]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
```

## Styling Components

### Using Tailwind CSS with Design Tokens

```typescript
// frontend/components/Button/Button.tsx
import { cn } from '@/lib/utils';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        // Base styles
        'font-medium rounded transition-colors',
        
        // Size variants
        {
          'px-2 py-1 text-xs': size === 'sm',
          'px-4 py-2 text-sm': size === 'md',
          'px-6 py-3 text-base': size === 'lg',
        },
        
        // Color variants
        {
          'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'primary',
          'bg-secondary text-secondary-foreground hover:bg-secondary/90': variant === 'secondary',
          'bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'destructive',
        },
        
        // Disabled state
        {
          'opacity-50 cursor-not-allowed': disabled,
        }
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
```

### Custom CSS Module

```css
/* frontend/components/ProductCard/ProductCard.module.css */
.card {
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--spacing-4);
  transition: box-shadow 0.2s ease;
}

.card:hover {
  box-shadow: 0 4px 12px var(--shadow);
}

.image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: var(--radius);
  margin-bottom: var(--spacing-4);
}

.title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--foreground);
}

.price {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--primary);
}
```

## Testing Components

### Unit Tests

```typescript
// frontend/__tests__/ProductInput.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductInput } from '@/components/ProductInput';

describe('ProductInput', () => {
  it('renders component', () => {
    render(<ProductInput id="test-1" />);
    expect(screen.getByText('Select Product')).toBeInTheDocument();
  });

  it('loads products on mount', async () => {
    render(<ProductInput id="test-1" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('calls onProductSelected when product is clicked', async () => {
    const onProductSelected = jest.fn();
    
    render(
      <ProductInput
        id="test-1"
        onProductSelected={onProductSelected}
      />
    );

    // Wait for products to load
    await waitFor(() => {
      const firstProduct = screen.getByText('Product 1');
      fireEvent.click(firstProduct);
    });

    expect(onProductSelected).toHaveBeenCalled();
  });

  it('displays error message when loading fails', async () => {
    // Mock API to fail
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        statusText: 'Server Error',
      })
    );

    render(<ProductInput id="test-1" />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('respects isDisabled prop', () => {
    render(<ProductInput id="test-1" isDisabled={true} />);
    const input = screen.getByPlaceholderText(/search/i);
    expect(input).toBeDisabled();
  });

  it('shows offline notice when offline', () => {
    render(<ProductInput id="test-1" isOffline={true} />);
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
// frontend/__tests__/integration/ProductFlow.integration.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductFlow } from '@/flows/ProductFlow';

describe('Product Flow Integration', () => {
  it('complete product selection flow', async () => {
    const onComplete = jest.fn();
    
    render(<ProductFlow onComplete={onComplete} />);

    // Step 1: Search for product
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Product A' } });

    // Wait for search results
    await waitFor(() => {
      expect(screen.getByText('Product A')).toBeInTheDocument();
    });

    // Step 2: Select product
    fireEvent.click(screen.getByText('Product A'));

    // Step 3: Confirm selection
    fireEvent.click(screen.getByText('Select'));

    // Verify completion
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'product-a',
        })
      );
    });
  });
});
```

## Accessibility in Components

```typescript
// frontend/components/Accessible Component.tsx
export function AccessibleInput({
  id,
  label,
  error,
  required,
  ...props
}: AccessibleInputProps) {
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;

  return (
    <div className="input-group">
      <label id={labelId} htmlFor={id} className="label">
        {label}
        {required && <span className="required" aria-label="required">*</span>}
      </label>

      <input
        id={id}
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : descriptionId}
        aria-required={required}
        aria-invalid={!!error}
        {...props}
      />

      {error && (
        <div id={errorId} className="error-message" role="alert">
          {error}
        </div>
      )}

      {props.description && (
        <div id={descriptionId} className="sr-only">
          {props.description}
        </div>
      )}
    </div>
  );
}
```

## Performance Optimization

### Memoization

```typescript
// frontend/components/OptimizedList.tsx
import React, { memo, useCallback, useMemo } from 'react';

const ListItem = memo(({ item, onSelect }: {
  item: any;
  onSelect: (item: any) => void;
}) => {
  console.log('[v0] Rendering ListItem:', item.id);
  
  return (
    <li onClick={() => onSelect(item)}>
      {item.name}
    </li>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memoization
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.onSelect === nextProps.onSelect
  );
});

export function OptimizedList({ items, onSelect }: {
  items: any[];
  onSelect: (item: any) => void;
}) {
  const handleSelect = useCallback((item: any) => {
    console.log('[v0] Item selected:', item.id);
    onSelect(item);
  }, [onSelect]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  return (
    <ul>
      {sortedItems.map(item => (
        <ListItem
          key={item.id}
          item={item}
          onSelect={handleSelect}
        />
      ))}
    </ul>
  );
}
```

### Code Splitting

```typescript
// frontend/components/DynamicComponent.tsx
import { lazy, Suspense } from 'react';

// Lazy load heavy components
const HeavyAnalyticsComponent = lazy(() =>
  import('./HeavyAnalytics').then(module => ({
    default: module.HeavyAnalytics
  }))
);

export function Page() {
  return (
    <div>
      <Suspense fallback={<div>Loading analytics...</div>}>
        <HeavyAnalyticsComponent />
      </Suspense>
    </div>
  );
}
```

## Documentation Template

Every component should have documentation following this pattern:

```typescript
/**
 * ProductInput Component
 * 
 * A reusable component for selecting or creating products with search,
 * filtering, and offline support.
 * 
 * @component
 * @example
 * // Basic usage
 * <ProductInput
 *   id="product-1"
 *   onProductSelected={(product) => console.log(product)}
 * />
 * 
 * @example
 * // With create functionality
 * <ProductInput
 *   id="product-2"
 *   allowCreate
 *   businessType="salon"
 *   onProductSelected={handleSelect}
 * />
 * 
 * @param {ProductInputProps} props - Component props
 * @returns {React.ReactElement} The rendered component
 */
export const ProductInput: React.FC<ProductInputProps> = (props) => {
  // Implementation
};
```

## Component Checklist

- [ ] Extends `BaseComponentProps`
- [ ] Handles `isLoading` state
- [ ] Handles `isDisabled` state
- [ ] Handles `isOffline` state
- [ ] Implements `onComplete` callback
- [ ] Implements `onError` callback
- [ ] Has proper TypeScript types
- [ ] Includes proper error handling
- [ ] Accessible (ARIA labels, roles)
- [ ] Responsive design
- [ ] Unit tests (>80% coverage)
- [ ] Integration tests
- [ ] Performance optimized (memoized)
- [ ] Documentation with examples
- [ ] Storybook stories
- [ ] Error boundary
- [ ] Loading states
- [ ] Offline fallback
- [ ] Proper cleanup in useEffect
- [ ] No console errors/warnings

## Best Practices

1. **Always extend BaseComponentProps**: Consistency across all components
2. **Implement all callbacks**: Users need hooks to respond to changes
3. **Handle offline gracefully**: Show cached data or meaningful message
4. **Validate inputs**: Don't trust external data
5. **Use composition**: Build complex components from simpler ones
6. **Memoize expensive renders**: Use `React.memo` and `useMemo`
7. **Test thoroughly**: Unit + integration + e2e
8. **Document well**: JSDoc, examples, Storybook
9. **Handle errors gracefully**: Never show raw error messages
10. **Follow accessibility standards**: WCAG 2.1 AA minimum

