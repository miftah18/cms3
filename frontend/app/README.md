# App Router — Pages & Layouts

Semua halaman menggunakan Next.js 14 App Router. Route dibagi menjadi 2 grup: `(auth)` dan `(tenant)`.

## Route Structure

```
app/
├── middleware.ts              ← Edge: domain inject + auth guard
├── layout.tsx                 ← Root: html, body, font, global providers
├── (auth)/                    ← Tidak butuh sidebar/nav
│   ├── login/
│   │   └── page.tsx           ← Form login email+password
│   └── pin/
│       └── page.tsx           ← PIN entry untuk re-auth cepat (offline)
└── (tenant)/                  ← Semua halaman butuh auth + tenant context
    ├── layout.tsx             ← Sidebar/BottomNav + OfflineBanner + SyncStatus
    ├── pos/
    │   └── page.tsx           ← POS utama — FlowRenderer render flow dari schema
    ├── dashboard/
    │   └── page.tsx           ← Dashboard: MetricCards + Charts
    ├── products/
    │   ├── page.tsx           ← List produk + search + filter
    │   └── [id]/page.tsx      ← Detail/edit produk
    ├── stock/
    │   └── page.tsx           ← Stok per cabang + adjust form
    ├── reports/
    │   ├── page.tsx           ← Pilih jenis laporan
    │   ├── daily/page.tsx     ← Laporan harian
    │   └── shift/
    │       └── [id]/page.tsx  ← Z-Report per shift
    ├── settings/
    │   └── page.tsx           ← Konfigurasi tenant (Tenant Admin+)
    └── notifications/
        └── page.tsx           ← Daftar notifikasi
```

## Tenant Layout

```typescript
// app/(tenant)/layout.tsx
import { FlowProvider } from '@/lib/store/flowStore'
import { SyncProvider } from '@/lib/sync/SyncProvider'
import { OfflineBanner } from '@/components/registry/layout/OfflineBanner'
import { UISchemaRenderer } from '@/components/registry/UISchemaRenderer'

export default async function TenantLayout({ children }) {
  // Ambil UI schema dari server (cached)
  const uiSchema = await fetchUISchema()

  return (
    <FlowProvider>
      <SyncProvider>
        <UISchemaRenderer schema={uiSchema}>
          <OfflineBanner />
          {children}
        </UISchemaRenderer>
      </SyncProvider>
    </FlowProvider>
  )
}
```

## POS Page

```typescript
// app/(tenant)/pos/page.tsx
'use client'
import FlowRenderer from '@/components/registry/FlowRenderer'
import { useFlowStore } from '@/lib/store/flowStore'
import { useEffect } from 'react'
import { apiClient } from '@/lib/api/client'

export default function POSPage() {
  const { setSchema, schema } = useFlowStore()

  useEffect(() => {
    // Ambil flow schema dari server (atau dari IndexedDB cache jika offline)
    apiClient.get('/flow/schema/').then(data => setSchema(data))
  }, [])

  if (!schema) return <LoadingSkeleton type="form" />

  return (
    <div className="flex flex-col h-screen">
      <FlowRenderer />
    </div>
  )
}
```

## Dashboard Page

```typescript
// app/(tenant)/dashboard/page.tsx
'use client'
import { ComponentRegistry } from '@/components/registry'

export default function DashboardPage() {
  // UI schema dikontrol server — layout dan komponen dari JSON
  const { uiSchema } = useUISchema('dashboard')

  return (
    <div className="grid gap-4 p-4">
      {uiSchema.sections.map(section => (
        <section key={section.id}>
          <h2>{section.label}</h2>
          <div className={`grid grid-cols-${section.columns}`}>
            {section.components.map(comp => {
              const Component = ComponentRegistry.resolve(comp.code)
              return Component ? <Component key={comp.id} {...comp.props} /> : null
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
```

## FlowRenderer (Inti POS)

```typescript
// components/registry/FlowRenderer.tsx
'use client'
import { useFlowStore } from '@/lib/store/flowStore'
import { useSyncStore } from '@/lib/store/syncStore'
import { ComponentRegistry } from './index'
import { eventBus } from '@/lib/events/bus'
import { StepWizard } from './navigation/StepWizard'
import { ErrorBoundary } from './layout/ErrorBoundary'
import { useEffect } from 'react'

export default function FlowRenderer() {
  const { schema, currentStepIndex, nextStep, prevStep, setStepData } = useFlowStore()
  const { isOnline } = useSyncStore()

  const currentStep = schema?.transaction_flow[currentStepIndex]

  useEffect(() => {
    if (!currentStep) return

    // Subscribe ke event completion step ini
    const eventName = currentStep.on_complete.replace('emit:', '')
    const handler = (data: any) => {
      setStepData(currentStep.key, data)
      nextStep()
    }

    eventBus.on(eventName, handler)
    return () => eventBus.off(eventName, handler)
  }, [currentStep?.key])

  if (!schema || !currentStep) return <LoadingSkeleton type="form" />

  const Component = ComponentRegistry.resolve(currentStep.component)
  if (!Component) {
    return <div className="p-4 text-red-500">Komponen tidak ditemukan: {currentStep.component}</div>
  }

  return (
    <div className="flex flex-col h-full">
      <StepWizard
        steps={schema.transaction_flow.map(s => s.label)}
        currentStep={currentStepIndex}
      />
      <div className="flex-1 overflow-auto p-4">
        <ErrorBoundary>
          <Component
            {...currentStep.props}
            isOffline={!isOnline}
            onBack={currentStep.can_go_back ? prevStep : undefined}
          />
        </ErrorBoundary>
      </div>
    </div>
  )
}
```
