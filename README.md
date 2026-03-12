# Enterprise Multi-Tenant SaaS Platform

Platform POS dan manajemen bisnis berbasis cloud yang melayani berbagai jenis industri dari satu infrastruktur tunggal. Perbedaan UI, UX, dan alur transaksi dikontrol via konfigurasi data — bukan kode.

## Visi

> Satu platform, satu codebase, infinite jenis bisnis.

Menambah bisnis baru = mendaftarkan JSON schema baru. Tidak ada deployment kode baru.

## Arsitektur Singkat

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare CDN                        │
│         kedai-kopi.saas.id │ laundry-bersih.saas.id     │
└────────────────────┬────────────────────────────────────┘
                     │ domain → tenant_id
         ┌───────────▼───────────┐
         │   Next.js 14 (PWA)    │  ← Server-Driven UI
         │   Service Worker      │  ← Offline-first
         │   IndexedDB           │  ← Local cache
         └───────────┬───────────┘
                     │ API calls
         ┌───────────▼───────────┐
         │   Django 5 + DRF      │  ← Multi-tenant API
         │   Flow Engine         │  ← JSON-driven flow
         │   Sync Processor      │  ← Delta sync
         └───┬───────────────┬───┘
             │               │
    ┌────────▼──┐     ┌──────▼──────┐
    │PostgreSQL │     │    Redis     │
    │(per-tenant│     │(cache+queue) │
    │  schema)  │     └─────────────┘
    └───────────┘
```

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 14+ PWA (App Router) |
| State | Zustand + mitt event bus |
| Offline | IndexedDB + Service Worker + Cache API |
| Backend | Django 5.x + Django REST Framework |
| Queue | Celery + Redis |
| Database | PostgreSQL (per-tenant schema isolation) |
| Cache | Redis |
| CDN | Cloudflare |
| Payment | Midtrans (Indonesia) + Stripe (global) |
| Monitoring | Sentry + Grafana + Prometheus |
| Native (fase 2) | React Native |

## Business Types yang Didukung

| Industri | Kode | Langkah Flow |
|----------|------|--------------|
| ☕ Coffee Shop / Kafe | `coffee_shop` | 5 |
| 👔 Laundry | `laundry` | 3 + pickup |
| 🚗 Dealer Kendaraan | `vehicle_dealer` | 7 |
| 🏥 Klinik / Puskesmas | `clinic` | 6 |
| 🏪 Retail / Minimarket | `retail_store` | 4 |
| ✂️ Salon / Barbershop | `salon_barbershop` | 4 |
| 🏨 Hotel / Guest House | `hotel_guesthouse` | 4 + checkout |
| 🍽️ Restoran | `restaurant` | 5 |

## Struktur Dokumen

```
saas-platform/
├── README.md                    ← Dokumen ini
├── docs/
│   ├── architecture/            ← Keputusan arsitektur & system design
│   ├── database/                ← Schema PostgreSQL & ER diagram
│   ├── api/                     ← API contract & endpoint spec
│   ├── components/              ← Component library specification
│   ├── business-types/          ← JSON schema per jenis bisnis
│   ├── security/                ← Security hardening & audit
│   ├── testing/                 ← Testing strategy & test plans
│   ├── deployment/              ← Infra, CI/CD, go-live checklist
│   ├── guides/                  ← How-to guides untuk developer
│   └── sprint/                  ← Sprint plan & backlog
├── backend/                     ← Django project
│   ├── apps/                    ← Django apps (core, tenants, dll)
│   ├── config/                  ← Django settings & routing
│   └── tests/                   ← Test suites
├── frontend/                    ← Next.js project
│   ├── app/                     ← App Router pages
│   ├── components/registry/     ← Component Registry (52 komponen)
│   └── lib/                     ← Utilities (api, hooks, store, sync)
├── infra/                       ← Docker, Nginx, scripts infra
└── scripts/                     ← Utility scripts
```

## Quick Start

```bash
# 1. Clone dan setup
git clone https://github.com/org/saas-platform.git
cd saas-platform

# 2. Backend
cd backend
cp .env.example .env          # isi semua variable
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_business_types
python manage.py runserver

# 3. Frontend
cd ../frontend
cp .env.local.example .env.local
npm install
npm run dev

# 4. Akses
# http://demo-coffee.localhost:3000  → Coffee Shop tenant
# http://demo-laundry.localhost:3000 → Laundry tenant
```

## Dokumentasi Lengkap

| Topik | File |
|-------|------|
| Arsitektur sistem | [docs/architecture/README.md](docs/architecture/README.md) |
| Keputusan desain (ADR) | [docs/architecture/decisions.md](docs/architecture/decisions.md) |
| Database schema | [docs/database/README.md](docs/database/README.md) |
| Flow Engine | [docs/database/flow-engine.md](docs/database/flow-engine.md) |
| API Contract | [docs/api/README.md](docs/api/README.md) |
| Semua endpoint | [docs/api/endpoints.md](docs/api/endpoints.md) |
| Component Library | [docs/components/README.md](docs/components/README.md) |
| Business Types | [docs/business-types/README.md](docs/business-types/README.md) |
| Security | [docs/security/README.md](docs/security/README.md) |
| Testing | [docs/testing/README.md](docs/testing/README.md) |
| Deployment | [docs/deployment/README.md](docs/deployment/README.md) |
| Sprint Plan | [docs/sprint/README.md](docs/sprint/README.md) |

## Role & Permission

| Level | Role | Akses |
|-------|------|-------|
| 0 | Public | Hanya halaman publik |
| 1 | Customer | Lihat status order |
| 2 | Kasir / Operator | POS, transaksi |
| 3 | Supervisor | + Approval diskon, refund |
| 4 | Branch Manager | + Laporan cabang, adjust stok |
| 5 | Tenant Admin | + Manajemen user, konfigurasi |
| 6 | Tenant Owner | + Laporan finansial, subscription |
| 7 | SaaS Admin | + Kelola semua tenant |
| 8 | SaaS Super Admin | Akses penuh |

## Status Proyek

- [ ] Sprint 1 — Foundation (Minggu 1-2)
- [ ] Sprint 2 — Core Backend (Minggu 3-4)
- [ ] Sprint 3 — Core Frontend (Minggu 5-6)
- [ ] Sprint 4 — POS Flow v1 (Minggu 7-8)
- [ ] Sprint 5 — Offline Engine (Minggu 9-10)
- [ ] Sprint 6 — Payment & Reports (Minggu 11-12)
- [ ] Sprint 7-9 — Multi Business Type (Minggu 13-18)
- [ ] Sprint 10-11 — Production Ready (Minggu 19-22)
- [ ] Sprint 12 — Scale (Minggu 23-24)
