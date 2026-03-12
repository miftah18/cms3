# API Error Codes & Troubleshooting

Complete reference for all API error codes with resolution steps.

## Error Response Format

All API errors follow this standard format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": {
    "field": "specific field with error (if applicable)",
    "code": "error code (if different from main error)",
    "retry_after": 60
  },
  "timestamp": "2024-01-15T14:30:00Z",
  "request_id": "req-123456"
}
```

## Authentication Errors (4xx)

### 401 Unauthorized

| Error Code | Meaning | Cause | Resolution |
|-----------|---------|-------|-----------|
| `invalid_credentials` | Login failed | Wrong email or password | Verify email/password and try again |
| `invalid_token` | Token invalid | Token format invalid or corrupted | Login again to get new token |
| `token_expired` | Token expired | Access token lifetime exceeded | Use refresh token to get new access token |
| `token_revoked` | Token revoked | Token was blacklisted/revoked | Login again to get new token |
| `invalid_refresh_token` | Refresh token invalid | Refresh token format wrong or user not found | Login again |
| `offline_token_invalid` | Offline token invalid | Token format corrupted or not offline type | Generate new offline token |
| `offline_token_expired` | Offline token expired | Offline token TTL exceeded | Generate new offline token before going offline |
| `user_not_found` | User doesn't exist | User account deleted or doesn't exist | Register new account or contact support |
| `account_disabled` | Account disabled | User account is deactivated | Contact support to reactivate account |
| `invalid_device_id` | Device ID invalid | Device ID missing or malformed | Provide valid device UUID |

**Example:**
```json
{
  "error": "token_expired",
  "message": "Access token has expired",
  "details": {
    "expires_at": "2024-01-15T14:30:00Z",
    "current_time": "2024-01-15T14:45:00Z"
  },
  "timestamp": "2024-01-15T14:45:00Z",
  "request_id": "req-123"
}
```

**Resolution Steps:**
1. Check token expiration: `POST /auth/token-status/`
2. If expired, refresh: `POST /auth/refresh/` with refresh_token
3. If refresh fails, login again: `POST /auth/login/`
4. Implement automatic token refresh on client (when TTL < 60 seconds)

---

### 403 Forbidden

| Error Code | Meaning | Cause | Resolution |
|-----------|---------|-------|-----------|
| `insufficient_permissions` | Operation not allowed | User lacks required permission | Request admin grant access |
| `tenant_access_denied` | Cannot access tenant | User not member of tenant | Request to join tenant |
| `offline_scope_not_allowed` | Operation not allowed offline | Endpoint requires online | Go online or use allowed offline endpoints |
| `device_not_allowed` | Device not recognized | Device not registered for user | Register device or use different device |

---

## Validation Errors (400)

### 400 Bad Request

| Error Code | Meaning | Cause | Resolution |
|-----------|---------|-------|-----------|
| `invalid_request` | Request format invalid | JSON parsing error or missing fields | Check request JSON syntax and required fields |
| `missing_field` | Required field missing | Required parameter not provided | Add missing field to request |
| `invalid_field_format` | Field format invalid | Field value wrong type or format | Check field format (e.g., email, UUID) |
| `invalid_enum_value` | Invalid enum value | Field value not in allowed list | Use valid value from documented enum |
| `invalid_date_format` | Date format invalid | Date not ISO 8601 format | Use format: `YYYY-MM-DDTHH:MM:SSZ` |
| `email_invalid` | Email invalid | Email format incorrect | Provide valid email address |
| `password_too_weak` | Password weak | Password doesn't meet requirements | Use 8+ chars with uppercase, lowercase, number |
| `device_id_invalid` | Device ID invalid | Device ID not UUID format | Use valid UUID v4 format |
| `duplicate_email` | Email already exists | Email already registered | Use different email or login with existing |
| `invalid_operation` | Operation invalid | Operation type not recognized | Check allowed operation types |

**Example:**
```json
{
  "error": "missing_field",
  "message": "Required field 'email' is missing",
  "details": {
    "field": "email",
    "required": true
  },
  "timestamp": "2024-01-15T14:30:00Z",
  "request_id": "req-124"
}
```

**Resolution Steps:**
1. Check request body structure
2. Verify all required fields are present
3. Validate field formats (email, UUID, dates)
4. Check field types match documentation
5. Review error details for specific field

---

## Rate Limiting (429)

### 429 Too Many Requests

| Error Code | Meaning | Cause | Resolution |
|-----------|---------|-------|-----------|
| `rate_limit_exceeded` | Too many requests | Request rate exceeded limit | Wait and retry after reset time |
| `rate_limit_auth_exceeded` | Auth endpoint limit exceeded | Too many login attempts | Wait 15 minutes before next login |
| `rate_limit_sync_exceeded` | Sync endpoint limit exceeded | Too many sync requests | Batch operations and reduce frequency |

**Rate Limits by Endpoint Category:**
- Auth endpoints (login, refresh): 10 req/min per user
- Session endpoints: 30 req/min per user
- Sync endpoints: 5 req/min per user
- All other endpoints: 100 req/min per user

**Response Headers:**
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704068460
Retry-After: 60
```

**Example:**
```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Max 10 requests per minute.",
  "details": {
    "limit": 10,
    "window": "1 minute",
    "reset_at": "2024-01-15T14:31:00Z",
    "retry_after": 60
  },
  "timestamp": "2024-01-15T14:30:00Z",
  "request_id": "req-125"
}
```

**Resolution Steps:**
1. Read `Retry-After` header (seconds to wait)
2. Implement exponential backoff: wait 2^n seconds
3. Batch requests to reduce frequency
4. Cache responses to minimize API calls
5. Contact support if legitimate use case requires higher limit

---

## Data Conflicts (409)

### 409 Conflict

| Error Code | Meaning | Cause | Resolution |
|-----------|---------|-------|-----------|
| `duplicate_entity` | Entity already exists | Duplicate ID or constraint violation | Use different ID or check if already created |
| `conflicting_update` | Update conflict | Concurrent modification detected | Refetch and retry with updated version |
| `sync_conflict` | Offline sync conflict | Conflicting offline changes detected | Implement conflict resolution strategy |
| `optimistic_lock_failed` | Version mismatch | Entity version changed since read | Refetch entity and retry |
| `foreign_key_violated` | Referenced entity missing | Foreign key constraint violated | Ensure referenced entity exists |
| `unique_constraint_violated` | Unique constraint violated | Duplicate value in unique field | Use unique value |

**Example (Sync Conflict):**
```json
{
  "error": "sync_conflict",
  "message": "Conflict detected during sync",
  "details": {
    "entity_type": "transaction",
    "entity_id": "txn-123",
    "conflict_type": "concurrent_modification",
    "server_version": {
      "version": 3,
      "modified_at": "2024-01-15T14:00:00Z"
    },
    "offline_version": {
      "version": 1,
      "modified_at": "2024-01-15T12:00:00Z"
    }
  },
  "timestamp": "2024-01-15T14:30:00Z",
  "request_id": "req-126"
}
```

**Resolution Strategies:**

1. **Client Wins (Optimistic):**
   - Discard server changes, keep offline changes
   - Use when offline user has latest data
   - Risk: Server data overwritten

2. **Server Wins (Pessimistic):**
   - Discard offline changes, use server version
   - Use when server has authoritative data
   - Risk: Offline user's work lost

3. **Merge (Smart):**
   - Merge changes at field level
   - Use when different fields modified
   - Risk: Complex logic, may have unintended consequences

4. **Manual:**
   - Present conflict to user
   - User chooses which version to keep
   - Risk: User friction, required intervention

---

## Resource Not Found (404)

### 404 Not Found

| Error Code | Meaning | Cause | Resolution |
|-----------|---------|-------|-----------|
| `resource_not_found` | Resource doesn't exist | ID not found or resource deleted | Verify resource ID exists |
| `session_not_found` | Session not found | Device session doesn't exist | List sessions to verify device exists |
| `user_not_found` | User not found | User ID invalid | Verify user ID or refresh auth |
| `tenant_not_found` | Tenant not found | Tenant ID invalid | Verify tenant ID |
| `product_not_found` | Product not found | Product ID invalid | Verify product exists |
| `transaction_not_found` | Transaction not found | Transaction ID invalid | Verify transaction exists |

---

## Server Errors (5xx)

### 500 Internal Server Error

| Error Code | Meaning | Cause | Resolution |
|-----------|---------|-------|-----------|
| `internal_error` | Unexpected error | Server error occurred | Retry request, contact support if persistent |
| `database_error` | Database error | Database operation failed | Retry, check database status |
| `sync_error` | Sync failed | Sync operation failed | Retry sync, clear local cache if needed |
| `payment_gateway_error` | Payment failed | Payment processor error | Retry payment, contact payment provider |
| `token_generation_error` | Token generation failed | JWT generation failed | Logout and login again |

**Example:**
```json
{
  "error": "internal_error",
  "message": "An unexpected error occurred",
  "details": {
    "error_id": "err-12345",
    "support_link": "https://support.example.com/err-12345"
  },
  "timestamp": "2024-01-15T14:30:00Z",
  "request_id": "req-127"
}
```

**Resolution Steps:**
1. Note the `request_id` for support
2. Retry request (may be temporary)
3. If persists, check service status: `https://status.example.com`
4. Contact support with `error_id` and `request_id`

---

### 503 Service Unavailable

| Error Code | Meaning | Cause | Resolution |
|-----------|---------|-------|-----------|
| `service_unavailable` | Service down | Server maintenance or outage | Wait for service to come back online |
| `database_unavailable` | Database down | Database connection failed | Wait for database to come back online |
| `too_many_requests_server` | Server overloaded | Too many requests globally | Implement backoff and retry later |

**Response Headers:**
```
HTTP/1.1 503 Service Unavailable
Retry-After: 300
```

---

## Common Issues & Solutions

### "Invalid Token" But Token Was Just Generated

**Problem:** Token works for one request, then returns `invalid_token`

**Causes:**
1. Token sent without "Bearer " prefix
2. Server time skew (server clock differs from client)
3. Token string corrupted in transit

**Solutions:**
```bash
# ✅ Correct format
curl -H "Authorization: Bearer eyJ..." https://api.example.com/auth/sessions/

# ❌ Wrong - missing "Bearer "
curl -H "Authorization: eyJ..." https://api.example.com/auth/sessions/
```

Check server time:
```bash
curl https://api.example.com/time/
# Compare with client: Date.now()
```

---

### "Rate Limit Exceeded" For Normal Usage

**Problem:** Getting 429 errors with normal request frequency

**Causes:**
1. Multiple requests in rapid succession
2. Polling endpoints too frequently
3. Multiple devices making simultaneous requests
4. Client not caching responses

**Solutions:**
```javascript
// ✅ Cache responses to reduce requests
const { data, isLoading } = useSWR('/auth/sessions/', fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 60000 // Cache for 60 seconds
});

// ✅ Batch operations
// Instead of 10 separate requests, make 1 batch request

// ✅ Increase interval for polling
setInterval(() => checkStatus(), 30000); // Every 30 seconds, not every 1 second
```

---

### "Conflict" During Offline Sync

**Problem:** Sync fails with conflict on previously working operation

**Causes:**
1. Server data modified while offline
2. Another user modified shared resource
3. Database constraint violation

**Solutions:**
```javascript
// Implement conflict resolution
async function syncWithConflictHandling() {
  try {
    const response = await sync(queuedOps);
    if (response.failed_operations.length > 0) {
      // Handle conflicts
      for (const failed of response.failed_operations) {
        const resolution = getUserChoice(failed);
        if (resolution === 'server_wins') {
          discardLocalChanges(failed.entity_id);
        } else if (resolution === 'client_wins') {
          retryOperation(failed);
        }
      }
    }
  } catch (error) {
    if (error.error === 'sync_conflict') {
      // Present UI to user for manual resolution
      showConflictResolver(error.details);
    }
  }
}
```

---

### "Session Not Found" After Logout All Devices

**Problem:** Trying to access sessions after logout all

**Cause:** All sessions were revoked, including current

**Solution:**
```javascript
// After logout all, redirect to login
if (error.error === 'session_not_found') {
  clearAuthTokens();
  redirectToLogin();
}
```

---

### "Device Not Allowed"

**Problem:** Getting 403 for device-specific operations

**Causes:**
1. Device ID not matching session
2. Device not registered in tenant
3. Device deactivated

**Solutions:**
```javascript
// Register device on first login
const response = await login({
  email, password,
  device_id: generateDeviceId(),
  device_type: 'web'
});

// Store device_id for future requests
localStorage.setItem('device_id', response.device_id);
```

---

## Debugging Tools

### Check Token Health

```bash
curl -X POST https://api.example.com/auth/token-status/ \
  -H "Content-Type: application/json" \
  -d '{
    "access_token": "YOUR_TOKEN",
    "refresh_token": "YOUR_REFRESH_TOKEN",
    "offline_token": "YOUR_OFFLINE_TOKEN"
  }'
```

### Check Session Status

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.example.com/auth/sessions/
```

### Inspect Token (without making API call)

```javascript
// Decode JWT (client-side only)
function decodeToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  
  const payload = JSON.parse(
    atob(parts[1])
  );
  
  return {
    ...payload,
    isExpired: Date.now() > payload.exp * 1000,
    expiresIn: Math.round((payload.exp * 1000 - Date.now()) / 1000)
  };
}

// Usage
const token = localStorage.getItem('access_token');
const decoded = decodeToken(token);
console.log(decoded);
// {
//   user_id: 'user-123',
//   tenant_id: 'tenant-456',
//   device_id: 'device-789',
//   exp: 1704068100,
//   isExpired: false,
//   expiresIn: 850
// }
```

### Network Inspector Tips

In browser DevTools, look for these headers in failed requests:

```
Request:
Authorization: Bearer eyJ...
X-Request-ID: req-123

Response:
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067860
```

---

## Support & Escalation

If error persists after trying solutions:

1. **Gather Information:**
   - Error code and message
   - Request ID (from response)
   - Timestamp of error
   - Steps to reproduce
   - Browser/client version

2. **Contact Support:**
   - Email: support@example.com
   - Support Portal: https://support.example.com
   - Status Page: https://status.example.com

3. **Pro Tips:**
   - Include `request_id` in support ticket
   - Provide `curl` command to reproduce
   - Share network tab screenshot from DevTools
   - Mention if error is consistent or intermittent

---

## Error Code Reference (Alphabetical)

```
account_disabled
conflicting_update
database_error
database_unavailable
device_id_invalid
device_not_allowed
duplicate_email
duplicate_entity
email_invalid
foreign_key_violated
insufficient_permissions
internal_error
invalid_credentials
invalid_date_format
invalid_device_id
invalid_enum_value
invalid_field_format
invalid_operation
invalid_refresh_token
invalid_request
invalid_token
offline_scope_not_allowed
offline_token_expired
offline_token_invalid
optimistic_lock_failed
password_too_weak
payment_gateway_error
rate_limit_auth_exceeded
rate_limit_exceeded
rate_limit_sync_exceeded
resource_not_found
service_unavailable
session_not_found
sync_conflict
sync_error
tenant_access_denied
tenant_not_found
token_expired
token_generation_error
token_revoked
too_many_requests_server
transaction_not_found
unique_constraint_violated
user_not_found
```

---

## Next Steps

- [API Endpoints Reference](./ENDPOINTS.md)
- [JWT Authentication Details](./jwt-authentication.md)
- [Data Models & Schemas](./data-models.md)
- [Component Registry](../components/REGISTRY.md)
