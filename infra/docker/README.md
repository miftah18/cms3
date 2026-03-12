# Docker

Semua Dockerfile dan Docker Compose untuk development dan production.

## Dockerfile Backend

```dockerfile
# infra/docker/backend/Dockerfile
# Stage 1: Dependencies
FROM python:3.12-slim AS deps
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Application
FROM python:3.12-slim AS app
WORKDIR /app
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
COPY . .

# Security: non-root user
RUN adduser --disabled-password --gecos '' appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
CMD ["./infra/docker/backend/entrypoint.sh"]
```

## entrypoint.sh

```bash
#!/bin/bash
# infra/docker/backend/entrypoint.sh
set -e

# Tunggu PostgreSQL siap
echo "Waiting for PostgreSQL..."
while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
  sleep 1
done
echo "PostgreSQL ready."

# Tunggu Redis siap
echo "Waiting for Redis..."
while ! redis-cli -h "$REDIS_HOST" ping | grep -q "PONG"; do
  sleep 1
done
echo "Redis ready."

# Jalankan migrasi
echo "Running migrations..."
python manage.py migrate --noinput

# Seed business types jika belum ada
echo "Seeding business types..."
python manage.py seed_business_types

# Collect static files
python manage.py collectstatic --noinput

# Start Gunicorn
echo "Starting Gunicorn..."
exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 4 \
  --worker-class gthread \
  --threads 2 \
  --worker-connections 1000 \
  --timeout 30 \
  --keep-alive 5 \
  --log-level info \
  --access-logfile - \
  --error-logfile -
```

## Dockerfile Frontend

```dockerfile
# infra/docker/frontend/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

## docker-compose.prod.yml

```yaml
# infra/docker/docker-compose.prod.yml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB:       saas_db
      POSTGRES_USER:     saas_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/postgresql.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U saas_user -d saas_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s

  backend:
    build:
      context: ../../backend
      dockerfile: ../infra/docker/backend/Dockerfile
    restart: always
    env_file: ../../backend/.env
    depends_on:
      db:    { condition: service_healthy }
      redis: { condition: service_healthy }
    volumes:
      - media_files:/app/media
    deploy:
      replicas: 2
      update_config:
        parallelism: 1          # Rolling deploy — update 1 instance sekaligus
        delay: 30s
        order: start-first      # Jalankan instance baru sebelum matikan yang lama

  celery:
    build:
      context: ../../backend
      dockerfile: ../infra/docker/backend/Dockerfile
    restart: always
    command: celery -A config worker -l info -Q default,reports,notifications
    env_file: ../../backend/.env
    depends_on:
      - db
      - redis

  celery-beat:
    build:
      context: ../../backend
      dockerfile: ../infra/docker/backend/Dockerfile
    restart: always
    command: celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
    env_file: ../../backend/.env
    depends_on:
      - db
      - redis

  frontend:
    build:
      context: ../../frontend
      dockerfile: ../infra/docker/frontend/Dockerfile
    restart: always
    env_file: ../../frontend/.env.production
    deploy:
      replicas: 2

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ../nginx/nginx.conf:/etc/nginx/nginx.conf
      - ../nginx/conf.d:/etc/nginx/conf.d
      - ../nginx/ssl:/etc/nginx/ssl
      - static_files:/app/static
      - media_files:/app/media
    depends_on:
      - backend
      - frontend

  flower:
    image: mher/flower
    restart: always
    command: celery flower --broker=${REDIS_URL}
    environment:
      CELERY_BROKER_URL: ${REDIS_URL}
    ports:
      - "5555:5555"   # Internal only — tidak exposed ke internet

volumes:
  postgres_data:
  redis_data:
  static_files:
  media_files:
```
