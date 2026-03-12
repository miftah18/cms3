# App: Tenants

Mengelola data tenant, domain, business type, dan provisioning schema baru.

## Isi

```
apps/tenants/
├── models.py                  ← Tenant, TenantDomain, BusinessType, ComponentRegistry
├── middleware/
│   ├── tenant_resolver.py     ← Resolve domain → tenant (ada di apps/core, referensi sini)
│   └── schema_router.py       ← SET search_path per request
├── serializers.py             ← TenantSerializer, DomainSerializer
├── views.py                   ← Tenant CRUD (SaaS Admin only)
├── provisioner.py             ← Buat schema baru, jalankan migrasi
├── admin.py                   ← Django admin untuk Tenant management
├── management/
│   └── commands/
│       ├── seed_business_types.py   ← Load semua JSON fixture ke DB
│       ├── validate_flow_schemas.py ← Validasi JSON schema di DB
│       ├── provision_tenant.py      ← Provison schema untuk 1 tenant
│       └── migrate_all_tenants.py   ← Migrasi ke semua schema tenant
├── fixtures/
│   └── business_types/
│       ├── coffee_shop_v1.json
│       ├── laundry_v1.json
│       ├── vehicle_dealer_v1.json
│       ├── clinic_v1.json
│       ├── retail_store_v1.json
│       ├── salon_barbershop_v1.json
│       ├── hotel_guesthouse_v1.json
│       └── restaurant_v1.json
└── tests/
    ├── test_provisioner.py
    └── test_domain_resolution.py
```

## Models

### Tenant

```python
class Tenant(models.Model):
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name          = models.CharField(max_length=255)
    slug          = models.SlugField(unique=True)
    schema_name   = models.CharField(max_length=100, unique=True)
    business_type = models.ForeignKey('BusinessType', on_delete=models.PROTECT)
    plan_tier     = models.CharField(
        max_length=50,
        choices=[('starter','Starter'),('professional','Professional'),('enterprise','Enterprise')],
        default='starter'
    )
    status = models.CharField(
        max_length=50,
        choices=[('trial','Trial'),('active','Active'),('suspended','Suspended'),('cancelled','Cancelled')],
        default='trial'
    )
    settings      = models.JSONField(default=dict)
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    def get_setting(self, key: str, default=None):
        """Ambil setting dengan dot notation. Contoh: tenant.get_setting('branding.primary_color')"""
        keys = key.split('.')
        val  = self.settings
        for k in keys:
            if not isinstance(val, dict):
                return default
            val = val.get(k, default)
        return val

    @property
    def is_active(self):
        return self.status in ('active', 'trial')
```

### BusinessType

```python
class BusinessType(models.Model):
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4)
    code             = models.CharField(max_length=100, unique=True)
    name             = models.CharField(max_length=255)
    icon             = models.CharField(max_length=100, blank=True)
    flow_schema      = models.JSONField()
    ui_schema        = models.JSONField(default=dict)
    default_settings = models.JSONField(default=dict)
    version          = models.CharField(max_length=20, default='v1')
    is_active        = models.BooleanField(default=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)
```

## Provisioner

```python
# apps/tenants/provisioner.py
from django.db import connection
from django.core.management import call_command

class TenantProvisioner:
    def __init__(self, tenant: Tenant):
        self.tenant = tenant

    def provision(self) -> bool:
        """
        Buat schema baru dan jalankan semua migrasi.
        Target: selesai < 30 detik.
        """
        schema = self.tenant.schema_name
        with connection.cursor() as cursor:
            # 1. Buat schema
            cursor.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
            # 2. Set search_path ke schema baru
            cursor.execute(f'SET search_path TO "{schema}", public')
        # 3. Jalankan migrasi Django ke schema ini
        # call_command('migrate', '--database=tenant', verbosity=0)
        # 4. Seed data awal (kategori default, dll)
        self._seed_initial_data()
        return True

    def _seed_initial_data(self):
        """Seed data minimal untuk tenant baru bisa langsung pakai."""
        # Buat branch default, admin user, dll
        pass

    def deprovision(self):
        """Soft-delete schema (rename ke _archived_). Tidak drop langsung."""
        schema = self.tenant.schema_name
        archived = f"_archived_{schema}_{timezone.now().strftime('%Y%m%d')}"
        with connection.cursor() as cursor:
            cursor.execute(f'ALTER SCHEMA "{schema}" RENAME TO "{archived}"')
```

## Cara Provisioning Tenant Baru

```python
# Di views.py saat onboarding:
from apps.tenants.provisioner import TenantProvisioner

tenant = Tenant.objects.create(
    name='Kedai Kopi Pak Budi',
    slug='kedai-kopi-pak-budi',
    schema_name='tenant_abc123',
    business_type=BusinessType.objects.get(code='coffee_shop'),
)
TenantDomain.objects.create(
    tenant=tenant,
    domain='kedai-kopi.saas.id',
    is_primary=True
)

provisioner = TenantProvisioner(tenant)
provisioner.provision()  # < 30 detik
```

## Domain Resolution Flow

```
Request: GET https://kedai-kopi.saas.id/api/v1/products/

1. TenantResolverMiddleware
   ├─ Baca: request.headers.get('X-Forwarded-Host') atau request.get_host()
   ├─ Cek Redis cache: key='tenant:domain:kedai-kopi.saas.id'
   │    HIT  → return tenant_id dari cache
   │    MISS → query DB: SELECT tenant_id FROM tenant_domains WHERE domain = '...'
   │          → set Redis cache TTL 300 detik
   └─ Set: request.tenant = <Tenant instance>

2. SchemaRouterMiddleware
   ├─ Ambil: request.tenant.schema_name  → 'tenant_abc123'
   └─ Eksekusi: SET search_path TO tenant_abc123, public

3. Semua query ORM setelah ini otomatis ke schema tenant_abc123
```

## Seed Business Types

```bash
# Seed semua (idempotent — aman dijalankan berkali-kali)
python manage.py seed_business_types

# Output:
# Created: Coffee Shop / Kafe (coffee_shop v1)
# Updated: Laundry (laundry v1)      ← jika sudah ada, update
# Created: Dealer Kendaraan (vehicle_dealer v1)
# ...
# Done. 8 business types seeded.

# Seed spesifik + validasi
python manage.py seed_business_types --type clinic --validate
```
