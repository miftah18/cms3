# JWT Authentication Integration Guide

## Quick Start

### Step 1: Install Dependencies

```bash
pip install pyjwt djangorestframework-simplejwt redis python-decouple
```

### Step 2: Configure Django Settings

Add to `backend/config/settings.py`:

```python
import os
from datetime import timedelta
from decouple import config

# JWT Configuration
JWT_AUTH = {
    'JWT_SECRET_KEY': config('JWT_SECRET_KEY'),
    'JWT_ALGORITHM': 'HS256',
    'JWT_ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'JWT_REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'JWT_OFFLINE_TOKEN_LIFETIME': timedelta(hours=12),
}

# Redis Configuration for Blacklist
REDIS_URL = config('REDIS_URL', default='redis://localhost:6379/0')

# Installed Apps
INSTALLED_APPS = [
    # ...
    'rest_framework',
    'apps.core',  # Your core app
]

# DRF Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.core.jwt_auth.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}
```

### Step 3: Add Environment Variables

Create `.env` file:

```env
JWT_SECRET_KEY=your-super-secret-key-here
REDIS_URL=redis://localhost:6379/0
DEBUG=False
SECRET_KEY=django-secret-key
```

### Step 4: Include Auth URLs

In `backend/config/urls.py`:

```python
from django.urls import path, include

urlpatterns = [
    # ... other urls
    path('api/auth/', include('apps.core.auth_urls')),
]
```

### Step 5: Run Migrations

```bash
python manage.py migrate
```

## Usage Examples

### Protecting Views

```python
from rest_framework.decorators import api_view
from apps.core.jwt_auth import require_jwt_auth
from apps.core.permission_decorators import require_permissions, require_roles

# Basic JWT authentication
@api_view(['GET'])
@require_jwt_auth
def profile_view(request):
    user = request.user
    return Response({
        'email': user.email,
        'user_id': user.id,
        'claims': request.auth  # JWT claims
    })

# With specific permissions
@api_view(['POST'])
@require_jwt_auth
@require_permissions(['write', 'delete'])
def delete_resource_view(request):
    # User must have both 'write' and 'delete' permissions
    pass

# With role-based access
@api_view(['GET'])
@require_jwt_auth
@require_roles(['admin', 'moderator'])
def admin_dashboard_view(request):
    # User must have 'admin' or 'moderator' role
    pass
```

### Using Class-Based Views

```python
from rest_framework.views import APIView
from apps.core.jwt_auth import JWTAuthentication

class MyProtectedView(APIView):
    authentication_classes = [JWTAuthentication]
    
    def get(self, request):
        user_id = request.auth['user_id']
        tenant_id = request.auth['tenant_id']
        permissions = request.auth.get('permissions', [])
        
        return Response({
            'user_id': user_id,
            'tenant_id': tenant_id,
            'permissions': permissions
        })
```

### Frontend Integration (React)

```javascript
import axios from 'axios';

// Create axios instance with auth header
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  withCredentials: true  // Important: include cookies
});

// Request interceptor
api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const { data } = await axios.post(
          'http://localhost:8000/api/auth/refresh/',
          {},
          { withCredentials: true }
        );
        
        sessionStorage.setItem('access_token', data.access_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        
        return api(originalRequest);
      } catch (refreshError) {
        // Redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Login
async function login(email, password) {
  const { data } = await api.post('/auth/login/', { email, password });
  sessionStorage.setItem('access_token', data.access_token);
  return data;
}

// Make authenticated request
async function getProfile() {
  return api.get('/users/profile/');
}

// Logout
async function logout() {
  await api.post('/auth/logout/');
  sessionStorage.removeItem('access_token');
}
```

### Handling Offline Scenarios

```javascript
// Request offline token when going offline
async function requestOfflineToken() {
  const { data } = await api.post('/auth/offline/request-token/', {
    scope: 'read',
    duration_hours: 12
  });
  
  // Store offline token securely
  localStorage.setItem('offline_token', data.offline_token);
  return data;
}

// Sync when back online
async function syncOfflineChanges(operations) {
  const offlineToken = localStorage.getItem('offline_token');
  
  const { data } = await api.post('/auth/offline/sync/', {
    offline_token: offlineToken,
    operations: operations
  });
  
  // Clear offline token
  localStorage.removeItem('offline_token');
  
  return data;
}
```

## Testing

### Test Login Flow

```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Test Protected Endpoint

```bash
curl -X GET http://localhost:8000/api/users/profile/ \
  -H "Authorization: Bearer <access_token>"
```

### Test Token Refresh

```bash
curl -X POST http://localhost:8000/api/auth/refresh/ \
  -H "Content-Type: application/json" \
  --cookie "refresh_token=<refresh_token_value>"
```

## Troubleshooting

### Issue: "Invalid token" error

**Solution**: 
- Check JWT_SECRET_KEY matches
- Verify token not expired
- Ensure Authorization header format is correct: `Bearer <token>`

### Issue: Refresh token cookie not being set

**Solution**:
- Ensure `withCredentials: true` in frontend requests
- Check CORS settings allow credentials
- Verify cookie attributes (httpOnly, Secure, SameSite)

### Issue: Rate limiting blocking requests

**Solution**:
- Check rate limit values in configuration
- Implement exponential backoff in client
- Use device_id to optimize session reuse

### Issue: Multi-device sessions not working

**Solution**:
- Pass `device_name` and `device_id` in login request
- Store device_id in localStorage for consistency
- Check session table for active sessions

## Production Checklist

- [ ] Set strong JWT_SECRET_KEY (use Django's get_random_secret_key)
- [ ] Configure CORS properly for frontend domains
- [ ] Set secure cookie flags in production
- [ ] Configure Redis persistence
- [ ] Set up log monitoring for auth failures
- [ ] Implement rate limiting
- [ ] Enable HTTPS only
- [ ] Regular security audit
- [ ] Backup Redis blacklist data
- [ ] Monitor token expiration patterns

## Security Best Practices

1. **Token Storage**: Store access tokens in memory/sessionStorage, refresh in httpOnly cookies
2. **Token Lifetime**: Keep access token lifetime short (15-30 min)
3. **Rate Limiting**: Implement on login and refresh endpoints
4. **Secure Transport**: Always use HTTPS in production
5. **CORS**: Whitelist only trusted domains
6. **Logging**: Log auth events for security monitoring
7. **Device Tracking**: Implement device fingerprinting
8. **Token Rotation**: Automatic on each refresh
9. **Revocation**: Maintain Redis blacklist with TTL
10. **Multi-Tenancy**: Always validate tenant_id in claims

## Migration from Existing Auth

If migrating from existing authentication:

1. Create user records if not exists
2. Implement gradual token migration
3. Support both old and new auth temporarily
4. Run parallel validation
5. Monitor error rates
6. Gradual rollout by percentage

Example backward-compatible middleware:

```python
class LegacyAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Try JWT first
        jwt_auth = JWTAuthentication()
        try:
            result = jwt_auth.authenticate(request)
            if result:
                request.user, request.auth = result
        except AuthenticationFailed:
            # Fall back to legacy auth
            # ... legacy auth logic
        
        return self.get_response(request)
```

## Support and Documentation

- Full API docs: See `docs/api/jwt-authentication.md`
- Implementation details: See `backend/apps/core/JWT_IMPLEMENTATION.md`
- Migration guide: See `backend/apps/core/JWT_MIGRATION_GUIDE.md`
- Test suite: See `backend/apps/core/test_jwt.py`
