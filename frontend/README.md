# Frontend — Next.js 14 PWA

Next.js 14 App Router dengan Server-Driven UI, offline-first strategy, dan Component Registry untuk 8+ jenis bisnis.

## Struktur

```
frontend/
├── app/                           ← Next.js App Router pages
│   ├── middleware.ts               ← Edge Runtime: inject tenant domain
│   ├── layout.tsx                  ← Root layout (fonts, providers)
│   ├── (auth)/                     ← Auth routes (tidak butuh tenant layout)
│   │   ├── login/page.tsx
│   │   └── pin/page.tsx
│   └── (tenant)/                   ← Tenant routes (butuh auth + tenant context)
│       ├── layout.tsx              ← Tenant layout: sidebar/nav + OfflineBanner
│       ├── pos/page.tsx            ← POS / FlowRenderer
│       ├── dashboard/page.tsx      ← Dashboard: metric cards + chart
│       ├── products/page.tsx       ← Product management
│       ├── stock/page.tsx          ← Stock management
│       ├── reports/page.tsx        ← Laporan
│       ├── settings/page.tsx       ← Konfigurasi tenant
│       └── notifications/page.tsx  ← Daftar notifikasi
├── components/
│   ├── registry/                   ← 52 komponen dari Component Registry
│   │   ├── index.ts                ← Map kode → komponen
│   │   ├── types.ts                ← BaseComponentProps
│   │   ├── FlowRenderer.tsx        ← Core: render flow dari schema
│   │   ├── inputs/                 ← 18 input components
│   │   ├── display/                ← 14 display components
│   │   ├── actions/                ← 10 action components
│   │   ├── navigation/             ← 4 navigation components
│   │   └── layout/                 ← 6 layout components
│   └── shared/                     ← Komponen non-registry yang di-share
├── lib/
│   ├── api/                        ← Axios client + endpoint functions
│   ├── hooks/                      ← Custom React hooks
│   ├── store/                      ← Zustand stores
│   ├── sync/                       ← SyncManager + IndexedDB
│   ├── events/                     ← mitt event bus
│   └── security/                   ← Schema validator (cegah injection)
├── public/
│   ├── sw.js                       ← Service Worker (offline caching)
│   ├── manifest.json               ← PWA manifest
│   └── icons/                      ← App icons semua ukuran
├── next.config.ts                  ← Next.js config (PWA, headers, env)
├── tailwind.config.ts
└── tsconfig.json
```

## Setup Development

```bash
cd frontend
cp .env.local.example .env.local   # Isi API URL, keys, dll

npm install
npm run dev

# Akses multi-tenant di local:
# Tambah di /etc/hosts:
# 127.0.0.1 demo-coffee.localhost
# 127.0.0.1 demo-laundry.localhost

# Buka:
# http://demo-coffee.localhost:3000   → Coffee Shop
# http://demo-laundry.localhost:3000  → Laundry
```

## Environment Variables (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxx
NEXT_PUBLIC_SYNC_SECRET=your-hmac-secret-minimum-32-chars
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
NEXT_PUBLIC_ENV=development
```

## next.config.ts

```typescript
// next.config.ts
import withPWA from 'next-pwa'

const config = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https?.*(\/api\/v1\/flow\/schema)/,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'flow-schema', expiration: { maxAgeSeconds: 3600 } },
    },
    {
      urlPattern: /^https?.*(\/api\/v1\/products)/,
      handler: 'NetworkFirst',
      options: { cacheName: 'products', networkTimeoutSeconds: 3 },
    },
  ],
})({
  experimental: { serverActions: { allowedOrigins: ['*.saas.id'] } },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    },
  ],
})

export default config
```

## middleware.ts (Edge Runtime)

```typescript
// app/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''

  // Inject domain ke header untuk backend
  const response = NextResponse.next()
  response.headers.set('x-tenant-domain', hostname)

  // Auth check — redirect ke login jika tidak ada token
  const token = request.cookies.get('access_token')
  const isAuthPage = request.nextUrl.pathname.startsWith('/login')

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/pos', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest).*)'],
}
```

## Testing

```bash
# Unit tests (Jest + React Testing Library)
npm test

# E2E tests (Playwright)
npx playwright test

# E2E dengan UI
npx playwright test --ui

# Coverage
npm test -- --coverage
```

## Build & Deploy

```bash
# Build production
npm run build

# Analyze bundle size
ANALYZE=true npm run build

# Start production server
npm start
```

## Referensi

- [App Router Pages](app/README.md)
- [Component Registry](components/registry/README.md)
- [API Client](lib/api/README.md)
- [Event Bus](lib/events/README.md)
- [Hooks](lib/hooks/README.md)
- [Security](lib/security/README.md)
