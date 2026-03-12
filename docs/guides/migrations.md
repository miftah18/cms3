# Database Migration Guide

Panduan membuat dan menjalankan migrasi Django di environment multi-tenant.

## Konsep Dasar

Migrasi Django normal berjalan di satu database. Di platform ini, setiap tenant punya schema terpisah, sehingga migrasi harus dijalankan ke **semua schema tenant** yang ada.

## Membuat Migrasi Baru

```bash
# Buat migration file (sama seperti biasa)
python manage.py makemigrations apps.products

# Cek apakah migration valid
python manage.py migrate --run-syncdb --check

# Preview SQL yang akan dijalankan
python manage.py sqlmigrate products 0002
```

## Menjalankan Migrasi

### Development (1 tenant)

```bash
# Migrate schema public
python manage.py migrate

# Migrate 1 schema tenant
python manage.py shell -c "
from django.db import connection
with connection.cursor() as c:
    c.execute('SET search_path TO tenant_abc123, public')
from django.core.management import call_command
call_command('migrate')
"
```

### Production (semua tenant)

```bash
# Script otomatis — migrasi ke semua schema aktif
python manage.py migrate_all_tenants

# Dengan dry-run (lihat preview tanpa eksekusi)
python manage.py migrate_all_tenants --dry-run

# Migrasi hanya tenant tertentu
python manage.py migrate_all_tenants --tenant-id abc123
```

## Aturan Migrasi Multi-Tenant

### ✅ Boleh

```python
# Tambah kolom nullable — aman, tidak butuh downtime
class Migration(migrations.Migration):
    operations = [
        migrations.AddField(
            model_name='product',
            name='barcode',
            field=models.CharField(max_length=100, null=True, blank=True),
        ),
    ]

# Tambah index — aman (CONCURRENTLY di production)
migrations.AddIndex(
    model_name='product',
    index=models.Index(fields=['updated_at'], name='products_updated_idx'),
),
```

### ⚠️ Perlu Hati-hati

```python
# Rename kolom — butuh 2-3 fase deploy (backward compatible dulu)
# Fase 1: Tambah kolom baru, tulis ke keduanya
# Fase 2: Migrate data lama ke kolom baru
# Fase 3: Drop kolom lama

# Tidak boleh: langsung rename sekaligus
# ❌ migrations.RenameField(model_name='product', old_name='name', new_name='product_name')
```

### ❌ Tidak Boleh

```python
# Tambah kolom NOT NULL tanpa default — akan gagal di tenant dengan data existing
# ❌ migrations.AddField(model_name='product', name='category_id',
#       field=models.ForeignKey(..., null=False))  # Data lama tidak punya category!

# Benar: null=True dulu, isi data, baru add constraint
# ✅ Fase 1: null=True
# ✅ Fase 2: isi data
# ✅ Fase 3: AlterField null=False
```

## Zero-Downtime Migration Checklist

```
Sebelum deploy:
[ ] Migration backward compatible (app lama bisa jalan dengan schema baru)
[ ] Tidak ada LOCK yang lama (gunakan CONCURRENTLY untuk index)
[ ] Tested di staging dengan data nyata
[ ] Rollback plan tersedia

Proses:
[ ] Jalankan migrate_all_tenants (bisa saat app masih running)
[ ] Deploy app baru setelah semua tenant ter-migrasi
[ ] Verify smoke test hijau
```

## Schema Versioning

```python
# Setiap tenant menyimpan migration state masing-masing
# Django migrations table ada di setiap schema

# Cek state migrasi per tenant
python manage.py shell -c "
from apps.tenants.models import Tenant
from django.db import connection

for tenant in Tenant.objects.filter(status='active'):
    with connection.cursor() as c:
        c.execute(f'SET search_path TO {tenant.schema_name}')
        c.execute(\"SELECT app, name FROM django_migrations ORDER BY id DESC LIMIT 1\")
        last = c.fetchone()
    print(f'{tenant.name}: {last}')
"
```

## Emergency: Schema Tidak Sinkron

Jika sebuah tenant schema tertinggal migrasi karena error:

```bash
# 1. Identifikasi tenant yang bermasalah
python manage.py check_migration_status

# 2. Migrasi tenant spesifik
python manage.py migrate_all_tenants --tenant-id <uuid>

# 3. Jika masih gagal — debug manual
python manage.py shell
>>> from django.db import connection
>>> with connection.cursor() as c:
...     c.execute('SET search_path TO tenant_abc123, public')
>>> from django.core.management import call_command
>>> call_command('migrate', '--verbosity=3')
```
