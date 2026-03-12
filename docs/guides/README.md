# Guides

How-to guides untuk developer, ops, dan tim support.

## Untuk Developer

| Guide | Keterangan |
|-------|-----------|
| [Auth Flow](auth-flow.md) | JWT, refresh token, offline token, PIN auth |
| [Offline Strategy](offline-strategy.md) | IndexedDB, Service Worker, SyncManager, leader election |
| [Adding Business Type](adding-business-type.md) | Cara menambah jenis bisnis baru tanpa kode baru |
| [Migrations](migrations.md) | Multi-tenant migration, zero-downtime, schema versioning |

## Untuk Ops / DevOps

| Guide | Keterangan |
|-------|-----------|
| [Deployment](../deployment/README.md) | Environment variables, Docker, go-live checklist |
| [Scripts](../../scripts/README.md) | deploy.sh, rollback.sh, backup.sh, smoke_test.sh |
| [Infra Docker](../../infra/docker/README.md) | Dockerfile, docker-compose.prod.yml |
| [Infra Nginx](../../infra/nginx/README.md) | Reverse proxy, SSL, rate limiting |

## Untuk Tim Support / Sales

| Guide | Keterangan |
|-------|-----------|
| [Onboarding](onboarding.md) | Langkah onboarding tenant baru, < 30 menit |

## Quick Reference

### Setup tenant baru dari CLI

```bash
# 1. Buat tenant
python manage.py shell -c "
from apps.tenants.models import Tenant, TenantDomain, BusinessType
from apps.tenants.provisioner import TenantProvisioner

bt = BusinessType.objects.get(code='coffee_shop')
tenant = Tenant.objects.create(
    name='Kedai Kopi Contoh',
    slug='kedai-kopi-contoh',
    schema_name='tenant_demo001',
    business_type=bt,
)
TenantDomain.objects.create(tenant=tenant, domain='demo.saas.id', is_primary=True)
TenantProvisioner(tenant).provision()
print(f'Tenant created: {tenant.id}')
"

# 2. Buat admin user untuk tenant tersebut
python manage.py createsuperuser_tenant --tenant-slug kedai-kopi-contoh
```

### Debug tenant context

```python
# Cek apakah domain resolve benar
from apps.tenants.models import TenantDomain
td = TenantDomain.objects.get(domain='kedai-kopi.saas.id')
print(td.tenant.name, td.tenant.schema_name, td.tenant.status)

# Cek search_path aktif
from django.db import connection
with connection.cursor() as c:
    c.execute('SHOW search_path')
    print(c.fetchone())
```

### Reset cache tenant

```python
from django.core.cache import cache
# Invalidate semua cache tenant satu domain
cache.delete('tenant:domain:kedai-kopi.saas.id')
# Atau batch
cache.delete_many(['tenant:domain:shop-a.saas.id', 'tenant:domain:shop-b.saas.id'])
```
