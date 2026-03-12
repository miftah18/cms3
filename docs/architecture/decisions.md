# Architecture Decision Records (ADR)

Dokumen ini mencatat semua keputusan arsitektur yang signifikan beserta alasan dan trade-off-nya.

---

## ADR-001: PostgreSQL Schema per Tenant

**Status:** Accepted  
**Tanggal:** Sprint 1

### Konteks
Platform harus melayani banyak tenant dengan data yang terisolasi penuh. Tiga pilihan umum: shared database shared schema, shared database separate schema, separate database per tenant.

### Keputusan
Gunakan **shared database, separate PostgreSQL schema per tenant**.

### Alasan
- Isolasi data penuh tanpa overhead multiple database connections
- `search_path` di-set per request — ORM tidak perlu modifikasi
- Migrasi bisa dijalankan ke semua schema sekaligus
- Backup per tenant mudah via `pg_dump -n schema_name`
- Biaya infra jauh lebih rendah vs separate database

### Trade-off
- Schema per tenant bertambah → butuh monitoring jumlah schema
- Migrasi harus dijalankan ke semua tenant (perlu tooling)
- Satu PostgreSQL instance bisa jadi bottleneck (mitigasi: read replica)

---

## ADR-002: Server-Driven UI dengan Component Registry

**Status:** Accepted  
**Tanggal:** Sprint 1

### Konteks
Platform harus bisa melayani 8+ jenis bisnis dengan alur UI yang berbeda-beda tanpa deploy kode baru setiap menambah bisnis.

### Keputusan
Server mengirim **JSON blueprint UI**. Client hanya renderer menggunakan Component Registry (map kode → React component).

### Alasan
- Menambah bisnis baru = 1 JSON file, 0 kode frontend baru
- A/B testing dan rollout bertahap bisa dilakukan tanpa deploy
- White-label per tenant dengan UI berbeda tapi logic sama
- ~50 komponen dapat cover 80%+ kebutuhan semua bisnis

### Trade-off
- Komponen harus cukup fleksibel untuk semua konteks penggunaan
- Debug lebih kompleks (UI di-drive dari data, bukan kode statis)
- Perlu validasi schema di client untuk mencegah injection

---

## ADR-003: Offline-First dengan IndexedDB + Service Worker

**Status:** Accepted  
**Tanggal:** Sprint 1

### Konteks
Banyak bisnis beroperasi di area dengan koneksi internet tidak stabil (pasar, pusat perbelanjaan, dll). POS tidak boleh mati hanya karena internet putus.

### Keputusan
**PWA dengan IndexedDB** sebagai local database. Service Worker untuk cache assets dan schema. SyncManager untuk upload delta saat online.

### Alasan
- PWA bisa diinstall di Android/iOS tanpa App Store
- IndexedDB support query kompleks (tidak seperti localStorage)
- Service Worker intercept semua network request → full control
- Tidak perlu React Native di fase pertama (kurangi complexity)

### Trade-off
- IndexedDB API verbose — perlu wrapper library (idb)
- Service Worker lifecycle kompleks, perlu testing khusus
- Conflict resolution saat sync bisa complex (first_sync_wins tidak selalu benar)
- iOS Safari masih ada limitasi Service Worker

---

## ADR-004: Flow Engine berbasis JSON Schema

**Status:** Accepted  
**Tanggal:** Sprint 1

### Konteks
Setiap jenis bisnis punya alur transaksi berbeda: Coffee shop 5 langkah, Dealer 7 langkah, Klinik 6 langkah. Harus bisa dikonfigurasi tanpa kode baru.

### Keputusan
Simpan **flow definition sebagai JSONB** di tabel `business_types`. `FlowRenderer` di frontend membaca schema dan render step-by-step.

### Alasan
- Alur transaksi bisa diubah real-time tanpa deploy
- Versioning flow (v1, v2) memungkinkan gradual rollout
- Tenant bisa pilih versi flow yang mereka inginkan
- Testable — schema bisa divalidasi sebelum di-deploy ke tenant

### Trade-off
- Flow yang sangat custom (kondisional kompleks) butuh "micro-engine" tambahan
- Debugging flow lebih sulit tanpa tooling khusus
- Schema validation harus ketat untuk mencegah invalid flow

---

## ADR-005: JWT dengan RS256 (bukan HS256)

**Status:** Accepted  
**Tanggal:** Sprint 1

### Konteks
Platform multi-tenant memerlukan token yang bisa diverifikasi oleh berbagai service tanpa berbagi secret key.

### Keputusan
Gunakan **RS256 (RSA asymmetric)** untuk JWT. Private key hanya di backend, public key bisa dishare ke semua service.

### Alasan
- Service lain bisa verify token tanpa tau private key
- Lebih aman: compromise di satu service tidak expose signing key
- Standard industri untuk distributed systems

### Trade-off
- RSA signing lebih lambat dari HMAC (tapi negligible untuk auth)
- Perlu key rotation strategy
- Key management lebih kompleks

---

## ADR-006: Delta Sync — Upload, Bukan Full State

**Status:** Accepted  
**Tanggal:** Sprint 1

### Konteks
Device offline bisa mengumpulkan banyak transaksi. Upload full state setiap sync terlalu berat.

### Keputusan
Upload **hanya delta** (perubahan sejak sync terakhir) via `POST /sync/delta/`. Setiap item punya `local_id` untuk deduplication.

### Alasan
- Bandwidth efisien — hanya upload yang berubah
- Idempotent — upload ulang item yang sama aman
- `local_id` (UUID di client) mencegah duplicate transaksi
- Conflict bisa dideteksi per item, bukan seluruh state

### Trade-off
- Perlu `sync_queue` table untuk tracking status per item
- Client harus maintain timestamp sync terakhir
- Conflict resolution logic bisa kompleks untuk kasus edge

---

## ADR-007: Celery untuk Async Tasks

**Status:** Accepted  
**Tanggal:** Sprint 1

### Konteks
Beberapa operasi tidak perlu dilakukan synchronous: kirim email, generate PDF report, notifikasi push.

### Keputusan
Gunakan **Celery + Redis** untuk semua async tasks. Redis juga dipakai sebagai cache.

### Alasan
- Battle-tested di Django ecosystem
- Redis sudah dipakai untuk cache — dual purpose, kurangi infra
- Retry otomatis built-in
- Flower untuk monitoring tasks

### Trade-off
- Celery workers butuh server tambahan (atau containerized)
- Task failure perlu monitoring khusus
- Eventual consistency untuk operasi async

---

## ADR-008: Cloudflare untuk Multi-Domain Routing

**Status:** Accepted  
**Tanggal:** Sprint 1

### Konteks
Setiap tenant punya domain sendiri (bisa custom domain atau subdomain). Perlu routing dari domain ke tenant tanpa server logic.

### Keputusan
**Cloudflare** inject header `x-tenant-domain` di edge. Next.js middleware baca header ini, backend middleware resolve ke tenant_id.

### Alasan
- Zero latency domain resolution di edge (bukan di origin server)
- SSL otomatis untuk semua domain (Cloudflare Universal SSL)
- WAF dan DDoS protection tanpa setup tambahan
- DNS propagation di-manage Cloudflare

### Trade-off
- Vendor lock-in pada Cloudflare
- Custom domain tenant perlu setup DNS manual
- Cloudflare outage = semua tenant terdampak (mitigasi: fallback direct)

---

## ADR-009: React Native untuk Fase 2 (bukan React Native dari awal)

**Status:** Accepted  
**Tanggal:** Sprint 1

### Konteks
Native app (iOS/Android) memberikan UX lebih baik terutama untuk offline dan kamera (barcode scan). Tapi complexity tinggi jika dibangun dari awal bersamaan.

### Keputusan
**PWA dulu** di fase 1. React Native di fase 2 setelah platform proven di production.

### Alasan
- PWA bisa diinstall tanpa App Store
- Satu codebase (Next.js) untuk web dan mobile web
- Kurangi initial complexity — fokus ke business logic
- Share logic (api client, store, sync) ke React Native saat saatnya

### Trade-off
- Beberapa fitur native tidak tersedia di PWA (background sync terbatas di iOS)
- Kamera PWA kurang optimal vs native untuk barcode scan di iOS
- Notifikasi push PWA terbatas di iOS

---

## ADR-010: Monorepo (satu repo, Django + Next.js)

**Status:** Accepted  
**Tanggal:** Sprint 1

### Konteks
Backend (Django) dan frontend (Next.js) bisa dipisah repo atau digabung satu repo.

### Keputusan
**Monorepo** — satu repository berisi backend dan frontend.

### Alasan
- Atomic commits (ubah API dan frontend sekaligus dalam 1 commit)
- Mudah sharing types dan schema
- Satu CI/CD pipeline
- Developer bisa lihat konteks penuh di satu tempat

### Trade-off
- Repo semakin besar seiring waktu
- Permission lebih sulit (semua developer lihat semua kode)
- CI/CD butuh path filtering agar tidak rebuild semua saat 1 file berubah
