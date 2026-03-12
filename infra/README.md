# Infra — Infrastructure & Deployment

Konfigurasi Docker, Nginx, dan scripts untuk deployment production.

## Struktur

```
infra/
├── docker/
│   ├── backend/
│   │   ├── Dockerfile             ← Multi-stage build Django
│   │   └── entrypoint.sh          ← Wait DB, migrate, start gunicorn
│   ├── frontend/
│   │   └── Dockerfile             ← Multi-stage build Next.js
│   ├── celery/
│   │   └── Dockerfile             ← Celery worker (sama base image dengan backend)
│   └── docker-compose.prod.yml    ← Production compose dengan semua services
├── nginx/
│   ├── nginx.conf                 ← Main Nginx config
│   ├── conf.d/
│   │   ├── upstream.conf          ← Upstream backend dan frontend
│   │   ├── saas.conf              ← Virtual host utama
│   │   └── security.conf          ← Security headers, rate limit
│   └── ssl/                       ← SSL certs (dikelola Cloudflare/Let's Encrypt)
└── scripts/
    ├── deploy.sh                  ← Zero-downtime deployment
    ├── rollback.sh                ← Rollback ke versi sebelumnya
    ├── backup.sh                  ← Backup PostgreSQL semua schema
    └── smoke_test.sh              ← Quick sanity check setelah deploy
```
