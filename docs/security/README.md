# Security

Panduan security lengkap untuk platform multi-tenant.

## Prinsip Utama

1. **Zero Trust** — Setiap request divalidasi tenant context-nya, tidak ada exception
2. **Defense in Depth** — Multiple layer: RLS, middleware, decorator, input validation
3. **Least Privilege** — Role-based access, setiap role hanya dapat permission yang dibutuhkan
4. **Audit Everything** — Semua perubahan data terekam di audit log append-only

## Tenant Isolation

```python
# apps/core/security.py
from functools import wraps
from django.core.exceptions import PermissionDenied

def require_tenant_context(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not hasattr(request, 'tenant') or not request.tenant:
            raise PermissionDenied('Tenant context tidak ditemukan')
        if request.tenant.status not in ['active', 'trial']:
            raise PermissionDenied('Tenant tidak aktif')
        return view_func(request, *args, **kwargs)
    return wrapper
```

```sql
-- PostgreSQL Row Level Security sebagai safety net
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
```

## JWT Configuration

```python
# config/settings/base.py
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'RS256',              # RSA — lebih aman dari HS256
    'SIGNING_KEY':   env('JWT_PRIVATE_KEY'),
    'VERIFYING_KEY': env('JWT_PUBLIC_KEY'),
}

OFFLINE_JWT = {
    'LIFETIME':        timedelta(hours=12),
    'ALLOWED_SCOPES':  ['pos:read', 'pos:write', 'stock:read'],
    'REFRESH_ON_SYNC': True,
}
```

## Input Validation

```python
# apps/sync/validators.py — Server tidak pernah percaya data client
def sanitize_transaction_data(data: dict) -> dict:
    from decimal import Decimal
    items = data.get('items', [])
    # Re-kalkulasi total dari server — jangan pakai total dari client
    subtotal = sum(
        Decimal(str(item['unit_price'])) * Decimal(str(item['quantity']))
        for item in items
    )
    data['subtotal'] = float(subtotal)
    data.pop('total_amount', None)  # Hapus total dari client
    return data
```

## Security Headers

```python
# middleware/security_headers.py
class SecurityHeadersMiddleware:
    def __call__(self, request):
        response = self.get_response(request)
        response['X-Frame-Options'] = 'DENY'
        response['X-Content-Type-Options'] = 'nosniff'
        response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
        response['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' cdn.midtrans.com; "
            "connect-src 'self' api.midtrans.com; "
            "img-src 'self' data: blob:; "
            "frame-ancestors 'none'"
        )
        return response
```

## Rate Limiting

```python
from django_ratelimit.decorators import ratelimit

def tenant_key(group, request):
    return str(request.tenant.id)

@ratelimit(key=tenant_key, rate='1000/m', method='POST', block=True)
def transaction_create(request): ...

# Rate limits berbeda per endpoint:
# Login:      10/m per IP
# API umum:   1000/m per tenant
# Sync:       100/m per device
# Export:     10/m per user
```

## Audit Log

```python
# apps/core/audit.py — Append-only, tidak bisa diedit atau dihapus
class AuditLog(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4)
    tenant_id   = models.UUIDField()
    user_id     = models.UUIDField(null=True)
    action      = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=100)
    entity_id   = models.CharField(max_length=255)
    ip_address  = models.GenericIPAddressField(null=True)
    before_data = models.JSONField(null=True)
    after_data  = models.JSONField(null=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValueError('AuditLog tidak bisa diedit')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('AuditLog tidak bisa dihapus')
```

## Security Checklist

### Kritis
- [ ] JWT menggunakan RS256
- [ ] Refresh token rotation aktif
- [ ] Offline token scope terbatas
- [ ] PIN hash menggunakan bcrypt
- [ ] PostgreSQL RLS aktif di semua tabel tenant
- [ ] Zero-trust middleware di semua endpoint
- [ ] Semua secret di environment variables — tidak ada hardcoded credential
- [ ] Bandit scan: 0 critical, 0 high
- [ ] npm audit: 0 high severity

### Tinggi
- [ ] Rate limiting per tenant aktif
- [ ] Input validation di semua endpoint
- [ ] Sync payload signature validation
- [ ] Server re-kalkulasi semua total transaksi
- [ ] Component whitelist di schema validator
- [ ] Audit log aktif — semua transaksi dan perubahan data

### Sedang
- [ ] Security headers middleware aktif
- [ ] CORS dikonfigurasi per domain
- [ ] OWASP ZAP scan: 0 high, < 3 medium

## Referensi

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Django Security Checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)
- [Midtrans Security](https://docs.midtrans.com/en/after-payment/get-status)
