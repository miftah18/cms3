# Sprint Plan & Roadmap

12 sprint, 24 minggu, dari nol hingga 10 tenant berbayar.

## Ringkasan Roadmap

| Sprint | Nama | Minggu | SP | Milestone |
|--------|------|--------|----|-----------|
| 1 | Foundation | 1-2 | 40 | M1 |
| 2 | Core Backend | 3-4 | 42 | M1 |
| 3 | Core Frontend | 5-6 | 38 | M1 |
| 4 | POS Flow v1 | 7-8 | 44 | M2 |
| 5 | Offline Engine | 9-10 | 46 | M2 |
| 6 | Payment & Reports | 11-12 | 40 | M2 |
| 7 | Business Type #2-3 | 13-14 | 42 | M3 |
| 8 | Business Type #4-5 | 15-16 | 44 | M3 |
| 9 | Business Type #6-8 | 17-18 | 46 | M3 |
| 10 | Security & Testing | 19-20 | 40 | M4 |
| 11 | Production Deploy | 21-22 | 38 | M4 |
| 12 | Scale & Stabilisasi | 23-24 | 36 | M5 |

**Total: 496 Story Points | 1 SP ≈ 4 jam kerja efektif**

## Milestones

### 🏛️ M1 — Foundation (Sprint 1-3, Minggu 1-6)
**Sprint 1:** Infra, PostgreSQL multi-tenant, Redis, JWT auth, tenant isolation test  
**Sprint 2:** FlowEngine, Products API, Transactions API, Delta Sync, Unit Tests  
**Sprint 3:** Next.js PWA, Service Worker, Zustand stores, Event Bus, 10 Core Components

✅ **Done when:** Login API berjalan, FlowRenderer render schema, PWA bisa diinstall

### 🛒 M2 — Core POS (Sprint 4-6, Minggu 7-12)
**Sprint 4:** Coffee shop flow E2E (5 langkah), ProductGrid, CartSummary, PaymentMethod  
**Sprint 5:** Offline engine lengkap — IndexedDB queue, SyncManager, Leader election, PIN auth  
**Sprint 6:** Midtrans penuh, laporan harian, shift management, load test 100 user

✅ **Done when:** Coffee shop bisa jual offline dan sync otomatis, Midtrans berjalan

### 🏢 M3 — Multi-Business (Sprint 7-9, Minggu 13-18)
**Sprint 7:** Laundry + Retail — 7 komponen baru  
**Sprint 8:** Klinik (SOAP, BPJS) + Salon (booking, komisi)  
**Sprint 9:** Dealer (7 langkah, BAST) + Hotel + Restoran (table map)

✅ **Done when:** 8 business type berjalan, 52 komponen selesai

### 🔒 M4 — Production Ready (Sprint 10-11, Minggu 19-22)
**Sprint 10:** Security hardening, load test 1000 user, E2E coverage semua flow  
**Sprint 11:** CI/CD, monitoring live, first paying tenant onboard

✅ **Done when:** Checklist production 100% hijau, first paying tenant aktif

### 📈 M5 — Scale (Sprint 12, Minggu 23-24)
**Sprint 12:** Bug fix dari feedback, onboard 10 tenant, React Native boilerplate

✅ **Done when:** 10 tenant aktif, P95 < 300ms di load nyata

## Tim

| Role | Jam/Minggu | Sprint Aktif |
|------|-----------|--------------|
| Backend Developer | 40 jam | Sprint 1-12 semua |
| Frontend Developer | 40 jam | Sprint 1-12 semua |
| DevOps Engineer | 20 jam | Sprint 1, 10-11 full; sisanya 10 jam |
| QA Engineer | 20 jam | Sprint 2-11 aktif |
| Product Manager | 20 jam | Sepanjang proyek |

## Definition of Done (Global)

Setiap task dianggap done jika:
- [ ] Kode di-review oleh minimal 1 developer lain
- [ ] Unit tests ditulis (jika applicable)
- [ ] CI pipeline hijau
- [ ] Dokumentasi di-update (jika ada perubahan API/schema)
- [ ] Tidak ada regresi di test suite yang ada

## Risk Register

| Risiko | Kemungkinan | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| Velocity < 35 SP/sprint | Sedang | Tinggi | Kurangi scope, tunda nice-to-have |
| Offline sync lebih kompleks dari estimasi | Tinggi | Tinggi | Sprint 5 punya buffer, BE+FE full focus |
| Developer sakit / keluar | Sedang | Tinggi | Dokumentasi sprint lengkap, pair programming |
| Midtrans integrasi sulit | Rendah | Sedang | Start sandbox di Sprint 4, buffer di Sprint 6 |
| Load test tidak lulus | Sedang | Tinggi | Performance testing tiap sprint |
| Scope creep | Tinggi | Sedang | PM gate semua request baru ke backlog |

## Sprint Ceremony Schedule

```
Senin    08:00 — Sprint Planning (2 jam)
Selasa   09:00 — Daily Standup (15 menit)
Rabu     09:00 — Daily Standup (15 menit)
Kamis    09:00 — Daily Standup (15 menit)
Jumat    09:00 — Daily Standup (15 menit)
         16:00 — Sprint Review + Retrospective (2 jam, akhir sprint saja)
```
