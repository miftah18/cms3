# Complete API Endpoints Reference

Master index of all API endpoints organized by category.

## 🔐 Authentication & Authorization

Authentication endpoints for login, token management, and session control.

### Core Authentication

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| [`/auth/login/`](#login) | POST | User login, generate tokens | No |
| [`/auth/refresh/`](#refresh-token) | POST | Refresh access token | No |
| [`/auth/logout/`](#logout) | POST | Logout and revoke tokens | No |
| [`/auth/token-status/`](#token-status) | POST | Check token validity and TTL | No |

### Multi-Device Session Management

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| [`/auth/sessions/`](#list-sessions) | GET | List all active user sessions | JWT |
| [`/auth/sessions/{device_id}/`](#get-session-detail) | GET | Get specific session details | JWT |
| [`/auth/sessions/{device_id}/`](#revoke-session) | DELETE | Logout from specific device | JWT |
| [`/auth/sessions/revoke-all/`](#revoke-all-other-sessions) | POST | Logout from all other devices | JWT |
| [`/auth/sessions/terminate-all/`](#terminate-all-sessions) | POST | Logout from all devices | JWT |
| [`/auth/sessions/activity/`](#session-activity) | GET | Get session activity history | JWT |
| [`/auth/sessions/security-check/`](#security-check) | POST | Check for suspicious activity | JWT |

### Offline Authentication

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| [`/auth/offline/token/`](#generate-offline-token) | POST | Generate offline token | JWT |
| [`/auth/offline/validate/`](#validate-offline-token) | POST | Validate offline token | No |
| [`/auth/offline/sync/`](#offline-sync) | POST | Sync when back online | JWT |
| [`/auth/offline/queue-status/`](#offline-queue-status) | GET | Get offline operation queue status | JWT |
| [`/auth/offline/strategy/`](#offline-strategy) | GET | Get offline strategy config | JWT |

## 💳 Products & Inventory

Product catalog, categories, and stock management.

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/products/` | GET | List all products | JWT |
| `/products/` | POST | Create new product | JWT |
| `/products/{id}/` | GET | Get product details | JWT |
| `/products/{id}/` | PUT | Update product | JWT |
| `/products/{id}/` | DELETE | Delete product | JWT |
| `/products/categories/` | GET | List all categories | JWT |
| `/products/categories/` | POST | Create new category | JWT |
| `/products/{id}/stock/` | GET | Get product stock info | JWT |
| `/products/{id}/stock/adjust/` | POST | Adjust product stock | JWT |

## 💰 Transactions & Payment

Transaction management and payment processing.

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/transactions/` | GET | List transactions | JWT |
| `/transactions/` | POST | Create new transaction | JWT |
| `/transactions/{id}/` | GET | Get transaction details | JWT |
| `/transactions/{id}/items/` | GET | Get transaction items | JWT |
| `/transactions/{id}/payments/` | GET | Get transaction payments | JWT |
| `/transactions/{id}/payments/add/` | POST | Add payment to transaction | JWT |
| `/transactions/{id}/finalize/` | POST | Finalize transaction | JWT |
| `/transactions/{id}/void/` | POST | Void/cancel transaction | JWT |

## 📊 Reports & Analytics

Reporting and analytics endpoints.

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/reports/daily/` | GET | Get daily sales report | JWT |
| `/reports/monthly/` | GET | Get monthly sales report | JWT |
| `/reports/product/` | GET | Get product sales report | JWT |
| `/reports/payment-method/` | GET | Get payment method report | JWT |
| `/reports/employee/` | GET | Get employee performance report | JWT |
| `/reports/inventory/` | GET | Get inventory report | JWT |

## 🔔 Notifications

User notifications and alerts.

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/notifications/` | GET | List user notifications | JWT |
| `/notifications/{id}/` | GET | Get notification details | JWT |
| `/notifications/{id}/mark-read/` | POST | Mark notification as read | JWT |
| `/notifications/mark-all-read/` | POST | Mark all notifications as read | JWT |

## 🔄 Sync & Offline

Data synchronization and offline support.

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/sync/delta/` | POST | Sync delta changes | Offline Token |
| `/sync/full/` | POST | Full synchronization | JWT |
| `/sync/status/` | GET | Get sync status | JWT |

## 👥 User & Tenant Management

User accounts and tenant/organization management.

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/users/me/` | GET | Get current user profile | JWT |
| `/users/me/` | PUT | Update user profile | JWT |
| `/users/me/password/` | POST | Change password | JWT |
| `/tenants/` | GET | List user's tenants | JWT |
| `/tenants/` | POST | Create new tenant | JWT |
| `/tenants/{id}/` | GET | Get tenant details | JWT |
| `/tenants/{id}/` | PUT | Update tenant | JWT |
| `/tenants/{id}/settings/` | GET | Get tenant settings | JWT |
| `/tenants/{id}/settings/` | POST | Update tenant settings | JWT |

---

## 📋 Endpoint Details

### Authentication Endpoints

#### <a name="login"></a>Login

**Endpoint:** `POST /auth/login/`

Generate access, refresh, and offline tokens for user login.

**Authentication:** None

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "device_id": "device-uuid",
  "device_type": "web"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "offline_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 900,
  "refresh_expires_in": 604800,
  "offline_expires_in": 43200,
  "token_type": "Bearer",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid credentials or missing fields
- `401 Unauthorized` - Email or password incorrect
- `429 Too Many Requests` - Too many login attempts

**Notes:**
- `access_token` expires in 15 minutes (900 seconds)
- `refresh_token` expires in 7 days (604800 seconds)
- `offline_token` expires in 12 hours (43200 seconds)
- `device_id` uniquely identifies the client (mobile, web, etc.)
- `device_type` can be: web, mobile-ios, mobile-android, desktop

---

#### <a name="refresh-token"></a>Refresh Token

**Endpoint:** `POST /auth/refresh/`

Generate a new access token using refresh token (with automatic token rotation).

**Authentication:** None

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "device_id": "device-uuid"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 900,
  "token_type": "Bearer"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid refresh token format
- `401 Unauthorized` - Refresh token expired or revoked
- `403 Forbidden` - Refresh token invalid

**Notes:**
- Old refresh token is automatically revoked (token rotation)
- Returns new refresh token for next refresh
- Both access and refresh tokens are rotated on each call
- Helps prevent token compromise attacks

---

#### <a name="logout"></a>Logout

**Endpoint:** `POST /auth/logout/`

Revoke tokens and end user session(s).

**Authentication:** None (but refresh_token required)

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "device_id": "device-uuid",
  "logout_all_devices": false
}
```

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid request format

**Notes:**
- If `logout_all_devices` is true, all sessions for user are revoked
- If false, only the current device session is revoked
- Tokens become immediately invalid after logout
- Device sessions are tracked in Redis for fast lookup

---

#### <a name="token-status"></a>Token Status

**Endpoint:** `POST /auth/token-status/`

Check validity and TTL (time-to-live) of tokens without making authenticated requests.

**Authentication:** None

**Request Body:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "offline_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "access_token": {
    "valid": true,
    "expires_in": 850,
    "claims": {
      "user_id": "user-123",
      "tenant_id": "tenant-456",
      "device_id": "device-789",
      "iat": 1704067200,
      "exp": 1704068100
    }
  },
  "refresh_token": {
    "valid": true,
    "expires_in": 604500,
    "revoked": false
  },
  "offline_token": {
    "valid": true,
    "expires_in": 43000
  }
}
```

**Error Responses:**
- None - Always returns 200 OK with validity status

**Notes:**
- Can check any combination of tokens
- Useful for client-side token health monitoring
- Does not consume rate limit quota
- Returns token claims for access_token (for debug purposes)

---

### Session Management Endpoints

#### <a name="list-sessions"></a>List Sessions

**Endpoint:** `GET /auth/sessions/`

List all active sessions for the current user across all devices.

**Authentication:** Bearer JWT (access_token)

**Query Parameters:** None

**Response (200 OK):**
```json
{
  "sessions": [
    {
      "device_id": "device-uuid-1",
      "device_type": "web",
      "device_name": "Chrome on Windows",
      "created_at": "2024-01-01T10:00:00Z",
      "last_activity_at": "2024-01-15T14:30:00Z",
      "is_current_device": true,
      "expires_at": "2024-01-22T10:00:00Z"
    },
    {
      "device_id": "device-uuid-2",
      "device_type": "mobile-ios",
      "device_name": "iPhone",
      "created_at": "2024-01-10T08:15:00Z",
      "last_activity_at": "2024-01-14T16:45:00Z",
      "is_current_device": false,
      "expires_at": "2024-01-17T08:15:00Z"
    }
  ],
  "total": 2
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired access_token

---

#### <a name="get-session-detail"></a>Get Session Detail

**Endpoint:** `GET /auth/sessions/{device_id}/`

Get detailed information about a specific session.

**Authentication:** Bearer JWT (access_token)

**Path Parameters:**
- `device_id` (string, required) - The device ID to retrieve

**Response (200 OK):**
```json
{
  "device_id": "device-uuid",
  "device_type": "web",
  "device_name": "Chrome on Windows",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
  "created_at": "2024-01-01T10:00:00Z",
  "last_activity_at": "2024-01-15T14:30:00Z",
  "is_current_device": true,
  "expires_at": "2024-01-22T10:00:00Z"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired access_token
- `404 Not Found` - Session/device not found

---

#### <a name="revoke-session"></a>Revoke Session

**Endpoint:** `DELETE /auth/sessions/{device_id}/`

Logout from a specific device (revoke session).

**Authentication:** Bearer JWT (access_token)

**Path Parameters:**
- `device_id` (string, required) - The device ID to revoke

**Response (200 OK):**
```json
{
  "message": "Session revoked successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Cannot revoke current session (use logout endpoint)
- `401 Unauthorized` - Invalid or expired access_token
- `404 Not Found` - Session not found
- `500 Internal Server Error` - Failed to revoke session

**Notes:**
- Cannot revoke the current device's session with this endpoint
- Use `/auth/logout/` endpoint to revoke current session
- Revoked session tokens become invalid immediately
- Device is marked as logged out in session manager

---

#### <a name="revoke-all-other-sessions"></a>Revoke All Other Sessions

**Endpoint:** `POST /auth/sessions/revoke-all/`

Logout from all other devices, keeping current session active.

**Authentication:** Bearer JWT (access_token)

**Request Body:** Empty or `{}`

**Response (200 OK):**
```json
{
  "message": "All other sessions revoked successfully",
  "revoked_count": 3
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired access_token
- `500 Internal Server Error` - Failed to revoke sessions

**Notes:**
- Current device session remains active
- Useful for "logout all other devices" feature in settings
- All revoked refresh tokens are added to blacklist
- Takes effect immediately

---

#### <a name="terminate-all-sessions"></a>Terminate All Sessions

**Endpoint:** `POST /auth/sessions/terminate-all/`

Logout from all devices including the current one (full logout).

**Authentication:** Bearer JWT (access_token)

**Request Body:** Empty or `{}`

**Response (200 OK):**
```json
{
  "message": "All sessions terminated successfully",
  "terminated_count": 4
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired access_token
- `500 Internal Server Error` - Failed to terminate sessions

**Notes:**
- Terminates all active sessions for user
- All tokens become invalid immediately
- User must login again from any device
- Useful for security threats or account takeover scenarios

---

#### <a name="session-activity"></a>Session Activity

**Endpoint:** `GET /auth/sessions/activity/`

Get session activity history (login/logout events).

**Authentication:** Bearer JWT (access_token)

**Query Parameters:**
- `limit` (integer, default: 50) - Maximum number of activities to return
- `offset` (integer, default: 0) - Pagination offset

**Response (200 OK):**
```json
{
  "activities": [
    {
      "timestamp": "2024-01-15T14:30:00Z",
      "action": "login",
      "device_id": "device-uuid",
      "device_type": "web",
      "ip_address": "192.168.1.100",
      "status": "success"
    },
    {
      "timestamp": "2024-01-14T22:15:00Z",
      "action": "logout",
      "device_id": "device-uuid",
      "device_type": "mobile-ios",
      "ip_address": "192.168.1.50",
      "status": "success"
    }
  ],
  "total": 150
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired access_token

---

#### <a name="security-check"></a>Security Check

**Endpoint:** `POST /auth/sessions/security-check/`

Check for suspicious session activity (multiple logins, old sessions, etc.).

**Authentication:** Bearer JWT (access_token)

**Request Body:** Empty or `{}`

**Response (200 OK):**
```json
{
  "status": "secure",
  "warnings": [],
  "recommendations": []
}
```

**Response (200 OK - With Warnings):**
```json
{
  "status": "suspicious",
  "warnings": [
    "More than 5 active sessions detected",
    "Current session is older than 1 hour"
  ],
  "recommendations": [
    "Review your sessions and revoke unknown devices",
    "Consider refreshing your token"
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired access_token

**Notes:**
- Returns `suspicious` status if any warnings detected
- Warnings include: too many active sessions, old tokens, unusual activity
- Recommendations suggest action user should take

---

### Offline Authentication Endpoints

#### <a name="generate-offline-token"></a>Generate Offline Token

**Endpoint:** `POST /auth/offline/token/`

Generate an offline token for offline-first operations.

**Authentication:** Bearer JWT (access_token)

**Request Body:**
```json
{
  "device_id": "device-uuid"
}
```

**Response (200 OK):**
```json
{
  "offline_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 43200,
  "allowed_scopes": ["pos:read", "pos:write", "transactions:create"],
  "sync_on_online": true
}
```

**Error Responses:**
- `400 Bad Request` - Invalid request format
- `401 Unauthorized` - Invalid or expired access_token

**Notes:**
- Offline token expires in 12 hours
- Contains limited scopes (not all endpoints available)
- Designed to work offline and sync when back online
- All operations are queued and synced later
- Device must have valid offline token cached

---

#### <a name="validate-offline-token"></a>Validate Offline Token

**Endpoint:** `POST /auth/offline/validate/`

Validate an offline token without making authenticated requests.

**Authentication:** None

**Request Body:**
```json
{
  "offline_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "check_endpoint": "/api/v1/transactions/"
}
```

**Response (200 OK):**
```json
{
  "valid": true,
  "expires_in": 43000,
  "allowed_scopes": ["pos:read", "pos:write"],
  "can_access_endpoint": true,
  "reason": null
}
```

**Response (200 OK - Invalid Token):**
```json
{
  "valid": false,
  "reason": "Invalid token format"
}
```

**Error Responses:**
- `400 Bad Request` - offline_token is required

**Notes:**
- Optional `check_endpoint` validates if token can access specific endpoint
- Returns reason if endpoint cannot be accessed offline
- Useful for client-side validation before queuing operations

---

#### <a name="offline-sync"></a>Offline Sync

**Endpoint:** `POST /auth/offline/sync/`

Sync offline operations when device comes back online.

**Authentication:** Bearer JWT (access_token)

**Request Body:**
```json
{
  "offline_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "queued_operations": [
    {
      "type": "create",
      "entity_type": "transaction",
      "entity_id": "txn-123",
      "timestamp": "2024-01-15T12:30:00Z",
      "data": {
        "items": [...],
        "payment_method": "cash",
        "amount": 50000
      }
    },
    {
      "type": "update",
      "entity_type": "product_stock",
      "entity_id": "prod-456",
      "timestamp": "2024-01-15T12:35:00Z",
      "data": {
        "quantity_change": -5
      }
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "status": "synced",
  "new_tokens": {
    "offline_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 43200
  },
  "processed_operations": {
    "total": 5,
    "successful": 4,
    "failed": 1,
    "failed_operations": [
      {
        "entity_id": "txn-456",
        "reason": "Duplicate transaction ID"
      }
    ]
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid offline token
- `401 Unauthorized` - Invalid access_token
- `409 Conflict` - Sync conflict (conflict resolution required)

**Notes:**
- Processes all queued operations in order
- Detects and handles duplicates (idempotent operations)
- Returns new offline token for next offline period
- Failed operations are reported for manual intervention
- Conflicts are handled based on business rules and conflict resolution strategy

---

#### <a name="offline-queue-status"></a>Offline Queue Status

**Endpoint:** `GET /auth/offline/queue-status/`

Get status of offline operation queue and offline token validity.

**Authentication:** Bearer JWT (access_token)

**Query Parameters:**
- `include_operations` (boolean, default: false) - Include queued operations

**Response (200 OK):**
```json
{
  "offline_token_status": {
    "has_valid_token": true,
    "expires_in": 43000
  }
}
```

**Response (200 OK - With Operations):**
```json
{
  "queue_stats": {
    "total_operations": 5,
    "by_type": {
      "create": 3,
      "update": 2,
      "delete": 0
    },
    "by_entity": {
      "transaction": 3,
      "product_stock": 2
    }
  },
  "offline_token_status": {
    "has_valid_token": true,
    "expires_in": 43000
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired access_token

**Notes:**
- Queue statistics are stored in IndexedDB (frontend)
- This endpoint mainly validates offline token status
- Helps determine if sync is needed before going online

---

#### <a name="offline-strategy"></a>Offline Strategy

**Endpoint:** `GET /auth/offline/strategy/`

Get offline strategy configuration for the tenant/business type.

**Authentication:** Bearer JWT (access_token)

**Response (200 OK):**
```json
{
  "strategy": "limited_offline",
  "config": {
    "name": "Limited Offline",
    "description": "Selected features available offline, with required online sync",
    "allowed_endpoints": [
      "/api/v1/transactions/",
      "/api/v1/products/",
      "/api/v1/products/stock/",
      "/api/v1/notifications/"
    ],
    "requires_sync": true,
    "queue_operations": true,
    "max_queue_size": 1000
  },
  "available_strategies": [
    "full_offline",
    "limited_offline",
    "online_only"
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired access_token

**Notes:**
- Different business types may have different strategies
- `full_offline` - All operations work offline
- `limited_offline` - Only specific endpoints available offline
- `online_only` - No offline support (always requires connection)
- Endpoints determine which APIs can be used offline
- `max_queue_size` limits number of queued operations to prevent memory issues

---

## Error Codes

All API errors follow a standard format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": {}
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `invalid_credentials` | 401 | Email or password incorrect |
| `invalid_token` | 401 | Token format invalid or expired |
| `token_revoked` | 401 | Token has been revoked |
| `token_expired` | 401 | Token has expired |
| `invalid_refresh_token` | 401 | Refresh token invalid |
| `offline_token_invalid` | 400 | Offline token invalid or expired |
| `invalid_device_id` | 400 | Device ID missing or invalid |
| `too_many_requests` | 429 | Rate limit exceeded |
| `session_not_found` | 404 | Session/device not found |
| `conflict_resolution_required` | 409 | Sync conflict needs resolution |
| `internal_error` | 500 | Unexpected server error |

---

## Rate Limiting

All endpoints are rate-limited per user:

- **Auth endpoints:** 10 requests per minute
- **Session endpoints:** 30 requests per minute
- **Sync endpoints:** 5 requests per minute
- **All other endpoints:** 100 requests per minute

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067860
```

If rate limit exceeded, API returns `429 Too Many Requests`.

---

## Authentication Header

All authenticated requests require:

```
Authorization: Bearer {access_token}
```

Example:
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  https://api.example.com/auth/sessions/
```

---

## Examples

### Login Flow

```bash
# 1. Login
curl -X POST https://api.example.com/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "device_id": "device-abc123",
    "device_type": "web"
  }'

# Response:
# {
#   "access_token": "eyJ...",
#   "refresh_token": "eyJ...",
#   "offline_token": "eyJ...",
#   ...
# }

# 2. Use access token for API calls
curl -H "Authorization: Bearer eyJ..." \
  https://api.example.com/auth/sessions/

# 3. Refresh when access token expires
curl -X POST https://api.example.com/auth/refresh/ \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "eyJ...",
    "device_id": "device-abc123"
  }'

# 4. Logout
curl -X POST https://api.example.com/auth/logout/ \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "eyJ...",
    "device_id": "device-abc123",
    "logout_all_devices": false
  }'
```

### Offline Flow

```bash
# 1. Generate offline token (when online)
curl -X POST https://api.example.com/auth/offline/token/ \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"device_id": "device-abc123"}'

# Response: {"offline_token": "eyJ...", "expires_in": 43200, ...}

# 2. Go offline, queue operations on client
# (Operations stored in IndexedDB on frontend)

# 3. Come back online, sync operations
curl -X POST https://api.example.com/auth/offline/sync/ \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "offline_token": "eyJ...",
    "queued_operations": [
      {
        "type": "create",
        "entity_type": "transaction",
        "entity_id": "txn-123",
        "timestamp": "2024-01-15T12:30:00Z",
        "data": {...}
      }
    ]
  }'

# Response: {"status": "synced", "processed_operations": {...}}
```

---

## Next Steps

- [JWT Authentication Deep Dive](./jwt-authentication.md)
- [Webhooks Documentation](./webhooks.md)
- [Error Handling Guide](./error-codes.md)
- [Data Models & Schemas](./data-models.md)
