# Panduan Offline-First Strategy

## Prinsip

Aplikasi harus bisa berjalan **penuh tanpa internet**. Koneksi hanya diperlukan untuk sync, bukan untuk operasi harian.

## Lapisan Cache

```
┌─────────────────────────────────────┐
│          Service Worker              │  Layer 1: Asset cache (shell app)
│    Cache API — shell, icons, fonts   │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│            IndexedDB                 │  Layer 2: Data cache (business data)
│  products, stock, flow_schema, sync  │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│          Zustand Store               │  Layer 3: In-memory state (runtime)
│    cart, flow state, auth tokens     │
└─────────────────────────────────────┘
```

## Service Worker Caching Strategy

```javascript
// public/sw.js
const CACHE_STRATEGIES = {
  // Shell app — cache first, network fallback
  '/': 'cache-first',
  '/_next/static/': 'cache-first',

  // API data — network first, cache fallback
  '/api/v1/products/': 'network-first',
  '/api/v1/stock/': 'network-first',

  // Flow schema — stale-while-revalidate
  '/api/v1/flow/schema/': 'stale-while-revalidate',
}
```

## Delta Sync untuk Products

```typescript
// Hanya download produk yang berubah sejak sync terakhir
async function syncProducts() {
  const lastSync = await db.get('meta', 'products_last_sync')
  const params = lastSync ? `?updated_after=${lastSync}` : '?per_page=500'
  const products = await apiClient.get(`/products/${params}`)

  // Upsert ke IndexedDB
  const tx = db.transaction('products', 'readwrite')
  for (const p of products) await tx.store.put(p)

  await db.put('meta', new Date().toISOString(), 'products_last_sync')
}
```

## Multi-Device Leader Election

```
Cabang punya 3 tablet: A, B, C

Startup sequence:
1. Tablet A nyala — broadcast "siapa master?" via HTTP polling lokal
2. Tidak ada jawaban → Tablet A jadi MASTER
3. Tablet B nyala → broadcast "siapa master?"
4. Tablet A jawab "aku master" → Tablet B jadi REPLICA
5. Tablet A mati → timeout 30 detik tanpa heartbeat
6. Tablet B dan C election → Tablet B (lebih dulu detect) jadi MASTER baru

Stok dikontrol di MASTER:
- Kasir Replica request stok ke Master (HTTP lokal)
- Master reserve stok saat transaksi dimulai
- Release reservation jika transaksi dibatalkan
```

## TTL Cache per Business Type

| Business Type | Products TTL | Customers TTL | Max Products |
|---------------|-------------|---------------|--------------|
| coffee_shop | 8 jam | — | 500 |
| laundry | 24 jam | 24 jam | 200 |
| vehicle_dealer | 24 jam | 24 jam | 200 |
| clinic | 12 jam | 12 jam | 1000 pasien |
| retail_store | 6 jam | — | **5000** |
| salon_barbershop | 12 jam | 12 jam | 300 |
| hotel_guesthouse | 24 jam | 24 jam | 200 kamar |
| restaurant | 8 jam | — | 300 |

## Offline Checklist

Sebelum release, verifikasi:
- [ ] App load dalam 2 detik saat offline (setelah install pertama)
- [ ] Produk muncul tanpa koneksi
- [ ] Transaksi bisa dilakukan tanpa koneksi
- [ ] Pending badge muncul dan hitungan benar
- [ ] Auto-sync dalam 30 detik saat online kembali
- [ ] Conflict ditampilkan ke manager
- [ ] PWA bisa diinstall di Android dan iOS
