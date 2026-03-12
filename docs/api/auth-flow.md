# API Auth Flow

Dokumentasi teknis alur autentikasi di level API.

## Token Lifecycle

```
Login
  POST /auth/login/
    → 200: { access_token, refresh_token, offline_token }

Normal Request (access valid)
  GET /products/
    Authorization: Bearer {access_token}
    → 200: data

Access Token Expired (setelah 15 menit)
  GET /products/
    → 401: { code: "AUTH_TOKEN_EXPIRED" }
  POST /auth/refresh/
    { refresh_token }
    → 200: { access_token (baru) }
  GET /products/ [retry]
    Authorization: Bearer {access_token_baru}
    → 200: data

Refresh Token Expired (setelah 7 hari)
  POST /auth/refresh/
    → 401: { code: "AUTH_TOKEN_INVALID" }
  → Client redirect ke /login
```

## JWT Payload Structure

```json
// Access Token
{
  "token_type": "access",
  "exp": 1748835600,
  "iat": 1748834700,
  "jti": "unique-token-id",
  "user_id": "uuid",
  "tenant_id": "uuid",
  "role": "cashier",
  "branch_id": "uuid",
  "permissions": ["pos:read", "pos:write", "stock:read"]
}

// Offline Token (scope terbatas)
{
  "token_type": "offline",
  "exp": 1748877900,
  "iat": 1748834700,
  "jti": "unique-offline-id",
  "user_id": "uuid",
  "tenant_id": "uuid",
  "scope": ["pos:read", "pos:write", "stock:read", "products:read"],
  "device_id": "device-uuid",
  "branch_id": "uuid"
}
```

## Request Headers Wajib

```
# Semua request ke POS endpoint:
Authorization:  Bearer {access_token}
X-Device-ID:    {device-uuid-string}    # Wajib dari POS device
X-Branch-ID:    {branch-uuid}           # Wajib dari kasir

# Optional:
X-Request-ID:   {uuid}                  # Untuk tracing (Nginx men-generate jika tidak ada)
```

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "AUTH_TOKEN_EXPIRED",
    "message": "Token sudah kadaluarsa. Silakan refresh.",
    "details": {
      "expired_at": "2025-06-01T08:15:00Z"
    }
  },
  "timestamp": "2025-06-01T08:30:00Z",
  "request_id": "req-uuid"
}
```

## Endpoint Detail

### POST /auth/login/

```
Rate limit: 10 req/menit per IP
Auth:       Public
```

**Request:**
```json
{
  "email":       "kasir@toko.com",
  "password":    "secret123",
  "device_id":   "550e8400-e29b-41d4-a716-446655440000",
  "device_type": "pwa_android"
}
```

**Response 200:**
```json
{
  "access_token":       "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token":      "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "offline_token":      "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "access_expires_in":  900,
  "offline_expires_in": 43200,
  "user": {
    "id":          "uuid",
    "full_name":   "Budi Santoso",
    "role":        "cashier",
    "branch_id":   "uuid",
    "permissions": ["pos:read", "pos:write", "stock:read"]
  }
}
```

**Error 401:**
```json
{ "error": { "code": "AUTH_INVALID_CREDENTIALS", "message": "Email atau password salah" } }
```

**Error 403:**
```json
{ "error": { "code": "TENANT_INACTIVE", "message": "Akun Anda telah ditangguhkan" } }
```

### POST /auth/refresh/

```
Rate limit: 30 req/menit per IP
Auth:       Public (bawa refresh_token di body)
```

**Request:** `{ "refresh_token": "eyJ..." }`
**Response 200:** `{ "access_token": "eyJ...", "access_expires_in": 900 }`
**Error 401:** `{ "error": { "code": "AUTH_TOKEN_INVALID" } }`

### POST /auth/pin/setup/

```
Auth: Bearer access_token
Permission: (semua user yang sudah login)
```

**Request:**
```json
{ "pin": "123456", "confirm_pin": "123456" }
```
PIN disimpan sebagai `bcrypt(pin, rounds=12)`.

### POST /auth/pin/verify/

```
Rate limit: 5 req/menit per device
Auth:       Public
```

**Request:**
```json
{ "pin": "123456", "device_id": "uuid" }
```

**Response 200:**
```json
{ "access_token": "eyJ...", "access_expires_in": 900 }
```

**Kondisi error:**
- PIN salah 5x berturut-turut → device di-lock 30 menit
- Device tidak terdaftar → 401
- Offline token untuk device ini expired → 401 (paksa online login)
