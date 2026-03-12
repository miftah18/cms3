# Deployment

## Environment Variables

```bash
# backend/.env
SECRET_KEY=your-django-secret-key
DEBUG=false
ALLOWED_HOSTS=.saas.id,.yourdomain.com

DATABASE_URL=postgresql://user:pass@host:5432/saas_db
REDIS_URL=redis://host:6379/0

JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."

SYNC_SECRET_KEY=your-hmac-secret

MIDTRANS_SERVER_KEY=Mid-server-xxxx
MIDTRANS_CLIENT_KEY=Mid-client-xxxx
MIDTRANS_IS_PRODUCTION=true

SENDGRID_API_KEY=SG.xxxxx
SENTRY_DSN=https://xxx@sentry.io/xxx

# frontend/.env.local
NEXT_PUBLIC_API_URL=https://api.saas.id
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=Mid-client-xxxx
NEXT_PUBLIC_SYNC_SECRET=your-hmac-secret
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

## Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: saas_db
      POSTGRES_USER: saas_user
      POSTGRES_PASSWORD: saas_pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  backend:
    build: ./backend
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - ./backend:/app
    ports:
      - "8000:8000"
    depends_on:
      - db
      - redis

  celery:
    build: ./backend
    command: celery -A config worker -l info
    depends_on:
      - redis

  frontend:
    build: ./frontend
    command: npm run dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
```

## Go-Live Sequence (17 Langkah)

| # | Langkah | PIC | Estimasi |
|---|---------|-----|---------|
| 1 | Setup server production dan konfigurasi firewall | DevOps | 2 jam |
| 2 | Deploy PostgreSQL dengan replication dan PgBouncer | DevOps | 3 jam |
| 3 | Deploy Redis cluster | DevOps | 1 jam |
| 4 | Setup Cloudflare — DNS, SSL, WAF | DevOps | 2 jam |
| 5 | Deploy backend Django, jalankan migrations, seed data | Backend | 1 jam |
| 6 | Deploy frontend Next.js, verifikasi PWA manifest | Frontend | 1 jam |
| 7 | Deploy Celery workers dan Flower monitoring | DevOps | 1 jam |
| 8 | Setup Sentry — backend dan frontend | DevOps | 30 mnt |
| 9 | Setup Grafana + Prometheus dashboards | DevOps | 2 jam |
| 10 | Jalankan automated tests di production environment | QA | 1 jam |
| 11 | Jalankan security scan (Bandit, npm audit, ZAP) | Security | 2 jam |
| 12 | Load test 100 user — verifikasi response time | QA | 1 jam |
| 13 | Test onboarding tenant pertama (staging tenant) | QA | 30 mnt |
| 14 | Test full transaction flow offline → sync | QA | 1 jam |
| 15 | Aktifkan monitoring alerts | DevOps | 30 mnt |
| 16 | Review production checklist — 100% hijau | Tech Lead | 1 jam |
| 17 | Go live! | Team | — |

## Production Checklist Ringkas

```
Security:
  [x] JWT RS256
  [x] PostgreSQL RLS
  [x] Rate limiting
  [x] Bandit 0 critical
  [x] npm audit 0 high

Performance:
  [x] P95 < 300ms
  [x] Lighthouse > 90 mobile
  [x] Load test 1000 user lulus

Reliability:
  [x] Backup harian aktif
  [x] Restore tested < 15 menit
  [x] Monitoring + alerting aktif
  [x] Health check 200 semua

Operational:
  [x] Onboarding flow tested
  [x] Midtrans production credentials
  [x] Email SendGrid verified
  [x] Privacy Policy & ToS tersedia
```

## Alerting Rules

| Alert | Threshold | Aksi |
|-------|-----------|------|
| API Error Rate Tinggi | > 1% dalam 5 menit | PagerDuty + Email |
| Sync Queue Backlog | > 1000 item pending | Email Tenant Admin |
| DB Slow Query | > 1 detik rata-rata | Alert DevOps |
| Memory Usage | > 85% | Auto-scale + alert |
| Tenant Subscription Expired | H-7 | Email Tenant Owner |
| Failed Login Berulang | > 10 gagal/menit per IP | Block IP + alert |

## CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run backend tests
        run: cd backend && pytest --cov=apps --cov-fail-under=80
      - name: Run frontend tests
        run: cd frontend && npm test
      - name: Security scan
        run: bandit -r backend/ && npm audit --audit-level=high

  deploy:
    needs: test
    steps:
      - name: Deploy to production
        run: ./scripts/deploy.sh production
      - name: Run smoke tests
        run: ./scripts/smoke_test.sh
      - name: Notify team
        if: failure()
        run: ./scripts/notify_rollback.sh
```
