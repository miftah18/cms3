# Database Schema

Platform menggunakan **PostgreSQL dengan schema separation per tenant**. Schema `public` berisi data global, setiap tenant punya schema `tenant_{id}` yang terisolasi penuh.

## Daftar Isi

- [Schema Structure](#schema-structure)
- [Schema Public (Global)](#schema-public-global)
- [Schema Tenant](#schema-tenant)
- [Indexes & Performance](#indexes--performance)
- [Row Level Security](#row-level-security)
- [Migration Strategy](#migration-strategy)

---

## Schema Structure

```
PostgreSQL Instance
├── schema: public                    ← Data global, shared semua tenant
│   ├── tenants
│   ├── tenant_domains
│   ├── business_types
│   ├── component_registry
│   └── audit_logs                    ← Append-only, semua tenant
│
├── schema: tenant_abc123             ← Tenant A (terisolasi)
│   ├── users
│   ├── user_sessions
│   ├── branches
│   ├── products
│   ├── product_categories
│   ├── stock
│   ├── stock_adjustments
│   ├── transactions
│   ├── transaction_items
│   ├── payments
│   ├── sync_queue
│   ├── notifications
│   └── shifts
│
└── schema: tenant_def456             ← Tenant B (terisolasi)
    └── ... (struktur sama)
```

---

## Schema Public (Global)

### `tenants`

```sql
CREATE TABLE public.tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,       -- URL-safe identifier
    schema_name     VARCHAR(100) UNIQUE NOT NULL,       -- 'tenant_{id}'
    business_type_id UUID REFERENCES public.business_types(id),
    plan_tier       VARCHAR(50) DEFAULT 'starter',      -- starter|professional|enterprise
    status          VARCHAR(50) DEFAULT 'trial',        -- trial|active|suspended|cancelled
    settings        JSONB DEFAULT '{}',                 -- konfigurasi per tenant
    trial_ends_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- settings JSONB structure:
{
  "branding": {
    "primary_color": "#1A237E",
    "logo_url": "https://cdn.saas.id/logos/...",
    "app_name": "Kedai Kopi Pak Budi"
  },
  "features": {
    "loyalty_points": true,
    "kitchen_display": false,
    "bpjs_integration": false
  },
  "regional": {
    "timezone": "Asia/Jakarta",
    "currency": "IDR",
    "locale": "id-ID"
  }
}
```

### `tenant_domains`

```sql
CREATE TABLE public.tenant_domains (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    domain      VARCHAR(255) UNIQUE NOT NULL,
    is_primary  BOOLEAN DEFAULT false,
    is_custom   BOOLEAN DEFAULT false,          -- custom domain dari tenant
    ssl_status  VARCHAR(50) DEFAULT 'pending',  -- pending|active|failed
    verified_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk lookup domain (hot path — dipanggil setiap request)
CREATE INDEX idx_tenant_domains_domain ON public.tenant_domains(domain);
```

### `business_types`

```sql
CREATE TABLE public.business_types (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code             VARCHAR(100) UNIQUE NOT NULL,  -- 'coffee_shop', 'laundry', dll
    name             VARCHAR(255) NOT NULL,
    icon             VARCHAR(100),
    flow_schema      JSONB NOT NULL,               -- Flow Engine schema
    ui_schema        JSONB DEFAULT '{}',           -- UI layout per screen
    default_settings JSONB DEFAULT '{}',           -- Settings default untuk tenant baru
    version          VARCHAR(20) DEFAULT 'v1',
    is_active        BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### `component_registry`

```sql
CREATE TABLE public.component_registry (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                     VARCHAR(100) UNIQUE NOT NULL,  -- 'product_grid'
    category                 VARCHAR(50) NOT NULL,          -- input|display|action|navigation|layout
    props_schema             JSONB NOT NULL,                -- JSON Schema untuk validasi props
    compatible_business_types TEXT[] DEFAULT '{}',         -- ['coffee_shop', 'retail_store']
    is_active                BOOLEAN DEFAULT true,
    created_at               TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Schema Tenant

Semua tabel berikut ada di dalam schema `tenant_{id}` masing-masing tenant.

### `users`

```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    role          VARCHAR(50) NOT NULL,       -- public|customer|cashier|supervisor|branch_manager|tenant_admin|tenant_owner
    password_hash VARCHAR(255) NOT NULL,
    pin_hash      VARCHAR(255),               -- bcrypt hash, optional
    pin_expires_at TIMESTAMPTZ,
    branch_id     UUID REFERENCES branches(id),
    is_active     BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_branch   ON users(branch_id);
CREATE INDEX idx_users_role     ON users(role);
```

### `user_sessions`

```sql
CREATE TABLE user_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id           VARCHAR(255) NOT NULL,
    device_type         VARCHAR(50),           -- pwa_android|pwa_ios|native_android|native_ios
    refresh_token_hash  VARCHAR(255),
    offline_token_hash  VARCHAR(255),
    offline_token_exp   TIMESTAMPTZ,
    ip_address          INET,
    last_active_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user   ON user_sessions(user_id);
CREATE INDEX idx_sessions_device ON user_sessions(device_id);
```

### `branches`

```sql
CREATE TABLE branches (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_branch_id UUID REFERENCES branches(id),  -- self-referential untuk hierarki
    name             VARCHAR(255) NOT NULL,
    code             VARCHAR(50) UNIQUE NOT NULL,
    address          TEXT,
    phone            VARCHAR(50),
    timezone         VARCHAR(100) DEFAULT 'Asia/Jakarta',
    settings         JSONB DEFAULT '{}',             -- override settings per cabang
    is_active        BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### `products` & `product_categories`

```sql
CREATE TABLE product_categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active  BOOLEAN DEFAULT true
);

CREATE TABLE products (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id   UUID REFERENCES product_categories(id),
    sku           VARCHAR(100) UNIQUE,
    barcode       VARCHAR(100),
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    base_price    NUMERIC(15,2) NOT NULL DEFAULT 0,
    tax_rate      NUMERIC(5,4) DEFAULT 0,       -- 0.11 = 11% PPN
    unit          VARCHAR(50) DEFAULT 'pcs',
    has_variants  BOOLEAN DEFAULT false,
    track_stock   BOOLEAN DEFAULT true,
    image_url     VARCHAR(500),
    metadata      JSONB DEFAULT '{}',            -- data bisnis-spesifik
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()      -- untuk delta sync
);

-- metadata JSONB examples:
-- Dealer: { "color": "Putih", "type": "SUV", "year": 2025, "chassis_no": "..." }
-- Klinik: { "drug_code": "...", "dosage_form": "tablet", "strength": "500mg" }

CREATE INDEX idx_products_sku       ON products(sku);
CREATE INDEX idx_products_barcode   ON products(barcode);
CREATE INDEX idx_products_category  ON products(category_id);
CREATE INDEX idx_products_updated   ON products(updated_at);  -- untuk delta sync
CREATE INDEX idx_products_active    ON products(is_active);
```

### `stock`

```sql
CREATE TABLE stock (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        UUID NOT NULL REFERENCES products(id),
    branch_id         UUID NOT NULL REFERENCES branches(id),
    quantity          NUMERIC(15,4) DEFAULT 0,
    reserved_quantity NUMERIC(15,4) DEFAULT 0,  -- quantity yang sudah di-reserve tapi belum dipotong
    min_quantity      NUMERIC(15,4) DEFAULT 0,  -- threshold alert stok rendah
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, branch_id)
);

CREATE INDEX idx_stock_branch   ON stock(branch_id);
CREATE INDEX idx_stock_product  ON stock(product_id);
CREATE INDEX idx_stock_low      ON stock(quantity, min_quantity)
    WHERE quantity <= min_quantity;             -- partial index untuk alert stok
```

### `transactions`

```sql
CREATE TABLE transactions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id         VARCHAR(255) UNIQUE,        -- UUID dari client, untuk deduplication
    transaction_number VARCHAR(100) UNIQUE,      -- 'TRX-20250601-0042' — human readable
    branch_id        UUID NOT NULL REFERENCES branches(id),
    cashier_id       UUID REFERENCES users(id),
    customer_id      UUID,                       -- optional
    shift_id         UUID REFERENCES shifts(id),
    status           VARCHAR(50) DEFAULT 'completed',
    -- status: pending|completed|cancelled|refunded|conflict
    subtotal         NUMERIC(15,2) DEFAULT 0,
    discount_amount  NUMERIC(15,2) DEFAULT 0,
    tax_amount       NUMERIC(15,2) DEFAULT 0,
    total_amount     NUMERIC(15,2) NOT NULL,
    payment_status   VARCHAR(50) DEFAULT 'paid', -- paid|partial|pending|refunded
    is_offline       BOOLEAN DEFAULT false,      -- true jika dibuat saat offline
    synced_at        TIMESTAMPTZ,                -- kapan berhasil disync
    conflict_data    JSONB,                      -- detail conflict jika ada
    metadata         JSONB DEFAULT '{}',         -- data spesifik bisnis
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tx_branch      ON transactions(branch_id);
CREATE INDEX idx_tx_cashier     ON transactions(cashier_id);
CREATE INDEX idx_tx_status      ON transactions(status);
CREATE INDEX idx_tx_created     ON transactions(created_at);
CREATE INDEX idx_tx_local_id    ON transactions(local_id);    -- untuk dedup check
CREATE INDEX idx_tx_payment     ON transactions(payment_status);
```

### `transaction_items`

```sql
CREATE TABLE transaction_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id     UUID NOT NULL REFERENCES products(id),
    product_name   VARCHAR(255) NOT NULL,  -- snapshot nama saat transaksi
    quantity       NUMERIC(15,4) NOT NULL,
    unit_price     NUMERIC(15,2) NOT NULL, -- snapshot harga saat transaksi
    discount       NUMERIC(15,2) DEFAULT 0,
    subtotal       NUMERIC(15,2) NOT NULL,
    notes          TEXT,
    metadata       JSONB DEFAULT '{}'      -- modifikasi (tanpa gula, tambah es, dll)
);

CREATE INDEX idx_tx_items_tx      ON transaction_items(transaction_id);
CREATE INDEX idx_tx_items_product ON transaction_items(product_id);
```

### `payments`

```sql
CREATE TABLE payments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id   UUID NOT NULL REFERENCES transactions(id),
    method           VARCHAR(50) NOT NULL,  -- cash|midtrans|qris|debit|bpjs|manual
    amount           NUMERIC(15,2) NOT NULL,
    status           VARCHAR(50) DEFAULT 'paid', -- pending|paid|failed|refunded
    gateway          VARCHAR(50),               -- midtrans|stripe|null (untuk cash)
    gateway_tx_id    VARCHAR(255),              -- ID dari payment gateway
    gateway_response JSONB,                     -- raw response dari gateway
    paid_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_tx      ON payments(transaction_id);
CREATE INDEX idx_payments_gateway ON payments(gateway_tx_id);
```

### `sync_queue`

```sql
CREATE TABLE sync_queue (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id        VARCHAR(255) NOT NULL,
    branch_id        UUID NOT NULL REFERENCES branches(id),
    operation        VARCHAR(20) NOT NULL,    -- create|update|delete
    entity_type      VARCHAR(100) NOT NULL,   -- transactions|stock_adjustments|dll
    entity_id        VARCHAR(255) NOT NULL,   -- local_id dari client
    payload          JSONB NOT NULL,
    checksum         VARCHAR(255),            -- HMAC-SHA256
    status           VARCHAR(50) DEFAULT 'pending',
    -- status: pending|processing|synced|conflict|failed
    conflict_data    JSONB,
    retry_count      INTEGER DEFAULT 0,
    synced_at        TIMESTAMPTZ,
    created_at_device TIMESTAMPTZ NOT NULL,   -- waktu di device (bukan server)
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_device   ON sync_queue(device_id);
CREATE INDEX idx_sync_status   ON sync_queue(status);
CREATE INDEX idx_sync_entity   ON sync_queue(entity_type, entity_id);
```

### `shifts`

```sql
CREATE TABLE shifts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     UUID NOT NULL REFERENCES branches(id),
    cashier_id    UUID NOT NULL REFERENCES users(id),
    opening_cash  NUMERIC(15,2) DEFAULT 0,
    closing_cash  NUMERIC(15,2),
    status        VARCHAR(20) DEFAULT 'open',  -- open|closed
    opened_at     TIMESTAMPTZ DEFAULT NOW(),
    closed_at     TIMESTAMPTZ,
    notes         TEXT
);

CREATE INDEX idx_shifts_branch  ON shifts(branch_id);
CREATE INDEX idx_shifts_cashier ON shifts(cashier_id);
CREATE INDEX idx_shifts_status  ON shifts(status);
```

---

## Indexes & Performance

### Query Patterns yang Perlu Index

```sql
-- 1. Domain lookup (dipanggil SETIAP request — paling kritis)
SELECT * FROM public.tenant_domains WHERE domain = $1;
-- → idx_tenant_domains_domain (sudah ada di atas)

-- 2. Product list dengan delta sync
SELECT * FROM products WHERE updated_at > $1 AND is_active = true;
-- → idx_products_updated, idx_products_active

-- 3. Stock check saat transaksi
SELECT * FROM stock WHERE product_id = $1 AND branch_id = $2;
-- → idx_stock_product + idx_stock_branch (UNIQUE constraint sudah cover ini)

-- 4. Transaction list untuk laporan
SELECT * FROM transactions WHERE branch_id = $1 AND created_at BETWEEN $2 AND $3;
-- → Composite index:
CREATE INDEX idx_tx_branch_date ON transactions(branch_id, created_at DESC);

-- 5. Dedup check saat sync
SELECT id FROM transactions WHERE local_id = $1;
-- → idx_tx_local_id
```

---

## Row Level Security

```sql
-- Aktifkan RLS sebagai safety net tambahan
-- (search_path per request adalah primary isolation)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- App user hanya bisa akses data di schema aktif
CREATE POLICY tenant_isolation ON transactions
    USING (true);  -- search_path sudah handle isolation

-- Revoke direct access, wajib lewat app user
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO saas_app_user;
```

---

## Migration Strategy

### Menjalankan Migrasi ke Semua Tenant

```python
# scripts/migrate_all_tenants.py
from django.db import connection
from apps.tenants.models import Tenant

def migrate_all_tenants():
    """Jalankan migrasi ke semua schema tenant aktif."""
    tenants = Tenant.objects.filter(status__in=['active', 'trial'])
    for tenant in tenants:
        with connection.cursor() as cursor:
            cursor.execute(f"SET search_path TO {tenant.schema_name}, public")
        # call_command('migrate', '--database=tenant')
        print(f"Migrated: {tenant.name}")

# Jalankan: python manage.py shell -c "from scripts.migrate_all_tenants import *; migrate_all_tenants()"
```

### Provisioning Schema Tenant Baru

```python
# apps/tenants/provisioner.py
def provision_tenant_schema(tenant: Tenant):
    """Buat schema baru dan jalankan semua migrasi."""
    schema_name = f"tenant_{tenant.id.hex}"
    with connection.cursor() as cursor:
        cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {schema_name}")
        cursor.execute(f"SET search_path TO {schema_name}, public")
    # Jalankan migrasi ke schema baru
    # Target: selesai dalam < 30 detik
```

---

## Referensi Lanjutan

- [Flow Engine Schema](flow-engine.md)
- [Sync Queue Detail](../guides/offline-strategy.md)
- [Schema Migration Guide](../guides/migrations.md)
