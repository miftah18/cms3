# Public — Static Assets & Service Worker

## File

```
frontend/public/
├── sw.js                  ← Service Worker (offline caching + background sync)
├── manifest.json          ← PWA manifest (installable app)
├── icons/
│   ├── icon-72x72.png
│   ├── icon-96x96.png
│   ├── icon-128x128.png
│   ├── icon-144x144.png
│   ├── icon-152x152.png
│   ├── icon-192x192.png   ← Dipakai Android home screen
│   ├── icon-384x384.png
│   └── icon-512x512.png   ← Dipakai splash screen
└── offline.html           ← Fallback page jika offline dan tidak ada cache
```

## manifest.json

```json
{
  "name": "SaaS Platform POS",
  "short_name": "SaaSPOS",
  "description": "Platform POS multi-bisnis offline-first",
  "start_url": "/pos",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#1A237E",
  "theme_color": "#1A237E",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "categories": ["business", "productivity"],
  "screenshots": [
    { "src": "/screenshots/pos.png", "sizes": "1080x1920", "type": "image/png", "label": "POS Screen" }
  ]
}
```

## Service Worker Strategy

```javascript
// public/sw.js (dikelola oleh next-pwa, ini adalah custom runtime caching)

const CACHE_VERSION = 'v1'

const CACHES = {
  SHELL:    `shell-${CACHE_VERSION}`,      // App shell — cache forever
  API:      `api-${CACHE_VERSION}`,        // API responses
  ASSETS:   `assets-${CACHE_VERSION}`,     // Images, fonts
}

// Strategi per URL pattern:
//
// Shell (HTML, CSS, JS bundle)  → Cache First
//   - Di-cache saat install
//   - Update hanya saat SW versi baru
//
// /api/v1/flow/schema/          → Stale-While-Revalidate
//   - Return cache dulu (instant)
//   - Update cache dari network di background
//   - TTL: 1 jam
//
// /api/v1/products/             → Network First
//   - Coba network dulu (timeout 3 detik)
//   - Fallback ke cache jika network lambat/offline
//
// /api/v1/stock/                → Network First, timeout 2 detik
//
// Images                        → Cache First
//   - TTL: 7 hari
//   - Max 200 entries
//
// /offline.html                 → Pre-cached, selalu tersedia

// Background Sync (Chrome/Android)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncPendingTransactions())
  }
})

async function syncPendingTransactions() {
  // Baca dari IndexedDB dan kirim ke server
  // Sama seperti SyncManager di main thread, tapi berjalan di background
  const db = await openDB('saas-platform', 1)
  const pending = await db.getAll('sync_queue')
  // ... upload ke /api/v1/sync/delta/
}
```

## PWA Installation

**Android (Chrome):**
1. Buka browser di `https://tenant.saas.id`
2. Tap "Add to Home Screen" banner atau menu ⋮ → "Install App"
3. App terpasang tanpa App Store

**iOS (Safari):**
1. Buka Safari di `https://tenant.saas.id`
2. Tap Share icon → "Add to Home Screen"
3. App terpasang, tapi beberapa Service Worker feature terbatas

**Desktop (Chrome/Edge):**
1. Klik install icon di address bar
2. App berjalan di window terpisah

## Testing Service Worker

```bash
# Build dan serve secara lokal (SW tidak aktif di dev mode)
npm run build
npx serve out/ -p 3000

# Atau gunakan ngrok untuk HTTPS di local
ngrok http 3000
# Buka di Chrome → DevTools → Application → Service Workers
```

## Catatan Penting

- Service Worker hanya aktif di **HTTPS** (atau `localhost`)
- SW tidak diaktifkan di development (`NODE_ENV === 'development'`) — lihat `next.config.ts`
- Setiap update SW butuh user menutup semua tab lama → tab baru akan pakai SW baru
- Background Sync tersedia di Chrome/Android, **tidak tersedia di iOS Safari**
