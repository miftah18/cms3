# Business Type Catalog

8 jenis bisnis yang siap digunakan sejak hari pertama. Setiap business type adalah JSON schema yang di-seed ke database — menambah bisnis ke-9 hanya butuh 1 file JSON baru.

## Daftar Business Type

| Kode | Nama | Steps | Kompleksitas |
|------|------|-------|--------------|
| `coffee_shop` | Coffee Shop / Kafe | 5 | Rendah |
| `laundry` | Laundry | 3 + pickup | Sedang |
| `vehicle_dealer` | Dealer Kendaraan | 7 | Tinggi |
| `clinic` | Klinik / Puskesmas | 6 | Tinggi |
| `retail_store` | Retail / Minimarket | 4 | Rendah |
| `salon_barbershop` | Salon / Barbershop | 4 | Sedang |
| `hotel_guesthouse` | Hotel / Guest House | 4 + checkout | Tinggi |
| `restaurant` | Restoran | 5 | Sedang |

## Detail Singkat

### ☕ Coffee Shop (`coffee_shop`)
Flow: Pilih Menu → Keranjang → Bayar → Konfirmasi → Struk  
Fitur khusus: Kitchen display, loyalty points, shift management  
Offline cache: 500 produk, 8 jam TTL

### 👔 Laundry (`laundry`)
Flow: Input Cucian → Kalkulasi → Bayar | Extra: Scan Tiket → Konfirmasi → Struk  
Fitur khusus: DP system, WhatsApp notifikasi, order status tracking  
Offline cache: Products + customers, 24 jam TTL

### 🚗 Dealer (`vehicle_dealer`)
Flow: Data Prospek → Pilih Unit → Test Drive → Negosiasi → Dokumen → DP → Serah Terima  
Fitur khusus: Supervisor approval untuk diskon besar, BAST generate, leasing integration  
Conflict resolution: Manual review (unit unik)

### 🏥 Klinik (`clinic`)
Flow: Pendaftaran → Antrian → Konsultasi (SOAP) → Resep → Kasir → Bukti  
Fitur khusus: ICD-10 search, drug interaction check, BPJS support, rekam medis  
Privacy: Data sensitivity high, audit semua akses

### 🏪 Retail (`retail_store`)
Flow: Scan Barang → Review → Bayar → Struk  
Fitur khusus: Barcode scanner POS, 5000 produk cache, membership card, Z-report  
Offline cache: 5000 produk, 6 jam TTL

### ✂️ Salon (`salon_barbershop`)
Flow: Booking → Pilih Layanan → Bayar → Struk  
Fitur khusus: Time slot booking, pilih stylist, tips tracking, komisi 30%

### 🏨 Hotel (`hotel_guesthouse`)
Flow Check-in: Reservasi → Data Tamu → Bayar → Kunci Kamar  
Flow Check-out: Bill → Tambahan → Pelunasan → Struk  
Fitur khusus: Room occupancy tracking, deposit, police report tamu asing

### 🍽️ Restoran (`restaurant`)
Flow: Pilih Meja → Order → Bill → Bayar → Struk  
Fitur khusus: Table map, multi-round order, split bill, service charge + PPN otomatis

## Seed Command

```bash
# Seed semua 8 business type
python manage.py seed_business_types

# Validasi semua schema
python manage.py validate_flow_schemas

# Lihat daftar yang ter-seed
python manage.py shell -c "from apps.tenants.models import BusinessType; print(BusinessType.objects.values_list('code','version'))"
```

## Menambah Business Type Baru

```bash
# 1. Buat file JSON schema di fixtures/
touch backend/apps/tenants/fixtures/business_types/apotek_v1.json

# 2. Isi JSON schema mengikuti struktur yang ada
# (lihat contoh di coffee_shop_v1.json)

# 3. Seed ke database
python manage.py seed_business_types --type apotek

# 4. Daftarkan komponen baru yang dibutuhkan ke ComponentRegistry
# frontend/components/registry/index.ts
```

## Referensi Schema

- [coffee_shop_v1.json](../../backend/apps/tenants/fixtures/business_types/)
- [Flow Engine Documentation](../database/flow-engine.md)
- [Component Library](../components/README.md)
