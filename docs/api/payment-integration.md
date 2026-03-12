# Payment Integration

## Midtrans

### Alur Snap Payment

```
1. Client POST /payments/initiate/ → server create Midtrans transaction
2. Server return snap_token
3. Client buka Snap UI: window.snap.pay(snap_token, callbacks)
4. User bayar di Snap UI
5. Midtrans redirect ke finish_url di app
6. Client GET /payments/{id}/status/ untuk konfirmasi
7. Midtrans kirim webhook ke POST /payments/webhook/midtrans/
```

### Environment Variables

```bash
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx    # Sandbox
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxx
MIDTRANS_IS_PRODUCTION=false

# Production:
MIDTRANS_SERVER_KEY=Mid-server-xxxx
MIDTRANS_CLIENT_KEY=Mid-client-xxxx
MIDTRANS_IS_PRODUCTION=true
```

### Webhook Signature Verification

```python
import hashlib

def verify_midtrans_webhook(notification: dict, server_key: str) -> bool:
    order_id    = notification['order_id']
    status_code = notification['status_code']
    gross_amount= notification['gross_amount']

    signature_input = f"{order_id}{status_code}{gross_amount}{server_key}"
    expected = hashlib.sha512(signature_input.encode()).hexdigest()
    return expected == notification['signature_key']
```

### Status Mapping

| Midtrans Status | Payment Status | Aksi |
|-----------------|----------------|------|
| `settlement` | `paid` | Update transaksi completed |
| `pending` | `pending` | Tunggu, polling 30 detik |
| `deny` | `failed` | Notif user, bisa retry |
| `expire` | `failed` | Notif user, buat transaksi baru |
| `cancel` | `failed` | User cancel, notif kasir |
| `refund` | `refunded` | Update transaksi refunded |

## Per-Tenant Payment Credentials

```python
# Midtrans credentials disimpan di tenant.settings (encrypted)
# Setiap tenant punya server key dan client key sendiri
settings = {
  "payment": {
    "midtrans_server_key": "encrypted:xxxx",
    "midtrans_client_key": "encrypted:xxxx",
    "midtrans_is_production": true
  }
}
```
