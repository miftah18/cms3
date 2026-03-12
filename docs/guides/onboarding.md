# Onboarding Guide — Tenant Baru

Panduan untuk tim sales / support saat onboarding tenant baru ke platform.

## Overview

Target: tenant baru bisa langsung transaksi dalam **< 30 menit** setelah daftar.

## Langkah Onboarding

### 1. Registrasi (5 menit)

Tenant mengisi form di `https://saas.id/register`:
- Nama bisnis
- Jenis bisnis (pilih dari dropdown 8 pilihan)
- Email pemilik
- Nomor telepon
- Kota

Sistem otomatis:
- Buat record `Tenant` di database
- Generate `schema_name` = `tenant_{uuid_hex}`
- Assign subdomain default: `{slug}.saas.id`
- Kirim email konfirmasi

### 2. Verifikasi Email (2 menit)

Email konfirmasi dikirim → klik link → akun aktif.

### 3. Provisioning Schema (< 30 detik otomatis)

Setelah email verified, background task:
```
TenantProvisioner.provision()
  ├─ CREATE SCHEMA tenant_{id}
  ├─ Jalankan semua Django migrations ke schema baru
  ├─ Seed data awal:
  │   ├─ Branch default (nama bisnis)
  │   ├─ Tenant Owner account
  │   └─ Kategori produk default per business type
  └─ Update tenant.status = 'trial'
```

### 4. Setup Awal oleh Tenant Owner (10 menit)

Login ke `https://{slug}.saas.id` → Wizard Setup:

**Step 1: Profil Bisnis**
- Upload logo
- Warna tema utama
- Alamat & kontak

**Step 2: Konfigurasi Pembayaran**
- Masukkan Midtrans Server Key & Client Key (dari dashboard Midtrans)
- Test koneksi → hijau kalau berhasil
- Aktifkan payment methods yang diinginkan

**Step 3: Tambah Kasir/Staff**
- Email kasir → sistem kirim invitation
- Assign ke cabang

**Step 4: Input Produk**
- Manual 1 per 1, atau
- Import dari Excel (template tersedia)

**Step 5: Test Transaksi**
- Wizard bimbing kasir melakukan 1 transaksi percobaan
- Struk dummy dicetak / ditampilkan

### 5. Custom Domain (Opsional, 15 menit)

Jika tenant ingin custom domain (`pos.kedaikopi.com`):

1. Tenant beli domain atau gunakan yang sudah ada
2. Di settings → Custom Domain → masukkan domain
3. Ikuti instruksi DNS:
   ```
   Tambah CNAME record:
   pos.kedaikopi.com → {slug}.saas.id
   ```
4. Tunggu propagasi DNS (5-30 menit)
5. SSL otomatis diaktifkan via Cloudflare

### 6. Aktivasi Langganan

Trial 14 hari gratis. Sebelum habis → pilih plan:

| Plan | Harga | Transaksi/bulan | Cabang | User |
|------|-------|----------------|--------|------|
| Starter | Rp 299.000 | 3.000 | 1 | 5 |
| Professional | Rp 699.000 | 15.000 | 5 | 25 |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited |

Pembayaran via Midtrans Subscription — auto-charge setiap bulan.

## Checklist Onboarding Selesai

```
[ ] Email terverifikasi
[ ] Schema ter-provisioning
[ ] Minimal 1 cabang aktif
[ ] Minimal 1 kasir terdaftar
[ ] Minimal 5 produk terinput
[ ] Midtrans credentials terkonfigurasi
[ ] 1 transaksi test berhasil
[ ] Plan dipilih (atau masih trial)
```

## Support Resources

- Video tutorial per role tersedia di dalam app (Settings → Tutorial)
- WhatsApp support: +62-xxx-xxxx-xxxx (jam kerja)
- Email: support@saas.id
- Dokumentasi: https://docs.saas.id
