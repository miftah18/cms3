# Frontend Setup Guide

This document describes the frontend project structure and how to get started with development.

## Project Structure

```
frontend/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout with providers
│   ├── globals.css              # Global styles with design tokens
│   ├── (auth)/                  # Auth route group
│   │   ├── login/               # Login page
│   │   └── pin/                 # PIN setup/validation
│   └── (tenant)/                # Tenant route group (authenticated)
│       ├── pos/                 # POS dashboard
│       ├── products/            # Product management
│       ├── transactions/        # Transaction history
│       ├── reports/             # Reports & Analytics
│       └── settings/            # Settings
│
├── components/                   # React components
│   ├── auth/                    # Auth components
│   │   ├── LoginForm.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── AuthInitializer.tsx
│   │   └── SessionManager.tsx
│   ├── layout/                  # Layout components
│   │   ├── OfflineBanner.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   ├── ui/                      # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Table.tsx
│   │   ├── Form.tsx
│   │   └── ...
│   ├── features/                # Feature-specific components
│   │   ├── products/
│   │   ├── transactions/
│   │   ├── reports/
│   │   └── ...
│   └── providers.tsx            # Root providers wrapper
│
├── lib/                         # Utilities and helpers
│   ├── api/                     # API client & endpoints
│   │   ├── client.ts           # Axios instance with interceptors
│   │   ├── types.ts            # API type definitions
│   │   └── endpoints/
│   │       ├── auth.ts
│   │       ├── products.ts
│   │       ├── transactions.ts
│   │       └── ...
│   ├── auth/                    # Auth utilities
│   │   ├── tokenManager.ts     # JWT token utilities
│   │   └── permission.ts       # Permission checking
│   ├── store/                   # Zustand stores
│   │   ├── authStore.ts        # Auth state management
│   │   ├── uiStore.ts          # UI state (modals, etc)
│   │   └── ...
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.ts          # Auth hook
│   │   ├── useNetworkStatus.ts # Network status
│   │   ├── useOfflineData.ts   # Offline data access
│   │   ├── useSyncStore.ts     # Sync management
│   │   └── ...
│   ├── providers/               # Context providers
│   │   ├── NetworkStatusProvider.tsx
│   │   └── SyncProvider.tsx
│   ├── utils/                   # Utility functions
│   │   ├── cn.ts               # Class merging (clsx + tailwind-merge)
│   │   ├── device.ts           # Device fingerprinting
│   │   ├── date.ts             # Date utilities
│   │   ├── currency.ts         # Currency formatting
│   │   └── ...
│   └── db/                      # IndexedDB helpers
│       └── offline.ts          # Offline database utilities
│
├── types/                       # TypeScript type definitions
│   ├── auth.ts
│   ├── components.ts           # Component prop types
│   └── domain.ts               # Domain-specific types
│
├── styles/                      # Additional stylesheets
│   ├── animations.css
│   └── components.css
│
├── public/                      # Static assets
│   ├── logo.svg
│   ├── favicon.ico
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service Worker
│
├── __tests__/                   # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.example                 # Environment variables template
├── tsconfig.json               # TypeScript configuration
├── next.config.js              # Next.js configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── postcss.config.js           # PostCSS configuration
├── jest.config.js              # Jest testing configuration
├── .eslintrc.json             # ESLint configuration
├── .prettierrc.json           # Prettier configuration
└── package.json               # Dependencies and scripts
```

## Installation & Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
# or
yarn install
# or
pnpm install
```

### 2. Setup Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and set the correct values:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_TIMEOUT=30000
NEXT_PUBLIC_ENABLE_OFFLINE=true
NEXT_PUBLIC_ENABLE_PWA=true
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production

```bash
npm run build
npm start
```

## Key Features Implemented

### ✅ Authentication
- **JWT-based authentication** with access/refresh tokens
- **Multi-device sessions** tracking
- **PIN-based offline access** for trusted devices
- **Token refresh** interceptor with auto-refresh on 401
- **Permission checking** utilities (roles & permissions)

### ✅ State Management
- **Zustand** for global state (auth, UI, sync)
- **Zustand persist** middleware for localStorage
- **Selective persistence** to avoid storing sensitive data

### ✅ API Layer
- **Axios client** with interceptors
- **Request/response** transformation
- **Error normalization** for consistent error handling
- **Auto-auth** token injection
- **Device ID** tracking for multi-device support

### ✅ Offline Support
- **IndexedDB** for offline data storage
- **Service Worker** for background sync
- **Network status** detection and UI feedback
- **Offline-first** architecture ready

### ✅ Styling
- **Tailwind CSS** with custom design tokens
- **CSS variables** for theming
- **Dark mode** support with media queries
- **Accessibility** utilities (ARIA, focus states)
- **Responsive design** with mobile-first approach

### ✅ Development Tools
- **TypeScript** with strict mode
- **ESLint** for code quality
- **Prettier** for code formatting
- **Jest** for unit testing
- **Testing Library** for component testing

## Development Workflow

### 1. Creating a New Component

```typescript
// components/MyComponent.tsx
import { ReactNode } from 'react'

interface MyComponentProps {
  children: ReactNode
  variant?: 'primary' | 'secondary'
}

export function MyComponent({ children, variant = 'primary' }: MyComponentProps) {
  return (
    <div className={`my-component my-component--${variant}`}>
      {children}
    </div>
  )
}
```

### 2. Using Hooks

```typescript
// In a component
'use client'

import { useAuth } from '@/lib/hooks/useAuth'

export function MyPage() {
  const { user, isAuthenticated, login } = useAuth()

  if (!isAuthenticated) {
    return <div>Please login</div>
  }

  return <div>Welcome {user?.email}</div>
}
```

### 3. API Calls

```typescript
'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api/client'

export function MyComponent() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient
      .get('/products')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div>Loading...</div>
  return <div>{JSON.stringify(data)}</div>
}
```

### 4. Using Zustand Store

```typescript
'use client'

import { useAuthStore } from '@/lib/store/authStore'

export function MyComponent() {
  const { user, login, logout } = useAuthStore()

  return (
    <div>
      {user ? (
        <>
          <p>Welcome {user.email}</p>
          <button onClick={() => logout()}>Logout</button>
        </>
      ) : (
        <button onClick={() => login('user@example.com', 'password')}>
          Login
        </button>
      )}
    </div>
  )
}
```

## Available Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm start            # Run production build
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run type-check   # Type check with TypeScript

# Testing
npm test             # Run tests once
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

## Architecture Decisions

### Why Zustand for State Management?
- Lightweight compared to Redux
- No boilerplate required
- Built-in middleware support
- Persist plugin for localStorage
- Great TypeScript support

### Why Axios Instead of Fetch?
- Built-in request/response interceptors
- Request cancellation support
- Timeout configuration
- Response transformation
- Error handling

### Why IndexedDB for Offline Storage?
- Larger storage capacity than localStorage
- Asynchronous API (doesn't block UI)
- Good performance for structured data
- Supports complex queries with indexes
- Better for offline-first architecture

## Routing

The app uses Next.js App Router with route groups:

- **`(auth)`** - Public routes (login, PIN)
- **`(tenant)`** - Protected tenant routes

Protected routes automatically redirect to `/login` if not authenticated via the `ProtectedRoute` component.

## Styling Guide

All components use Tailwind CSS with custom design tokens. Colors are defined as CSS variables for easy theming:

```css
/* In globals.css */
--primary: 262 100% 60%;
--background: 0 0% 100%;
--border: 0 0% 89.8%;
```

Use these in Tailwind classes:

```jsx
<div className="bg-primary text-primary-foreground">
  Primary button
</div>
```

## Performance Optimization

1. **Code Splitting** - Next.js automatically splits code per route
2. **Image Optimization** - Next.js `Image` component
3. **CSS Optimization** - Tailwind purges unused styles
4. **Tree Shaking** - Unused code is removed during build
5. **Caching** - Service Worker caches static assets

## Troubleshooting

### CORS Errors
- Ensure backend CORS is configured to accept frontend origin
- Check `NEXT_PUBLIC_API_URL` matches backend URL

### Token Refresh Not Working
- Check refresh token exists in localStorage
- Verify refresh endpoint returns valid token
- Check token claims in JWT debugger

### Offline Mode Not Working
- Ensure Service Worker is registered
- Check browser IndexedDB is enabled
- Verify `NEXT_PUBLIC_ENABLE_OFFLINE=true`

### TypeScript Errors
```bash
npm run type-check  # Check all types
```

## Next Steps

1. **Create additional pages** in `app/(tenant)/` directory
2. **Build components** in `components/features/` for specific domains
3. **Add more API endpoints** in `lib/api/endpoints/`
4. **Create custom hooks** for complex logic in `lib/hooks/`
5. **Add tests** in `__tests__/` directory
6. **Configure PWA** manifest and service worker

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Zustand](https://github.com/pmndrs/zustand)
- [TypeScript](https://www.typescriptlang.org)

## Support

For issues or questions:
1. Check existing documentation in `/docs` folder
2. Review integration guides in `/docs/guides/`
3. Check component registry in `/docs/components/`
4. Contact the development team
