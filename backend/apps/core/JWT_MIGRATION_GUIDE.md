# JWT Implementation Migration Guide

Step-by-step guide to integrate the JWT system into your existing Django backend.

## Pre-Migration Checklist

- [ ] All files created (jwt_service.py, blacklist.py, jwt_exceptions.py, auth_serializers.py, auth_views.py, auth_urls.py, jwt_auth.py, permission_decorators.py, jwt_models.py)
- [ ] Django settings configured with JWT settings
- [ ] Redis properly configured and running
- [ ] JWT keys generated (RS256 private/public keys)
- [ ] Environment variables set (.env file)
- [ ] Development environment ready for testing

## Step 1: Environment Variables Setup

Add to your `.env` file:

```bash
# JWT Configuration
JWT_ALGORITHM=RS256
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEow..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIj..."

# HMAC Secret for PIN/Session verification
JWT_HMAC_KEY=your-256-bit-secret-key-here

# Optional: Token TTL overrides
JWT_ACCESS_TOKEN_TTL=900           # 15 minutes
JWT_REFRESH_TOKEN_TTL=604800       # 7 days
JWT_OFFLINE_TOKEN_TTL=43200        # 12 hours
```

## Step 2: Database Migration

If using persistent session tracking (optional), create and run migrations:

```bash
# Create migration for new models
python manage.py makemigrations core

# Run migration
python manage.py migrate
```

Models created:
- `TokenBlacklistModel` - Persistent blacklist (backup for Redis)
- `UserSession` - Session tracking
- `TokenRefreshLog` - Refresh event logs
- `AuthenticationLog` - Auth event logs

## Step 3: Update Django Settings

Edit `config/settings/base.py`:

```python
# Add to INSTALLED_APPS (if not already present)
INSTALLED_APPS = [
    # ... existing apps
    'rest_framework_simplejwt.token_blacklist',  # For DRF simplejwt
]

# JWT Configuration
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

# DRF Configuration - Update REST_FRAMEWORK
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.core.jwt_auth.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'EXCEPTION_HANDLER': 'apps.core.exceptions.custom_exception_handler',
}

# Middleware - Add JWT middleware (after tenant context)
MIDDLEWARE = [
    # Existing middleware...
    'apps.core.middleware.tenant_resolver.TenantResolverMiddleware',
    'apps.core.middleware.schema_router.SchemaRouterMiddleware',
    # ... other middleware ...
    # Add JWT-related middleware:
    'apps.core.jwt_auth.TenantContextMiddleware',      # Inject tenant from token
    'apps.core.jwt_auth.DeviceSessionMiddleware',       # Track device activity
    # ... rest of middleware ...
]
```

## Step 4: Update URL Configuration

Edit `config/urls.py`:

```python
from django.urls import path, include

urlpatterns = [
    # ... existing patterns ...
    path('api/v1/auth/', include('apps.core.auth_urls')),
    # ... rest of patterns ...
]
```

## Step 5: Update User Model (If Needed)

If your User model doesn't have fields for tenant_id and role, add them:

```python
# In your User model or extend it
from django.contrib.auth.models import User
from django.db import models
import uuid

class CustomUser(User):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    role = models.CharField(max_length=50, default='user')
    
    class Meta:
        db_table = 'auth_user_custom'
```

Then update settings:
```python
AUTH_USER_MODEL = 'core.CustomUser'  # If you created a custom user model
```

## Step 6: Update Existing Views

### Protect Endpoints with JWT

Before:
```python
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

class MyView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
```

After (now automatic via settings):
```python
from rest_framework.views import APIView

class MyView(APIView):
    # Authentication and permission via settings
    def get(self, request):
        user_id = request.token_claims['user_id']
```

### Use Permission Decorators

```python
from rest_framework.decorators import api_view
from apps.core.permission_decorators import permission_required, role_required

@api_view(['POST'])
@permission_required('pos:write')
@role_required('cashier', 'supervisor', 'manager')
def create_transaction(request):
    return Response({"status": "created"})
```

## Step 7: Test JWT Endpoints

### Test Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "device_id": "web-device-1",
    "device_type": "web"
  }'
```

Response should include `access_token`, `refresh_token`, `offline_token`.

### Test Protected Endpoint
```bash
curl -X GET http://localhost:8000/api/v1/products/ \
  -H "Authorization: Bearer <access_token>"
```

### Test Token Refresh
```bash
curl -X POST http://localhost:8000/api/v1/auth/refresh/ \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "<refresh_token>",
    "device_id": "web-device-1"
  }'
```

### Test Logout
```bash
curl -X POST http://localhost:8000/api/v1/auth/logout/ \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "<refresh_token>",
    "logout_all_devices": false
  }'
```

## Step 8: Update Frontend (Next.js)

### Update Auth Store (Zustand)

```typescript
// lib/store/authStore.ts
import create from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthStore {
  accessToken: string | null
  refreshToken: string | null
  offlineToken: string | null
  user: any
  isOnline: boolean
  
  login: (email: string, password: string) => Promise<void>
  refresh: () => Promise<void>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      offlineToken: null,
      user: null,
      isOnline: true,
      
      login: async (email, password) => {
        const response = await fetch('/api/v1/auth/login/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            device_id: `web-${Date.now()}`,
            device_type: 'web',
          }),
        })
        
        if (!response.ok) throw new Error('Login failed')
        
        const data = await response.json()
        set({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          offlineToken: data.offline_token,
          user: data.user,
        })
        
        // Store refresh token in secure cookie (backend handles this)
        document.cookie = `refresh_token=${data.refresh_token}; HttpOnly; Secure`
      },
      
      refresh: async () => {
        const refreshToken = get().refreshToken
        const response = await fetch('/api/v1/auth/refresh/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })
        
        if (!response.ok) {
          // If refresh fails, logout user
          get().logout()
          return
        }
        
        const data = await response.json()
        set({ accessToken: data.access_token })
      },
      
      logout: async () => {
        const refreshToken = get().refreshToken
        
        try {
          await fetch('/api/v1/auth/logout/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              refresh_token: refreshToken,
              logout_all_devices: false,
            }),
          })
        } finally {
          set({
            accessToken: null,
            refreshToken: null,
            offlineToken: null,
            user: null,
          })
        }
      },
      
      logoutAll: async () => {
        const refreshToken = get().refreshToken
        
        try {
          await fetch('/api/v1/auth/logout/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              refresh_token: refreshToken,
              logout_all_devices: true,
            }),
          })
        } finally {
          set({
            accessToken: null,
            refreshToken: null,
            offlineToken: null,
            user: null,
          })
        }
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        refreshToken: state.refreshToken,
      }),
    }
  )
)
```

### Update API Fetcher

```typescript
// lib/api/fetch.ts
import { useAuthStore } from '@/lib/store/authStore'

async function apiCall(url: string, options: RequestInit = {}) {
  const { accessToken, refresh, logout } = useAuthStore.getState()
  
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${accessToken}`,
  }
  
  let response = await fetch(url, { ...options, headers })
  
  // Auto-refresh on 401
  if (response.status === 401) {
    try {
      await refresh()
      const newToken = useAuthStore.getState().accessToken
      headers['Authorization'] = `Bearer ${newToken}`
      response = await fetch(url, { ...options, headers })
    } catch {
      logout()
      throw new Error('Authentication failed')
    }
  }
  
  return response
}
```

## Step 9: Run Tests

```bash
# Run Django tests
python manage.py test apps.core

# Run with coverage
pytest apps/core/ --cov=apps.core --cov-report=html -v

# Test specific JWT tests
pytest apps/core/tests/test_jwt_service.py -v
```

## Step 10: Production Deployment

Before deploying to production:

1. **Verify Environment Variables**
   ```bash
   python manage.py check --deploy
   ```

2. **Test with Gunicorn**
   ```bash
   gunicorn config.wsgi:application
   ```

3. **Enable HTTPS**
   - Set `SECURE_SSL_REDIRECT = True`
   - Set `SECURE_HSTS_SECONDS = 31536000`
   - Ensure cookies have `Secure` flag

4. **Monitor Logs**
   - Watch for authentication failures
   - Monitor token refresh rates
   - Track revoked token usage

5. **Scale Redis**
   - Ensure Redis can handle token blacklist queries
   - Use Redis cluster for high availability
   - Configure appropriate TTLs

## Troubleshooting

### "Invalid token" Error
- Check token signature (verify RSA keys are correct)
- Check token hasn't expired
- Check token format (Bearer prefix)

### "Token revoked" Error
- Check if user logged out
- Check if token was manually revoked
- Clear Redis cache if stuck (dev only)

### Redis Connection Error
- Verify Redis is running: `redis-cli ping`
- Check REDIS_URL in settings
- Ensure Redis authentication if needed

### Email Authentication Not Working
- Django uses `username` field by default
- Update `authenticate()` to use email field
- Create custom backend if needed

## Rollback Plan

If you need to rollback:

1. Revert Django settings to previous auth method
2. Remove JWT-related middleware
3. Downgrade URL routing
4. Update frontend to use old authentication
5. Keep Redis blacklist for security (auto-expires)

## Next Steps

1. Set up comprehensive test suite
2. Implement device management UI
3. Add PIN authentication for offline
4. Set up monitoring and alerting
5. Configure rate limiting per tenant
6. Implement comprehensive audit logging
7. Plan token rotation strategy

## Support

For issues or questions:
- Review JWT_IMPLEMENTATION.md for detailed documentation
- Check auth_views.py for endpoint implementation
- Review permission_decorators.py for permission system
- See jwt_models.py for audit logging
