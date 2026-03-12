# Offline Sync Protocol

Protokol lengkap komunikasi antara device offline dan server untuk delta sync.

## Alur Sync

```
[Device]                          [Server]
   │                                  │
   │  POST /sync/delta/               │
   │  {queue: [...], checksum: "..."}─→│
   │                                  ├─ 1. Verifikasi HMAC signature
   │                                  ├─ 2. Iterasi setiap queue item
   │                                  │   ├─ Cek duplikasi via local_id
   │                                  │   ├─ Validasi payload
   │                                  │   ├─ Cek stok (jika transaksi)
   │                                  │   └─ Proses atau flag conflict
   │  ←─ {synced:[], conflicts:[]} ───┤
   │                                  │
   │  (Jika ada conflict)             │
   │  Update badge UI                 │
   │  Notify Branch Manager           │
```

## Signature Validation

```python
import hashlib, hmac, json

def validate_sync_payload(payload: dict, secret_key: str) -> bool:
    received = payload.pop('checksum', '')
    payload_str = json.dumps(payload, sort_keys=True)
    expected = hmac.new(
        secret_key.encode(),
        payload_str.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(received, expected)
```

## Deduplication

```python
def process_transaction(payload: dict) -> dict:
    local_id = payload.get('local_id')
    # Cek apakah sudah pernah diproses
    existing = Transaction.objects.filter(local_id=local_id).first()
    if existing:
        return {'status': 'synced', 'note': 'duplicate_ignored', 'id': str(existing.id)}
    # Proses baru
    tx = Transaction.objects.create(**payload)
    return {'status': 'synced', 'id': str(tx.id)}
```

## Conflict Types

| Conflict Type | Penyebab | Resolusi Default |
|---------------|----------|-----------------|
| `insufficient_stock` | Stok tidak cukup saat sync | Flag untuk Branch Manager |
| `duplicate_transaction` | local_id sudah ada | Diabaikan (idempotent) |
| `product_not_found` | Produk dihapus saat offline | Flag untuk Admin |
| `price_mismatch` | Harga berubah saat offline | Terima harga lama, flag info |
| `branch_mismatch` | Branch tidak match tenant | Reject — security violation |

## Conflict Resolution

```
Resolution Options:
  approve  → Proses transaksi apa adanya (manager override)
  reject   → Batalkan transaksi, kembalikan ke kasir
  adjust   → Proses dengan quantity yang tersedia saja
```

## Checksum Generation (Client)

```typescript
// lib/sync/checksum.ts
async function generateChecksum(payload: object): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(process.env.NEXT_PUBLIC_SYNC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const data = new TextEncoder().encode(JSON.stringify(payload, Object.keys(payload).sort()))
  const signature = await crypto.subtle.sign('HMAC', key, data)
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
```
