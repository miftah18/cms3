# Auth Flow Guide

Panduan lengkap alur autentikasi — dari login pertama hingga offline PIN re-auth.

## Alur Login Normal

```
[User]                [Frontend]             [Backend]             [Redis]
   │                      │                      │                     │
   ├─ input email/pass ──→│                      │                     │
   │                      ├─ POST /auth/login/ ─→│                     │
   │                      │                      ├─ verify password     │
   │                      │                      ├─ check tenant status │
   │                      │                      ├─ generate tokens     │
   │                      │                      ├─ save session ──────→│
   │                      │←─ {access, refresh,  │                     │
   │                      │    offline token} ───┤                     │
   │                      ├─ save to authStore    │                     │
   │                      ├─ save offline token   │                     │
   │                      │  ke IndexedDB         │                     │
   │←─ redirect ke /pos ──┤                      │                     │
```

## Token Types

| Token | TTL | Dipakai untuk | Disimpan di |
|-------|-----|---------------|-------------|
| Access Token | 15 menit | API calls saat online | Zustand authStore (memory) |
| Refresh Token | 7 hari | Refresh access token | Secure cookie / IndexedDB |
| Offline Token | 12 jam | API calls terbatas saat offline | IndexedDB |

## Auto-Refresh Access Token

```
Request ke /api/v1/transactions/
      │
      ├─ access_token valid? → Lanjut
      │
      └─ 401 response
            │
            ├─ Coba refresh via POST /auth/refresh/
            │         │
            │    ┌────┴────────────┐
            │    ▼                 ▼
            │  Success         Gagal (refresh expired)
            │    │                 │
            │  Retry request   → Logout → redirect /login
            │  dengan token baru
```

## Offline Token Scope

Offline token hanya boleh digunakan untuk:
- `GET /products/` — baca daftar produk dari cache
- `GET /stock/` — baca stok dari cache
- `POST /transactions/` — buat transaksi (akan di-sync nanti)
- `POST /sync/delta/` — upload offline queue

**Tidak boleh untuk:**
- Perubahan konfigurasi tenant
- Manajemen user
- Laporan real-time
- Refund

## PIN Authentication

```
Setup PIN (online):
  POST /auth/pin/setup/ {pin: "123456"}
  → Server: bcrypt(pin) → simpan ke user.pin_hash
  → Client: tandai di IndexedDB bahwa PIN sudah setup

Verify PIN (bisa offline):
  POST /auth/pin/verify/ {pin: "123456", device_id: "..."}
  Online:  → Backend verify PIN → return access_token baru
  Offline: → Tidak bisa! PIN verify tetap butuh koneksi untuk keamanan
             → Gunakan offline_token yang sudah ada

PIN Expiry:
  - PIN kadaluarsa setelah 8 jam tanpa koneksi
  - Jika device sudah offline > 8 jam → paksa login online
  - PIN otomatis diperbarui setelah sync berhasil
```

## Session Management (Multi-Device)

```
User A login di 3 device:
  - Tablet POS (device_id: dev-001)
  - HP personal (device_id: dev-002)
  - Laptop manager (device_id: dev-003)

Setiap device punya:
  - Refresh token sendiri
  - Offline token sendiri
  - Entry di user_sessions table

Logout dari satu device:
  → Blacklist refresh token device itu saja
  → Device lain tetap login

Logout from all devices (security):
  → Blacklist semua refresh token user ini
  → user.updated_at di-update → semua offline token invalid
```

## Permission System

```
Request: POST /transactions/

1. JWTAuthMiddleware
   └─ Decode access_token
   └─ Load user + permissions dari DB (cached Redis 5 mnt)
   └─ request.user = User(role='cashier', permissions=['pos:read','pos:write'])

2. @permission_required('pos:write')
   └─ Cek: 'pos:write' in request.user.permissions
   └─ 403 jika tidak ada

3. @require_tenant_context
   └─ Cek: request.tenant is not None and request.tenant.is_active
   └─ 403 jika tenant tidak aktif
```

## Permission Matrix Lengkap

| Permission | Cashier | Supervisor | Branch Mgr | Tenant Admin | Tenant Owner |
|-----------|---------|-----------|------------|--------------|--------------|
| `pos:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pos:write` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `refund:write` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `stock:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `stock:write` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `reports:read` | Shift saja | Cabang | Cabang | Semua | Semua |
| `users:write` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `settings:write` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `billing:read` | ❌ | ❌ | ❌ | ❌ | ✅ |
