# API Endpoints Reference

## Auth

### POST /auth/login/
Login dan dapat token. Public endpoint.

**Request:**
```json
{
  "email": "kasir@toko.com",
  "password": "secret123",
  "device_id": "device-uuid",
  "device_type": "pwa_android"
}
```
**Response 200:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "offline_token": "eyJ...",
  "access_expires_in": 900,
  "offline_expires_in": 43200,
  "user": { "id": "uuid", "role": "cashier", "branch_id": "uuid", "permissions": ["pos:read","pos:write"] }
}
```

### POST /auth/refresh/
Refresh access token. Public endpoint.
```json
// Request
{ "refresh_token": "eyJ..." }
// Response 200
{ "access_token": "eyJ...", "access_expires_in": 900 }
```

### POST /auth/pin/setup/
Setup PIN untuk re-auth cepat. Requires auth.
```json
// Request
{ "pin": "123456", "confirm_pin": "123456" }
```

### POST /auth/pin/verify/
Verifikasi PIN — return access token baru. Public endpoint (tapi butuh device_id terdaftar).
```json
// Request
{ "pin": "123456", "device_id": "device-uuid" }
// Response 200
{ "access_token": "eyJ..." }
```

---

## Flow Engine

### GET /flow/schema/
Ambil Flow Engine schema untuk tenant. Response di-cache di client 1 jam.

**Response 200:**
```json
{
  "business_type": "coffee_shop",
  "version": "v1",
  "transaction_flow": [ ... ],
  "business_rules": { ... },
  "offline_strategy": { ... },
  "cache_ttl_seconds": 3600
}
```

### GET /flow/ui/{screen}/
Ambil UI schema untuk screen tertentu. `screen`: dashboard | pos | product_list | reports | settings.

---

## Products

### GET /products/
List produk aktif.

**Query params:**
- `category_id` — filter by kategori
- `search` — full-text search
- `per_page` — max 500 (untuk bulk cache offline)
- `updated_after` — delta sync: ISO 8601 datetime

### GET /products/{id}/
Detail satu produk.

### POST /products/
Buat produk baru. Role: branch_manager+.

### PUT /products/{id}/
Update produk. Role: branch_manager+.

---

## Stock

### GET /stock/
Stok per cabang.

**Query params:**
- `branch_id` *(required)* — ID cabang
- `product_ids` — comma-separated UUIDs
- `low_stock_only` — hanya stok di bawah minimum

### POST /stock/adjust/
Penyesuaian stok manual. Role: branch_manager+.
```json
{
  "branch_id": "uuid",
  "product_id": "uuid",
  "adjustment_type": "add",
  "quantity": 50,
  "reason": "Restock dari supplier",
  "reference_number": "PO-2025-001"
}
```

---

## Transactions

### POST /transactions/
Buat transaksi baru (online mode).
```json
{
  "local_id": "local-uuid",
  "branch_id": "uuid",
  "items": [{ "product_id": "uuid", "quantity": 2, "unit_price": 15000 }],
  "payment_method": "cash",
  "payment_amount": 30000
}
```

### GET /transactions/
List transaksi. Query: `branch_id`, `cashier_id`, `status`, `date_from`, `date_to`, `is_offline`.

### GET /transactions/{id}/
Detail transaksi.

### POST /transactions/{id}/refund/
Refund. Role: supervisor+.
```json
{ "reason": "...", "refund_amount": 15000, "refund_method": "cash" }
```

---

## Offline Sync

### POST /sync/delta/
Upload batch dari offline queue. Core endpoint offline-first.

```json
{
  "device_id": "device-uuid",
  "branch_id": "uuid",
  "checksum": "sha256-hmac-hash",
  "queue": [
    {
      "id": "queue-item-uuid",
      "operation": "create",
      "entity_type": "transactions",
      "entity_id": "local-tx-001",
      "created_at_device": "2025-06-01T08:15:00Z",
      "payload": { "local_id": "local-tx-001", ... }
    }
  ]
}
```

**Response 200:**
```json
{
  "synced": 2,
  "synced_ids": ["item-1", "item-2"],
  "conflicts": [
    {
      "queue_item_id": "item-3",
      "conflict_type": "insufficient_stock",
      "detail": { "product_id": "uuid", "requested": 2, "available": 0 }
    }
  ],
  "failed": []
}
```

### GET /sync/status/
Status sync queue per device. Query: `device_id`.

### POST /sync/resolve-conflict/
Resolve conflict manual. Role: branch_manager+.
```json
{ "conflict_id": "uuid", "resolution": "approve", "notes": "..." }
```

---

## Reports & Shifts

### GET /reports/branch/{branch_id}/daily/
Laporan harian per cabang. Query: `date`, `format` (json|pdf|excel).

### GET /reports/tenant/summary/
Laporan konsolidasi semua cabang. Role: tenant_admin+.

### GET /reports/shift/{shift_id}/
Laporan shift.

### POST /shifts/open/
Buka shift. Wajib sebelum kasir bisa transaksi.
```json
{ "branch_id": "uuid", "opening_cash": 500000 }
```

### POST /shifts/{shift_id}/close/
Tutup shift.
```json
{ "closing_cash": 2340000, "notes": "Sesuai total cash" }
```

---

## Payments

### POST /payments/initiate/
Inisiasi pembayaran Midtrans — return snap token.
```json
{
  "transaction_id": "uuid",
  "payment_gateway": "midtrans",
  "payment_type": "snap"
}
```
**Response:** `{ "snap_token": "...", "snap_redirect_url": "..." }`

### POST /payments/webhook/midtrans/
Webhook dari Midtrans. **Public** — diverifikasi via signature SHA512.

### GET /payments/{payment_id}/status/
Cek status pembayaran setelah redirect dari Midtrans.

---

## Notifications

### GET /notifications/
List notifikasi. Query: `is_read`, `type`, `page`.

### POST /notifications/{id}/read/
Tandai dibaca.

### POST /notifications/read-all/
Tandai semua dibaca.
