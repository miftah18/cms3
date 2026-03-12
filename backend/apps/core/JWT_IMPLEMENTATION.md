# JWT Implementation Guide

Complete guide for using the JWT authentication system in the SaaS platform.

## Overview

The JWT implementation provides:
- **Access tokens** (15 min TTL) for API requests
- **Refresh tokens** (7 days TTL) for getting new access tokens
- **Offline tokens** (12 hours TTL) for limited offline use
- **Token revocation** (blacklist) for logout/security
- **Multi-device session management** for tracking user devices
- **Claims-based authorization** for permission checks

## Files Structure

```
backend/apps/core/
├── jwt_service.py          ← TokenManager class
├── blacklist.py            ← TokenBlacklist & SessionManager classes
├── jwt_exceptions.py       ← Custom exception classes
├── auth_serializers.py     ← Request/response serializers
├── auth_views.py           ← Authentication endpoints
├── auth_urls.py            ← URL routing
├── jwt_auth.py             ← Authentication middleware
└── JWT_IMPLEMENTATION.md   ← This file
```

## Setup & Configuration

### 1. Install Dependencies

The following packages should already be in requirements.txt:
```
PyJWT>=2.8.0
djangorestframework-simplejwt>=5.3.0
django-redis>=5.4.0
```

### 2. Django Settings Configuration

Add to `config/settings/base.py`:

```python
# JWT Settings
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'RS256',
    'SIGNING_KEY': env('JWT_PRIVATE_KEY').replace('\\n', '\n'),
    'VERIFYING_KEY': env('JWT_PUBLIC_KEY').replace('\\n', '\n'),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

OFFLINE_JWT = {
    'LIFETIME': timedelta(hours=12),
    'SCOPES': ['pos:read', 'pos:write', 'stock:read', 'products:read'],
    'REFRESH_ON_SYNC': True,
}

# DRF Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.core.jwt_auth.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
```

### 3. URL Configuration

Update `config/urls.py`:

```python
urlpatterns = [
    # ... other paths
    path('api/v1/auth/', include('apps.core.auth_urls')),
]
```

### 4. Generate JWT Keys

Generate RS256 asymmetric keys for production security:

```bash
# Generate private key
openssl genrsa -out private.pem 2048

# Generate public key
openssl rsa -in private.pem -pubout -out public.pem

# Add to .env
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

## API Endpoints

### POST /api/v1/auth/login/

Generate tokens for user login.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "device_id": "web-device-1",
  "device_type": "web"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "offline_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expires_in": 900,
  "refresh_expires_in": 604800,
  "offline_expires_in": 43200,
  "token_type": "Bearer",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

### POST /api/v1/auth/refresh/

Get new access token using refresh token.

**Request:**
```json
{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "device_id": "web-device-1"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expires_in": 900,
  "token_type": "Bearer"
}
```

### POST /api/v1/auth/logout/

Revoke tokens and end session.

**Request:**
```json
{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "device_id": "web-device-1",
  "logout_all_devices": false
}
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

### POST /api/v1/auth/token-status/

Check token validity and TTL.

**Request:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "offline_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Response:**
```json
{
  "access_token": {
    "valid": true,
    "expires_in": 850,
    "claims": {...}
  },
  "refresh_token": {
    "valid": true,
    "expires_in": 604750,
    "revoked": false
  },
  "offline_token": {
    "valid": true,
    "expires_in": 43100,
    "claims": {...}
  }
}
```

## Using JWT in Views

### Basic Protected View

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class MyProtectedView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        token_claims = request.token_claims
        
        return Response({
            "user_id": str(user.id),
            "tenant_id": token_claims.get("tenant_id"),
            "permissions": token_claims.get("permissions"),
        })
```

### Using Token Claims

```python
def my_view(request):
    # Access token claims
    token_claims = request.token_claims
    
    user_id = token_claims.get("user_id")
    tenant_id = token_claims.get("tenant_id")
    permissions = token_claims.get("permissions")
    device_id = token_claims.get("device_id")
    scope = token_claims.get("scope")  # ["online"] or ["offline"]
```

### Permission-Based Checks

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_transaction(request):
    # Check if user has permission
    token_claims = request.token_claims
    if 'pos:write' not in token_claims.get('permissions', []):
        return Response({"error": "No permission"}, status=403)
    
    # Create transaction
    return Response({"transaction_id": "..."})
```

### Offline Token Handling

```python
def my_offline_view(request):
    token_claims = request.token_claims
    scope = token_claims.get("scope", [])
    
    if "offline" in scope:
        # This is an offline token
        allowed_scopes = token_claims.get("allowed_scopes", [])
        # Restrict operations to allowed_scopes
    else:
        # This is an online access token
        # Full permissions available
```

## Using TokenManager

```python
from apps.core.jwt_service import get_token_manager
from django.contrib.auth.models import User

# Get token manager instance
token_manager = get_token_manager()

# Generate tokens
user = User.objects.get(id="user-uuid")
access_token = token_manager.generate_access_token(
    user,
    tenant_id="tenant-uuid",
    device_id="device-1",
    permissions=["pos:read", "pos:write"]
)

# Validate tokens
is_valid = token_manager.validate_token(access_token)

# Get token TTL
ttl_seconds = token_manager.get_token_ttl(access_token)

# Extract claims
claims = token_manager.extract_claims(access_token)
user_id = claims.get("user_id")
```

## Using TokenBlacklist

```python
from apps.core.blacklist import TokenBlacklist, SessionManager

# Revoke a token
TokenBlacklist.revoke_token(
    jti="token-jti",
    ttl_seconds=604800,  # 7 days
    reason="logout"
)

# Check if revoked
is_revoked = TokenBlacklist.is_revoked(jti)

# Track session (for logout-all support)
TokenBlacklist.track_session(user_id, jti)

# Revoke all user sessions
TokenBlacklist.revoke_all_user_sessions(user_id)

# Session management
SessionManager.create_session(
    user_id="user-uuid",
    device_id="device-1",
    device_type="web",
    jti="token-jti"
)

# Update activity
SessionManager.update_activity(user_id, device_id)

# Get session info
session = SessionManager.get_session(user_id, device_id)
```

## Token Claims Structure

### Access Token Claims
```json
{
  "jti": "unique-token-id",
  "user_id": "user-uuid",
  "tenant_id": "tenant-uuid",
  "role": "cashier",
  "permissions": ["pos:read", "pos:write"],
  "device_id": "device-1",
  "device_type": "web",
  "scope": ["online"],
  "iat": 1234567890,
  "exp": 1234568790,
  "token_type": "access",
  "type": "access"
}
```

### Refresh Token Claims
```json
{
  "jti": "unique-token-id",
  "user_id": "user-uuid",
  "tenant_id": "tenant-uuid",
  "device_id": "device-1",
  "iat": 1234567890,
  "exp": 1234568790,
  "token_type": "refresh",
  "type": "refresh"
}
```

### Offline Token Claims
```json
{
  "jti": "unique-token-id",
  "user_id": "user-uuid",
  "tenant_id": "tenant-uuid",
  "device_id": "device-1",
  "role": "cashier",
  "permissions": ["pos:read", "pos:write"],
  "scope": ["offline"],
  "allowed_scopes": ["pos:read", "pos:write", "stock:read", "products:read"],
  "iat": 1234567890,
  "exp": 1234568790,
  "token_type": "offline",
  "type": "offline"
}
```

## Security Best Practices

1. **Token Storage**
   - Access token: Store in memory (Zustand state) - expires quickly
   - Refresh token: Store in httpOnly cookie - can't be accessed by JS
   - Offline token: Store in IndexedDB - only for offline use

2. **HTTPS Only**
   - Always use HTTPS in production
   - Set Secure flag on cookies
   - Set SameSite flag to Strict

3. **Token Rotation**
   - New refresh token issued on each refresh
   - Old refresh token automatically revoked
   - Prevents token replay attacks

4. **Signature Verification**
   - Use RS256 (asymmetric) for production
   - Use strong keys (2048-bit RSA minimum)
   - Rotate keys periodically

5. **Rate Limiting**
   - Implement per-tenant rate limiting on login/refresh
   - Log failed authentication attempts
   - Block suspicious patterns

6. **Token Expiration**
   - Short-lived access tokens (15 minutes)
   - Longer-lived refresh tokens (7 days)
   - Time-limited offline tokens (12 hours)

## Migration from Previous Auth

If you had basic auth before:

1. Disable old authentication method in settings
2. Update login endpoint to use JWTAuthentication
3. Migrate existing user sessions to new token system
4. Update frontend to use JWT tokens instead of old tokens
5. Test thoroughly before releasing to production

## Monitoring & Logging

All authentication actions are logged:
- Successful logins (with device_id)
- Token refreshes
- Logouts (with device_id)
- Failed authentication attempts
- Token revocations

Logs include:
```
User {user_id} logged in from device {device_id}
User {user_id} refreshed token from device {device_id}
User {user_id} logged out from device {device_id}
Revoked token: {jti}, reason: {reason}
Attempt to use revoked token: {jti}
```

## Testing

### Unit Tests for TokenManager

```python
from django.test import TestCase
from apps.core.jwt_service import get_token_manager
from django.contrib.auth.models import User

class TokenManagerTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="test",
            email="test@example.com",
            password="testpass123"
        )
        self.token_manager = get_token_manager()
    
    def test_generate_access_token(self):
        token = self.token_manager.generate_access_token(
            self.user,
            tenant_id="tenant-1",
            device_id="device-1"
        )
        self.assertIsNotNone(token)
        
        # Decode and verify
        claims = self.token_manager.extract_claims(token)
        self.assertEqual(claims['user_id'], str(self.user.id))
        self.assertEqual(claims['tenant_id'], "tenant-1")
```

## Troubleshooting

### Token Invalid Error
- Check token signature (ensure correct key)
- Verify token not expired
- Check token format (Bearer prefix)

### Token Revoked Error
- User already logged out
- Session was invalidated
- Device was revoked

### Offline Token Not Working
- Check offline token scope
- Verify endpoint allows offline tokens
- Check offline token expiration

## Next Steps

1. Implement multi-device session management UI
2. Add PIN authentication for offline verification
3. Implement device management endpoints
4. Add comprehensive monitoring/alerting
5. Performance optimization and caching

## References

- [JWT Introduction](https://jwt.io/)
- [DRF Authentication](https://www.django-rest-framework.org/api-guide/authentication/)
- [Django Redis](https://github.com/jazzband/django-redis)
- [Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
