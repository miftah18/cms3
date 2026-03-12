# App: Core

Berisi middleware, utilities, audit log, dan helper yang dipakai semua app lain.

## Isi

```
apps/core/
├── middleware/
│   ├── tenant_resolver.py    ← Resolve domain ke tenant_id (cache Redis 5 menit)
│   ├── schema_router.py      ← SET search_path per request thread
│   ├── security_headers.py   ← CSP, HSTS, X-Frame-Options, dll
│   └── rate_limit.py         ← Per-tenant rate limiting
├── security.py               ← @require_tenant_context decorator
├── audit.py                  ← AuditLog model (append-only) + @audit_action decorator
├── permissions.py            ← Role-based permission classes
├── exceptions.py             ← Custom exception handlers
└── utils.py                  ← Helper functions
```

## Middleware Chain (urutan di settings.py)

```python
MIDDLEWARE = [
    'apps.core.middleware.tenant_resolver.TenantResolverMiddleware',   # 1
    'apps.core.middleware.schema_router.SchemaRouterMiddleware',       # 2
    'django.middleware.security.SecurityMiddleware',                    # 3
    'apps.core.middleware.security_headers.SecurityHeadersMiddleware', # 4
    'apps.core.middleware.rate_limit.RateLimitMiddleware',             # 5
    # ... standard Django middleware
]
```

## Key Usage

```python
# Protect semua view dengan tenant context
from apps.core.security import require_tenant_context
from apps.core.permissions import permission_required

@require_tenant_context
@permission_required('pos:write')
def transaction_create(request):
    # request.tenant — validated tenant
    # request.user   — authenticated user dengan role
    pass

# Audit log otomatis
from apps.core.audit import audit_action

@audit_action(action='transaction.create', entity_type='transactions')
def transaction_create(request):
    pass
```
