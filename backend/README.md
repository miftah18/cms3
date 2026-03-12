# Backend — Django 5.x + DRF

Django project untuk platform SaaS multi-tenant. Semua business logic, API, sync engine, dan payment integration ada di sini.

## Struktur

```
backend/
├── manage.py
├── requirements.txt
├── .env.example
├── config/                    ← Django settings, URLs, WSGI/ASGI
│   ├── settings/
│   │   ├── base.py            ← Settings umum (semua environment)
│   │   ├── development.py     ← Dev: DEBUG=True, local DB
│   │   └── production.py      ← Prod: gunicorn, sentry, SSL
│   ├── urls.py                ← Root URL routing
│   ├── wsgi.py
│   └── asgi.py
├── apps/
│   ├── core/                  ← Middleware, utils, audit, permissions
│   ├── tenants/               ← Tenant model, domain, provisioning
│   ├── flow_engine/           ← JSON flow schema parser
│   ├── products/              ← Produk, kategori, stok
│   ├── transactions/          ← Transaksi, items, shift
│   ├── sync/                  ← Delta sync & conflict resolution
│   ├── payments/              ← Midtrans, Stripe integration
│   ├── notifications/         ← In-app, email, push notifications
│   └── reports/               ← Laporan, analytics, export
└── tests/                     ← Cross-app integration tests
```

## Setup Development

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env           # Isi DATABASE_URL, REDIS_URL, JWT keys, dll

python manage.py migrate
python manage.py seed_business_types
python manage.py createsuperuser

python manage.py runserver
```

## Custom Management Commands

| Command | Keterangan |
|---------|-----------|
| `seed_business_types` | Seed semua 8 JSON schema bisnis ke DB |
| `seed_business_types --type coffee_shop` | Seed 1 business type saja |
| `validate_flow_schemas` | Validasi semua JSON schema di DB |
| `migrate_all_tenants` | Jalankan migrasi ke semua tenant schema |
| `provision_tenant <tenant_id>` | Buat schema baru untuk tenant |
| `purge_sync_queue --days 30` | Bersihkan sync queue lama |
| `generate_daily_reports` | Generate laporan harian semua tenant (Celery task) |

## Testing

```bash
# Semua tests dengan coverage
pytest --cov=apps --cov-report=html -v

# Hanya satu app
pytest apps/sync/ -v

# Hanya tenant isolation tests (kritis)
pytest tests/test_tenant_isolation.py -v

# Coverage report
coverage report --fail-under=80
```

## Celery Workers

```bash
# Development — 1 worker
celery -A config worker -l info

# Development — dengan beat scheduler
celery -A config worker -l info &
celery -A config beat -l info

# Monitor tasks
celery -A config flower --port=5555
```

## API Documentation

```bash
# Buka Swagger UI
python manage.py runserver
# http://localhost:8000/api/docs/

# Export schema OpenAPI
python manage.py spectacular --file schema.yml
```

## Code Quality

```bash
# Linting
flake8 apps/ --max-line-length=120
black apps/ --check

# Security scan
bandit -r apps/ -ll              # Fail on medium+

# Type checking
mypy apps/ --ignore-missing-imports
```

## Referensi

- [Config & Settings](config/README.md)
- [App: Core](apps/core/README.md)
- [App: Tenants](apps/tenants/README.md)
- [App: Flow Engine](apps/flow_engine/README.md)
- [App: Products](apps/products/README.md)
- [App: Transactions](apps/transactions/README.md)
- [App: Sync](apps/sync/README.md)
- [App: Payments](apps/payments/README.md)
- [App: Notifications](apps/notifications/README.md)
- [App: Reports](apps/reports/README.md)
- [Integration Tests](tests/README.md)
