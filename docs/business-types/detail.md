# Business Type Detail: Coffee Shop

**Kode:** `coffee_shop` | **Versi:** v1 | **Langkah:** 5

## Flow Transaksi

```
Step 1: Pilih Menu (product_grid)
        ↓ emit: ITEMS_SELECTED
Step 2: Review Keranjang (cart_summary)
        ↓ emit: CART_CONFIRMED
Step 3: Pilih Pembayaran (payment_method)
        ↓ emit: PAYMENT_PROCESSED
Step 4: Konfirmasi Order (order_confirm)
        ↓ emit: ORDER_COMPLETE
Step 5: Struk (print_receipt)
        ↓ emit: FLOW_END
```

## JSON Schema Lengkap

```json
{
  "business_type": "coffee_shop",
  "version": "v1",
  "display_name": "Coffee Shop / Kafe",
  "icon": "coffee",
  "transaction_flow": [
    {
      "step": 1, "key": "select_items", "label": "Pilih Menu",
      "component": "product_grid",
      "props": {
        "show_search": true, "show_categories": true,
        "grid_columns": 3, "show_image": true,
        "allow_notes_per_item": true,
        "send_to_kitchen": false
      },
      "validation": { "min_items": 1 },
      "on_complete": "emit:ITEMS_SELECTED",
      "can_go_back": false
    },
    {
      "step": 2, "key": "review_cart", "label": "Keranjang",
      "component": "cart_summary",
      "props": {
        "allow_qty_edit": true, "allow_remove": true,
        "show_notes": true, "allow_promo_code": false,
        "tax_percent": 0, "service_charge_percent": 0
      },
      "on_complete": "emit:CART_CONFIRMED",
      "can_go_back": true
    },
    {
      "step": 3, "key": "payment", "label": "Pembayaran",
      "component": "payment_method",
      "props": {
        "allowed": ["cash", "qris", "midtrans", "debit_card"],
        "cashback_display": true, "allow_split": false
      },
      "on_complete": "emit:PAYMENT_PROCESSED",
      "can_go_back": true
    },
    {
      "step": 4, "key": "confirm", "label": "Konfirmasi",
      "component": "order_confirm",
      "props": { "auto_advance_seconds": 3, "show_lottie": true },
      "on_complete": "emit:ORDER_COMPLETE",
      "can_go_back": false
    },
    {
      "step": 5, "key": "receipt", "label": "Struk",
      "component": "print_receipt",
      "props": {
        "format": "thermal_80mm", "auto_print": false,
        "show_qr": true, "show_loyalty_points": true
      },
      "on_complete": "emit:FLOW_END",
      "can_go_back": false
    }
  ],
  "business_rules": {
    "stock": { "track": true, "allow_negative": false },
    "customer": { "required": false },
    "shift": { "required": true, "require_opening_cash": true }
  },
  "offline_strategy": {
    "cache_products": true, "max_cached_products": 500,
    "cache_ttl_hours": 8, "cache_categories": true
  }
}
```

## Fitur Khusus

- **Kitchen Display:** Bisa diaktifkan di settings tenant (`features.kitchen_display: true`)
- **Loyalty Points:** Hitung poin dari total transaksi
- **Multi-round:** Tambah order ke meja yang sama (aktifkan `multi_round_order: true` di props ProductGrid)
- **Shift Management:** Kasir wajib buka shift dengan opening cash

## Komponen yang Dipakai

`product_grid` → `cart_summary` → `payment_method` → `order_confirm` → `print_receipt`

---

# Business Type Detail: Laundry

**Kode:** `laundry` | **Versi:** v1 | **Langkah:** 3 + Extra: Pickup (3)

## Flow Transaksi

```
Antar:                          Ambil:
Step 1: Input Cucian            Step 1: Scan Tiket
        ↓                               ↓
Step 2: Kalkulasi Harga         Step 2: Konfirmasi Pickup
        ↓                               ↓
Step 3: Bayar (DP/Lunas)        Step 3: Struk Lunas
```

## Fitur Khusus

- **DP System:** Bayar DP saat antar, lunasi saat ambil
- **WhatsApp Notification:** Auto-WA saat laundry siap
- **Berat + Jenis:** Harga dihitung dari berat (kg) × harga/kg × jenis layanan
- **Express Surcharge:** +50% untuk layanan express
- **Barcode Tiket:** Generate barcode per order untuk scan saat pickup

---

# Business Type Detail: Dealer Kendaraan

**Kode:** `vehicle_dealer` | **Versi:** v1 | **Langkah:** 7

## Flow Transaksi

```
Step 1: Data Prospek (customer_form_extended)
Step 2: Pilih Unit (product_grid — unit kendaraan)
Step 3: Test Drive (test_drive_form)
Step 4: Negosiasi Harga (negotiation_form)
Step 5: Kelengkapan Dokumen (document_checklist)
Step 6: Uang Muka / Cicilan (payment_method + financing_form)
Step 7: Serah Terima (handover_form → generate BAST PDF)
```

## Fitur Khusus

- **Supervisor Approval:** Diskon > threshold → notif supervisor, menunggu persetujuan
- **BAST PDF:** Berita Acara Serah Terima di-generate otomatis
- **Leasing Integration:** Kalkulator cicilan + koneksi ke leasing partners
- **SLIK OJK:** Checklist verifikasi dokumen (manual)
- **Unit Unik:** Setiap unit adalah 1 produk dengan stock = 1

---

# Business Type Detail: Klinik

**Kode:** `clinic` | **Versi:** v1 | **Langkah:** 6

## Flow Transaksi

```
Step 1: Pendaftaran Pasien (patient_checkin_form)
Step 2: Antrian (queue_display)
Step 3: Konsultasi & SOAP (soap_form)
Step 4: Resep (prescription_form)
Step 5: Kasir (payment_method — termasuk BPJS)
Step 6: Bukti Pembayaran (print_receipt)
```

## Fitur Khusus

- **Rekam Medis:** SOAP tersimpan per pasien
- **ICD-10 Search:** Auto-complete kode diagnosis
- **Drug Interaction:** Warning jika ada interaksi obat
- **BPJS Integration:** Input nomor BPJS dan SEP
- **Privacy:** Data pasien sensitivity HIGH — semua akses ter-audit

---

# Business Type Detail: Retail / Minimarket

**Kode:** `retail_store` | **Versi:** v1 | **Langkah:** 4

## Flow Transaksi

```
Step 1: Scan Barang (barcode_scanner_pos)
Step 2: Review Belanjaan (cart_summary)
Step 3: Bayar (payment_method)
Step 4: Struk (print_receipt)
```

## Fitur Khusus

- **Barcode Scanner:** Auto-add ke cart saat scan
- **5000 Produk Cache:** IndexedDB mampu cache 5000 SKU
- **Membership Card:** Scan kartu member, hitung loyalty points
- **Z-Report:** Generate otomatis saat shift tutup
- **PPN Otomatis:** Tax 11% dihitung server

---

# Business Type Detail: Salon / Barbershop

**Kode:** `salon_barbershop` | **Versi:** v1 | **Langkah:** 4

## Flow Transaksi

```
Step 1: Booking / Walk-in (booking_form)
Step 2: Pilih Layanan + Stylist (product_grid)
Step 3: Bayar + Tips (payment_method)
Step 4: Struk (print_receipt)
```

## Fitur Khusus

- **Booking:** Time slot picker, pilih stylist, walk-in mode
- **Double-book Prevention:** Stylist tidak bisa di-book 2 slot bersamaan
- **Tips Tracking:** Tips masuk ke kas, komisi terpisah
- **Komisi 30%:** Laporan komisi per stylist per shift

---

# Business Type Detail: Hotel / Guest House

**Kode:** `hotel_guesthouse` | **Versi:** v1 | **Langkah:** 4 + Extra: Checkout (4)

## Flow Check-in

```
Step 1: Cek Ketersediaan Kamar (room_availability_grid)
Step 2: Data Tamu (guest_form)
Step 3: Bayar DP / Full (payment_method)
Step 4: Kunci Kamar (room_key_issue)
```

## Flow Check-out

```
Step 1: Bill Summary (bill_summary)
Step 2: Tambahan Charges (charge_input)
Step 3: Pelunasan (payment_method)
Step 4: Struk Final (print_receipt)
```

## Fitur Khusus

- **Occupancy Tracking:** Grid kamar real-time
- **Deposit System:** DP saat check-in, dipotong di check-out
- **Extra Charges:** Room service, laundry, minibar
- **Police Report Fields:** Untuk tamu asing (sesuai regulasi)

---

# Business Type Detail: Restoran

**Kode:** `restaurant` | **Versi:** v1 | **Langkah:** 5

## Flow Transaksi

```
Step 1: Pilih Meja (table_map)
Step 2: Order (product_grid + multi-round)
Step 3: Bill (bill_summary)
Step 4: Bayar (payment_method)
Step 5: Struk (print_receipt)
```

## Fitur Khusus

- **Table Map:** Visual layout meja, status real-time (kosong/terisi/bayar)
- **Multi-Round Order:** Tambah order ke meja yang sama beberapa kali
- **Split Bill:** Bagi tagihan per orang atau per item
- **Service Charge:** 5% otomatis + PPN 11%
- **Kitchen Display:** Order langsung tampil di layar dapur (opsional)
