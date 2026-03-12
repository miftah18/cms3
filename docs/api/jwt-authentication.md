# JWT Authentication API Documentation

## Overview

This document provides comprehensive documentation for the JWT (JSON Web Token) authentication system implemented in the Core Service. The system supports access tokens, refresh tokens, multi-device sessions, and offline token support with claims-based authorization.

## Table of Contents

1. [Architecture](#architecture)
2. [Token Types](#token-types)
3. [Authentication Endpoints](#authentication-endpoints)
4. [Session Management](#session-management)
5. [Offline Support](#offline-support)
6. [Security Features](#security-features)
7. [Client Integration](#client-integration)
8. [Error Handling](#error-handling)

## Architecture

### Components

- **JWT Service**: Core token generation and validation
- **Token Blacklist**: Redis-based token revocation system
- **Session Manager**: Multi-device session tracking
- **Permission Decorators**: Claims-based authorization
- **Offline Support**: Limited-scope offline tokens with sync

### Token Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. POST /auth/login/
       │    (email, password)
       ▼
┌─────────────────────┐
│  Authentication     │ 2. Validate credentials
│  Service            │    Hash check
└──────┬──────────────┘
       │
       │ 3. Generate tokens
       │ - Access (15 min)
       │ - Refresh (7 days)
       │ - JTI tracking
       ▼
┌─────────────────────┐
│  Return Response    │ 4. Send tokens
│  {                  │    (refresh in httpOnly)
│    access_token,    │
│    token_type,      │
│    expires_in       │
│  }                  │
└─────────────────────┘
       │
       │ 5. Store refresh token (httpOnly cookie)
       │    Store access token (localStorage/memory)
       ▼
┌─────────────┐
│   Client    │ Ready to make authenticated requests
└─────────────┘
```

## Token Types

### 1. Access Token

**Purpose**: Short-lived token for API requests (15 minutes)

**Claims**:
```json
{
  "user_id": "uuid",
  "tenant_id": "uuid",
  "role": "admin|user|viewer",
  "permissions": ["read", "write"],
  "device_id": "uuid",
  "jti": "unique_token_id",
  "iat": 1234567890,
  "exp": 1234569690,
  "token_type": "access"
}
```

**Usage**: Include in Authorization header
```
Authorization: Bearer <access_token>
```

### 2. Refresh Token

**Purpose**: Long-lived token for obtaining new access tokens (7 days)

**Claims**:
```json
{
  "user_id": "uuid",
  "tenant_id": "uuid",
  "jti": "unique_token_id",
  "iat": 1234567890,
  "exp": 1234567890 + (7 * 24 * 60 * 60),
  "token_type": "refresh"
}
```

**Storage**: HttpOnly, Secure, SameSite cookie (automatic)

**Rotation**: Automatic on refresh endpoint call

### 3. Offline Token

**Purpose**: Limited-scope token for offline operations (12 hours)

**Claims**:
```json
{
  "user_id": "uuid",
  "tenant_id": "uuid",
  "role": "user",
  "permissions": ["read"],
  "device_id": "uuid",
  "jti": "unique_token_id",
  "iat": 1234567890,
  "exp": 1234567890 + (12 * 60 * 60),
  "token_type": "offline",
  "scope": "offline"
}
```

## Authentication Endpoints

### 1. Login

Create new user session with access and refresh tokens.

**Endpoint**: `POST /api/auth/login/`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "device_name": "iPhone 12 Safari",
  "device_id": "optional-device-id"
}
```

**Success Response** (200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "user"
  },
  "device": {
    "id": "device-uuid",
    "name": "iPhone 12 Safari",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response** (401):
```json
{
  "detail": "Invalid email or password"
}
```

**Security Notes**:
- Refresh token sent as httpOnly cookie (automatic)
- Email is case-insensitive
- Rate limit: 5 attempts per minute per IP
- Tenant-aware login (supports multi-tenancy)

### 2. Refresh Token

Obtain new access token using refresh token.

**Endpoint**: `POST /api/auth/refresh/`

**Request**: 
```
Empty body (refresh token in httpOnly cookie)
```

**Success Response** (200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

**Error Responses**:

401 - Invalid or expired refresh token:
```json
{
  "detail": "Invalid refresh token"
}
```

403 - Token revoked:
```json
{
  "detail": "Token has been revoked"
}
```

**Features**:
- Automatic token rotation (old refresh token invalidated)
- JTI-based revocation tracking
- Per-tenant rate limiting

### 3. Logout

Revoke current session (access & refresh tokens).

**Endpoint**: `POST /api/auth/logout/`

**Request**:
```
Authorization: Bearer <access_token>
Empty body
```

**Success Response** (200):
```json
{
  "message": "Successfully logged out",
  "revoked_token_id": "jti-uuid"
}
```

**Error Response** (401):
```json
{
  "detail": "Invalid or missing token"
}
```

**Features**:
- Revokes all tokens with same JTI
- Updates session last_activity
- Clears refresh token cookie

### 4. Token Status

Check current token and session status.

**Endpoint**: `GET /api/auth/token-status/`

**Request**:
```
Authorization: Bearer <access_token>
```

**Success Response** (200):
```json
{
  "token_valid": true,
  "token_expires_in": 450,
  "user_id": "user-uuid",
  "tenant_id": "tenant-uuid",
  "device_id": "device-uuid",
  "permissions": ["read", "write"],
  "session": {
    "id": "session-uuid",
    "device_name": "iPhone 12 Safari",
    "created_at": "2024-01-15T10:30:00Z",
    "last_activity": "2024-01-15T10:45:00Z",
    "is_active": true
  }
}
```

## Session Management

### List All Sessions

Get all active sessions for current user.

**Endpoint**: `GET /api/auth/sessions/`

**Request**:
```
Authorization: Bearer <access_token>
```

**Success Response** (200):
```json
{
  "count": 3,
  "sessions": [
    {
      "id": "session-uuid-1",
      "device_id": "device-uuid-1",
      "device_name": "iPhone 12 Safari",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2024-01-15T10:30:00Z",
      "last_activity": "2024-01-15T10:45:00Z",
      "is_active": true,
      "is_current": true
    },
    {
      "id": "session-uuid-2",
      "device_id": "device-uuid-2",
      "device_name": "MacBook Pro Chrome",
      "ip_address": "192.168.1.101",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2024-01-14T15:20:00Z",
      "last_activity": "2024-01-14T16:00:00Z",
      "is_active": true,
      "is_current": false
    }
  ]
}
```

### Revoke Specific Session

Logout from specific device.

**Endpoint**: `POST /api/auth/sessions/{session_id}/revoke/`

**Request**:
```
Authorization: Bearer <access_token>
Empty body
```

**Success Response** (200):
```json
{
  "message": "Session revoked successfully",
  "session_id": "session-uuid"
}
```

### Revoke All Sessions

Logout from all devices.

**Endpoint**: `POST /api/auth/sessions/revoke-all/`

**Request**:
```
Authorization: Bearer <access_token>
Empty body
```

**Success Response** (200):
```json
{
  "message": "All sessions revoked successfully",
  "revoked_count": 3
}
```

## Offline Support

### Request Offline Token

Generate offline token for limited offline operations.

**Endpoint**: `POST /api/auth/offline/request-token/`

**Request**:
```json
{
  "scope": "read",
  "duration_hours": 12
}
```

**Success Response** (200):
```json
{
  "offline_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 43200,
  "permissions": ["read"],
  "sync_url": "/api/auth/offline/sync/"
}
```

### Sync Offline Changes

Sync offline changes when reconnected.

**Endpoint**: `POST /api/auth/offline/sync/`

**Request**:
```json
{
  "offline_token": "eyJhbGciOiJIUzI1NiIs...",
  "operations": [
    {
      "type": "create_task",
      "resource": "tasks",
      "data": {
        "title": "Offline task",
        "description": "Created while offline"
      },
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Success Response** (200):
```json
{
  "status": "success",
  "synced_operations": 1,
  "conflicts": [],
  "server_state": {
    "last_sync": "2024-01-15T10:45:00Z",
    "changes": []
  }
}
```

## Security Features

### 1. Token Revocation (Blacklist)

- Redis-backed blacklist system
- JTI (JWT ID) uniqueness tracking
- Automatic expiration cleanup
- Immediate revocation on logout
- Prevents replay attacks

### 2. Claims-Based Authorization

```python
@require_jwt_auth
@require_permissions(['read', 'write'])
@require_roles(['admin', 'user'])
def my_view(request):
    # Access request.user with populated claims
    pass
```

### 3. Token Rotation

- Automatic refresh token rotation
- Old tokens immediately blacklisted
- Prevents stolen token reuse
- Device_id validation

### 4. Rate Limiting

- Per-IP login rate limiting (5/minute)
- Per-tenant refresh rate limiting
- Per-user session limits (default: 5 active sessions)

### 5. Device Tracking

- Device fingerprinting
- Device_id in token claims
- Session per device
- Device revocation support

### 6. Multi-Tenancy

- Tenant_id in claims
- Tenant-isolated sessions
- Tenant-specific rate limits
- Cross-tenant token validation

## Client Integration

### JavaScript/React

```javascript
// Login
const loginResponse = await fetch('/api/auth/login/', {
  method: 'POST',
  credentials: 'include',  // Include cookies
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password'
  })
});

const { access_token } = await loginResponse.json();

// Store access token in memory or sessionStorage
sessionStorage.setItem('access_token', access_token);

// Make authenticated request
const response = await fetch('/api/users/profile/', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
});

// On 401, refresh token
if (response.status === 401) {
  const refreshResponse = await fetch('/api/auth/refresh/', {
    method: 'POST',
    credentials: 'include'
  });
  
  const { access_token } = await refreshResponse.json();
  sessionStorage.setItem('access_token', access_token);
  
  // Retry original request
}

// Logout
await fetch('/api/auth/logout/', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
});

sessionStorage.removeItem('access_token');
```

### HTTP Headers

**Authorization Header**:
```
Authorization: Bearer <access_token>
```

**Device Header** (optional):
```
X-Device-ID: <device-uuid>
```

## Error Handling

### Common Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Continue |
| 400 | Bad request | Check request format |
| 401 | Unauthorized | Refresh token or re-login |
| 403 | Forbidden | Check permissions |
| 429 | Too many requests | Wait before retrying |
| 500 | Server error | Retry or contact support |

### Error Response Format

```json
{
  "detail": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:45:00Z"
}
```

### Common Errors

1. **TokenExpired**: Access token expired, use refresh endpoint
2. **InvalidToken**: Token format or signature invalid
3. **TokenRevoked**: Token has been revoked
4. **InsufficientPermissions**: User lacks required permissions
5. **InvalidCredentials**: Email/password incorrect
6. **SessionLimitExceeded**: Too many active sessions
7. **RateLimitExceeded**: Too many requests

## Configuration

Add to Django settings:

```python
JWT_CONFIG = {
    'ALGORITHM': 'HS256',
    'SECRET_KEY': os.environ.get('JWT_SECRET_KEY'),
    
    # Token expiration times
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'OFFLINE_TOKEN_LIFETIME': timedelta(hours=12),
    
    # Blacklist settings
    'BLACKLIST_ENABLED': True,
    'BLACKLIST_REDIS_URL': os.environ.get('REDIS_URL'),
    
    # Session limits
    'MAX_SESSIONS_PER_USER': 5,
    'SESSION_TIMEOUT': timedelta(hours=24),
    
    # Rate limiting
    'LOGIN_RATE_LIMIT': (5, 60),  # 5 per minute
    'REFRESH_RATE_LIMIT': (10, 60),  # 10 per minute
}
```

## Testing

Run test suite:

```bash
python manage.py test apps.core.test_jwt -v 2
```

Key test scenarios:
- Token generation and validation
- Token refresh and rotation
- Token revocation and blacklist
- Multi-device sessions
- Offline tokens
- Permission checks
- Rate limiting
- Multi-tenancy isolation
