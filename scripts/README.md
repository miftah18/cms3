# Scripts

Utility scripts untuk deployment, backup, migrasi, dan maintenance.

## Daftar Scripts

```
scripts/
├── deploy.sh              ← Zero-downtime deployment ke production
├── rollback.sh            ← Rollback ke image sebelumnya
├── backup.sh              ← Backup semua schema PostgreSQL
├── restore.sh             ← Restore dari backup
├── smoke_test.sh          ← Sanity check pasca deploy
├── migrate_all_tenants.sh ← Jalankan migrasi ke semua tenant schema
└── provision_tenant.sh    ← Provision schema baru untuk tenant
```

---

## deploy.sh

```bash
#!/bin/bash
# scripts/deploy.sh — Zero-downtime rolling deploy
set -euo pipefail

ENV=${1:-production}
COMPOSE_FILE="infra/docker/docker-compose.prod.yml"

echo "🚀 Deploying to $ENV..."

# 1. Pull image terbaru
echo "Pulling latest images..."
docker-compose -f $COMPOSE_FILE pull

# 2. Build image baru
echo "Building images..."
docker-compose -f $COMPOSE_FILE build --no-cache backend frontend

# 3. Jalankan migrasi dulu (backward compatible)
echo "Running migrations..."
docker-compose -f $COMPOSE_FILE run --rm backend python manage.py migrate --noinput

# 4. Rolling restart backend (replicas bergantian)
echo "Restarting backend (rolling)..."
docker-compose -f $COMPOSE_FILE up -d --no-deps --scale backend=4 backend
sleep 15
docker-compose -f $COMPOSE_FILE up -d --no-deps --scale backend=2 backend

# 5. Rolling restart frontend
echo "Restarting frontend (rolling)..."
docker-compose -f $COMPOSE_FILE up -d --no-deps --scale frontend=4 frontend
sleep 10
docker-compose -f $COMPOSE_FILE up -d --no-deps --scale frontend=2 frontend

# 6. Restart celery (tidak perlu rolling — stateless)
echo "Restarting Celery..."
docker-compose -f $COMPOSE_FILE up -d --no-deps celery celery-beat

# 7. Smoke test
echo "Running smoke tests..."
./scripts/smoke_test.sh

echo "✅ Deploy successful!"
```

---

## rollback.sh

```bash
#!/bin/bash
# scripts/rollback.sh — Rollback ke image sebelumnya
set -euo pipefail

COMPOSE_FILE="infra/docker/docker-compose.prod.yml"

echo "⚠️  Rolling back..."

# Ambil image sebelumnya dari Docker
PREV_BACKEND=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "saas-backend" | sed -n '2p')
PREV_FRONTEND=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "saas-frontend" | sed -n '2p')

if [ -z "$PREV_BACKEND" ]; then
  echo "❌ Tidak ada image sebelumnya untuk backend"
  exit 1
fi

echo "Rolling back to: $PREV_BACKEND, $PREV_FRONTEND"

# Update compose untuk gunakan image lama
export BACKEND_IMAGE=$PREV_BACKEND
export FRONTEND_IMAGE=$PREV_FRONTEND

docker-compose -f $COMPOSE_FILE up -d --no-deps backend frontend

sleep 10
./scripts/smoke_test.sh && echo "✅ Rollback berhasil!" || echo "❌ Rollback juga gagal — cek manual"
```

---

## backup.sh

```bash
#!/bin/bash
# scripts/backup.sh — Backup semua schema PostgreSQL
set -euo pipefail

BACKUP_DIR="/var/backups/saas-platform"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p $BACKUP_DIR

echo "📦 Starting backup $DATE..."

# Backup schema public (tenant master data)
pg_dump $DATABASE_URL \
  --schema=public \
  --no-owner \
  --no-privileges \
  --format=custom \
  --file="$BACKUP_DIR/public_$DATE.dump"
echo "✓ public schema backed up"

# Backup semua schema tenant
SCHEMAS=$(psql $DATABASE_URL -t -c \
  "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'")

for SCHEMA in $SCHEMAS; do
  SCHEMA=$(echo $SCHEMA | tr -d ' ')
  pg_dump $DATABASE_URL \
    --schema=$SCHEMA \
    --no-owner \
    --no-privileges \
    --format=custom \
    --file="$BACKUP_DIR/${SCHEMA}_$DATE.dump"
  echo "✓ $SCHEMA backed up"
done

# Upload ke S3/GCS
aws s3 sync $BACKUP_DIR s3://saas-backups/postgresql/$DATE/ --storage-class STANDARD_IA
echo "✓ Uploaded to S3"

# Hapus backup lama
find $BACKUP_DIR -name "*.dump" -mtime +$RETENTION_DAYS -delete
echo "✓ Old backups cleaned up"

echo "✅ Backup complete: $DATE"
```

---

## smoke_test.sh

```bash
#!/bin/bash
# scripts/smoke_test.sh — Quick sanity check pasca deploy
set -euo pipefail

BASE_URL=${1:-https://api.saas.id}
FRONTEND_URL=${2:-https://demo-coffee.saas.id}

echo "🔍 Running smoke tests..."

# 1. Backend health check
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health/")
[ "$STATUS" = "200" ] && echo "✓ Backend health: OK" || { echo "❌ Backend health: $STATUS"; exit 1; }

# 2. Flow schema endpoint
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: demo-coffee.saas.id" "$BASE_URL/api/v1/flow/schema/")
[ "$STATUS" = "401" ] && echo "✓ Flow schema (auth required): OK" || { echo "❌ Flow schema: $STATUS"; exit 1; }

# 3. Frontend load
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
[ "$STATUS" = "200" ] && echo "✓ Frontend: OK" || { echo "❌ Frontend: $STATUS"; exit 1; }

# 4. PWA manifest
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/manifest.json")
[ "$STATUS" = "200" ] && echo "✓ PWA manifest: OK" || { echo "❌ PWA manifest: $STATUS"; exit 1; }

# 5. Midtrans webhook endpoint (harus 400 tanpa payload, bukan 404/500)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/payments/webhook/midtrans/")
[ "$STATUS" = "400" ] || [ "$STATUS" = "403" ] && echo "✓ Midtrans webhook: OK" || { echo "❌ Midtrans webhook: $STATUS"; exit 1; }

echo "✅ All smoke tests passed!"
```

---

## migrate_all_tenants.sh

```bash
#!/bin/bash
# scripts/migrate_all_tenants.sh — Migrasi ke semua tenant schema
set -euo pipefail

echo "📋 Migrating all tenant schemas..."

docker-compose -f infra/docker/docker-compose.prod.yml run --rm backend \
  python manage.py migrate_all_tenants

echo "✅ All tenants migrated"
```

---

## provision_tenant.sh

```bash
#!/bin/bash
# scripts/provision_tenant.sh — Provision schema untuk tenant baru
set -euo pipefail

TENANT_ID=${1:?"Usage: $0 <tenant_id>"}

echo "🏗️  Provisioning tenant: $TENANT_ID"

docker-compose -f infra/docker/docker-compose.prod.yml run --rm backend \
  python manage.py provision_tenant $TENANT_ID

echo "✅ Tenant $TENANT_ID provisioned"
```
