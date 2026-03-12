# Arsitektur Sistem

Dokumen ini menjelaskan keseluruhan arsitektur platform — mulai dari keputusan desain tingkat tinggi hingga detail implementasi setiap layer.

## Daftar Isi

- [Prinsip Desain](#prinsip-desain)
- [System Overview](#system-overview)
- [Layer Architecture](#layer-architecture)
- [Multi-Tenant Strategy](#multi-tenant-strategy)
- [Server-Driven UI](#server-driven-ui)
- [Offline-First Strategy](#offline-first-strategy)
- [Event-Driven Architecture](#event-driven-architecture)
- [Data Flow](#data-flow)

---

## Prinsip Desain

### 1. Configuration Over Code
Menambah jenis bisnis baru **tidak memerlukan kode baru**. Semua perbedaan dikontrol via JSON schema yang disimpan di database.

### 2. Offline-First
Aplikasi harus **bisa berjalan penuh tanpa internet**. Koneksi internet hanya diperlukan untuk sync, tidak untuk operasi harian.

### 3. Tenant Isolation — Zero Trust
Setiap request **wajib melewati validasi tenant context**. Tidak ada endpoint yang bisa diakses lintas tenant.

### 4. Server-Driven UI
Server mengirim **blueprint UI sebagai JSON**. Client hanya sebagai renderer. Semua logika bisnis dan struktur UI dikontrol server.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET / WAN                           │
└─────────────────────┬──────────────────────────────────────────┘
                      │
┌─────────────────────▼──────────────────────────────────────────┐
│                    CLOUDFLARE                                   │
│  • CDN & edge caching                                           │
│  • WAF (Web Application Firewall)                               │
│  • Multi-domain routing → inject x-tenant-domain header        │
│  • SSL termination semua domain tenant                          │
│  • DDoS protection                                              │
└──────────┬──────────────────────┬──────────────────────────────┘
           │                      │
  ┌────────▼────────┐   ┌─────────▼────────┐
  │  Next.js (PWA)  │   │  Next.js (PWA)   │  ... N tenant
  │  kedai-kopi.id  │   │  laundry-bersih  │
  │                 │   │                  │
  │ • App Router    │   │ • App Router     │
  │ • Service Worker│   │ • Service Worker │
  │ • IndexedDB     │   │ • IndexedDB      │
  └────────┬────────┘   └─────────┬────────┘
           │                      │
           └──────────┬───────────┘
                      │ REST API (JWT)
┌─────────────────────▼──────────────────────────────────────────┐
│                    DJANGO + DRF                                 │
│                                                                 │
│  Middleware stack (per request):                                │
│  1. TenantResolverMiddleware  → domain → tenant_id             │
│  2. SchemaRouterMiddleware    → SET search_path = tenant_{id}  │
│  3. JWTAuthMiddleware         → verify token + load user       │
│  4. PermissionMiddleware      → role-based access check        │
│  5. RateLimitMiddleware       → per-tenant rate limit          │
│  6. SecurityHeadersMiddleware → CSP, HSTS, X-Frame-Options     │
│                                                                 │
│  Apps: core | tenants | flow_engine | products | transactions  │
│         sync | payments | notifications | reports               │
└──────────┬──────────────────────┬──────────────────────────────┘
           │                      │
  ┌────────▼────────┐   ┌─────────▼────────┐
  │   PostgreSQL    │   │      Redis        │
  │                 │   │                   │
  │ schema: public  │   │ • Tenant lookup   │
  │ schema:tenant_1 │   │ • Session cache   │
  │ schema:tenant_2 │   │ • Rate limit      │
  │ schema:tenant_N │   │ • Celery broker   │
  └─────────────────┘   └─────────┬─────────┘
                                   │
                         ┌─────────▼────────┐
                         │  Celery Workers   │
                         │                   │
                         │ • Email (SendGrid) │
                         │ • Notifikasi       │
                         │ • Report generation│
                         │ • Sync processing  │
                         └───────────────────┘
```

---

## Layer Architecture

### Frontend Layer

```
Next.js 14 App Router
├── middleware.ts              ← Edge Runtime: domain → tenant context
├── app/
│   ├── (tenant)/              ← Routes untuk semua tenant
│   │   ├── pos/               ← POS / transaksi
│   │   ├── dashboard/         ← Dashboard
│   │   ├── reports/           ← Laporan
│   │   └── settings/          ← Konfigurasi
│   └── (auth)/                ← Login, PIN
├── components/registry/       ← 52 komponen UI
├── lib/
│   ├── api/client.ts          ← Axios + interceptors
│   ├── hooks/useOfflineData   ← Online/offline data fetching
│   ├── store/                 ← Zustand (flow, auth, sync)
│   ├── sync/syncManager.ts    ← Upload offline queue
│   ├── events/bus.ts          ← mitt event bus
│   └── security/              ← Schema validator
└── public/sw.js               ← Service Worker
```

### Backend Layer

```
Django Project
├── config/
│   ├── settings/
│   │   ├── base.py            ← Settings umum
│   │   ├── development.py     ← Dev overrides
│   │   └── production.py      ← Prod overrides
│   └── urls.py                ← URL routing
└── apps/
    ├── core/                  ← Middleware, utilities, audit log
    ├── tenants/               ← Tenant model, domain, provisioning
    ├── flow_engine/           ← JSON flow parser & validator
    ├── products/              ← Produk, kategori, stok
    ├── transactions/          ← Transaksi, items, shift
    ├── sync/                  ← Delta sync, conflict resolution
    ├── payments/              ← Midtrans, Stripe integration
    ├── notifications/         ← In-app, email, push
    └── reports/               ← Laporan, analytics
```

---

## Multi-Tenant Strategy

### PostgreSQL Schema per Tenant

```sql
-- Schema global (shared)
schema: public
  tables: tenants, tenant_domains, business_types, component_registry

-- Schema per tenant (isolated)
schema: tenant_abc123
  tables: users, branches, products, stock, transactions, sync_queue, ...

schema: tenant_def456
  tables: users, branches, products, ...  -- Data TERPISAH TOTAL
```

### Resolusi Tenant

```
Request masuk → middleware chain:

1. Host: kedai-kopi.saas.id
   └─→ TenantResolverMiddleware
       └─→ SELECT * FROM public.tenant_domains WHERE domain = 'kedai-kopi.saas.id'
       └─→ cache Redis 5 menit
       └─→ request.tenant = <Tenant object>

2. SchemaRouterMiddleware
   └─→ SET search_path TO tenant_abc123, public
   └─→ semua query ORM otomatis ke schema tenant yang benar
```

### Zero Trust Enforcement

Setiap view **wajib** menggunakan decorator `@require_tenant_context`:

```python
@require_tenant_context
@permission_required('pos:write')
def transaction_create(request):
    # request.tenant sudah tervalidasi
    # search_path sudah di-set ke schema yang benar
    pass
```

---

## Server-Driven UI

### Alur

```
1. Client login → dapat access_token

2. Client GET /api/v1/flow/schema/
   └─→ server return JSON schema berdasarkan business_type tenant

3. FlowRenderer (client) baca schema:
   └─→ step 1: komponen "product_grid" dengan props {show_search: true, ...}
   └─→ step 2: komponen "cart_summary" dengan props {allow_qty_edit: true, ...}
   └─→ ...

4. ComponentRegistry map kode → React component
   └─→ "product_grid" → <ProductGrid {...propsFromServer} />

5. Komponen emit event saat selesai:
   └─→ eventBus.emit('ITEMS_SELECTED', { items, total })
   └─→ FlowRenderer tangkap event → advance ke step berikutnya
```

### Keuntungan

- Menambah bisnis baru = 1 JSON file, 0 kode baru
- A/B testing UI tanpa deploy frontend
- Rollback UI instan (ubah JSON di database)
- White-label per tenant (beda UI, logic sama)

---

## Offline-First Strategy

### Apa yang Di-cache

| Data | Cache | TTL |
|------|-------|-----|
| Flow schema | IndexedDB + Cache API | 1 jam |
| Product list | IndexedDB | 6-24 jam (per bisnis) |
| Stock per branch | IndexedDB | 8 jam |
| Promotions | IndexedDB | 8 jam |
| Customer list (tertentu) | IndexedDB | 12-24 jam |

### Apa yang TIDAK Di-cache

- Historical reports & analytics
- Media / gambar produk (service worker cache terbatas)
- Data tenant lain

### Lifecycle Offline Transaction

```
[Kasir buat transaksi saat offline]
        ↓
[Simpan ke IndexedDB dengan status: pending]
        ↓
[local_id = crypto.randomUUID() — untuk deduplication]
        ↓
[OfflineBanner tampil: "3 transaksi belum tersync"]
        ↓
[Internet kembali → SyncManager deteksi online]
        ↓
[Upload batch ke POST /api/v1/sync/delta/]
        ↓
[Server proses — dedup via local_id, cek stok]
        ↓
     ┌──────────┬──────────┐
     ↓          ↓          ↓
  [synced]  [conflict]  [failed]
     ↓          ↓          ↓
[hapus dari  [flag untuk  [retry 3x
 IndexedDB]   manager]    lalu flag]
```

### Leader Election (Multi-Device per Cabang)

```
Tablet A (online pertama) → MASTER
  • Kelola stok lokal
  • Sinkronisasi ke Tablet B, C via HTTP polling lokal

Tablet B, C → REPLICA
  • Query stok ke Master
  • Jika Master mati → election: Tablet B jadi Master baru
```

---

## Event-Driven Architecture

### Event Bus (mitt)

Komponen berkomunikasi melalui event bus, **tidak langsung coupling**:

```typescript
// Emit event saat step selesai
eventBus.emit('ITEMS_SELECTED', { items: cart, totalAmount: 45000 })

// FlowRenderer subscribe dan advance step
eventBus.on('ITEMS_SELECTED', (data) => {
  flowStore.setStepData('select_items', data)
  flowStore.nextStep()
})
```

### Event Types

| Event | Emitted by | Consumed by |
|-------|-----------|-------------|
| `ITEMS_SELECTED` | ProductGrid | FlowRenderer |
| `CART_CONFIRMED` | CartSummary | FlowRenderer |
| `PAYMENT_PROCESSED` | PaymentMethod | FlowRenderer, SyncManager |
| `ORDER_COMPLETE` | OrderConfirm | FlowRenderer, Dashboard |
| `SYNC_STARTED` | SyncManager | OfflineBanner |
| `SYNC_COMPLETE` | SyncManager | OfflineBanner, Dashboard |
| `SYNC_CONFLICT` | SyncManager | ConflictUI, Notifications |
| `STOCK_LOW` | StockAlertList | Notifications |
| `MIDTRANS_INITIATED` | PaymentMethod | MidtransHandler |

---

## Data Flow

### Online Transaction Flow

```
User                Frontend              Backend              DB
 │                     │                     │                  │
 ├─ pilih produk ──────→│                     │                  │
 │                     ├─── GET /products/ ──→│                  │
 │                     │←── [product list] ───┤                  │
 │                     │  (dari Redis cache)  │                  │
 │                     │                     │                  │
 ├─ konfirmasi cart ───→│                     │                  │
 ├─ pilih cash ────────→│                     │                  │
 │                     ├── POST /transactions/→│                 │
 │                     │                     ├─ validate ───────→│
 │                     │                     ├─ calc total       │
 │                     │                     ├─ reduce stock ───→│
 │                     │                     ├─ save tx ────────→│
 │                     │←── [tx created] ────┤                  │
 │←─ tampil struk ─────┤                     │                  │
```

### Offline → Sync Flow

```
[OFFLINE]                    [KEMBALI ONLINE]
    │                              │
    ├─ transaksi #1                ├─ SyncManager.start()
    ├─ transaksi #2                ├─ read IndexedDB queue
    ├─ transaksi #3                ├─ POST /sync/delta/ {queue: [tx1,tx2,tx3]}
    ↓                              ├─ server: dedup + validate + process
[IndexedDB]                        ├─ stok cukup → synced: [tx1, tx2]
  status: pending                  ├─ stok kurang → conflict: [tx3]
                                   ↓
                             [Badge update]
                             "1 conflict perlu direview"
```

---

## Referensi Lanjutan

- [Keputusan Desain (ADR)](decisions.md)
- [Database Schema](../database/README.md)
- [Flow Engine](../database/flow-engine.md)
- [Offline Strategy Detail](../guides/offline-strategy.md)
- [Security Architecture](../security/README.md)
