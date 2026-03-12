# Webhooks Reference

Endpoint webhook yang menerima event dari payment gateway (Midtrans, Stripe).

## Midtrans Webhook

### Endpoint

```
POST /api/v1/payments/webhook/midtrans/
```

- **Auth:** Public (diverifikasi via signature SHA512, bukan JWT)
- **Rate limit:** Tidak ada (Midtrans bisa kirim berulang)
- **Idempotent:** Webhook yang sama bisa diterima berkali-kali (handle duplikasi)

### Signature Verification

```python
# Midtrans signature = SHA512(order_id + status_code + gross_amount + server_key)
import hashlib

def verify(payload, server_key):
    sig = hashlib.sha512(
        f"{payload['order_id']}{payload['status_code']}{payload['gross_amount']}{server_key}".encode()
    ).hexdigest()
    return sig == payload['signature_key']
```

### Payload Contoh

```json
{
  "transaction_time":   "2025-06-01 08:15:00",
  "transaction_status": "settlement",
  "transaction_id":     "midtrans-internal-id",
  "status_message":     "midtrans payment notification",
  "status_code":        "200",
  "signature_key":      "sha512-hash",
  "payment_type":       "gopay",
  "order_id":           "ORDER-{transaction_uuid}",
  "merchant_id":        "G123456",
  "gross_amount":       "45000.00",
  "fraud_status":       "accept",
  "currency":           "IDR"
}
```

### Status Mapping

| `transaction_status` | `payment_status` | Aksi |
|---------------------|-----------------|------|
| `settlement` | `paid` | Update transaksi completed |
| `capture` | `paid` | Sama dengan settlement |
| `pending` | `pending` | Tidak ada aksi |
| `deny` | `failed` | Notif kasir |
| `expire` | `failed` | Notif kasir |
| `cancel` | `failed` | Notif kasir |
| `refund` | `refunded` | Update refund |

### Response

```
200 OK  → "OK" (Midtrans tidak butuh response body spesifik)
400     → Signature invalid (log dan ignore)
```

---

## Stripe Webhook

### Endpoint

```
POST /api/v1/payments/webhook/stripe/
```

### Signature Verification

```python
import stripe

def verify_stripe_webhook(payload: bytes, sig_header: str) -> stripe.Event:
    endpoint_secret = settings.STRIPE_WEBHOOK_SECRET
    return stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
```

### Events yang Ditangani

| Event | Aksi |
|-------|------|
| `payment_intent.succeeded` | Update payment `paid` |
| `payment_intent.payment_failed` | Update payment `failed` |
| `invoice.payment_succeeded` | Update subscription `active` |
| `customer.subscription.deleted` | Update tenant status `cancelled` |

---

## Retry Logic

Jika webhook gagal (non-2xx response), Midtrans akan retry:
- Retry 1: 1 menit kemudian
- Retry 2: 5 menit kemudian
- Retry 3: 30 menit kemudian
- Retry 4: 2 jam kemudian
- Retry 5: 12 jam kemudian

Handler harus **idempotent** — proses yang sama bisa dipanggil berkali-kali tanpa side effect:

```python
def handle_settlement(order_id, payload):
    payment = Payment.objects.get(gateway_tx_id=order_id)
    if payment.status == 'paid':
        return  # Sudah diproses — skip
    payment.status = 'paid'
    payment.save()
    # ...
```

---

## Monitoring Webhook

Semua webhook di-log ke `PaymentGatewayLog`:

```python
class PaymentGatewayLog(models.Model):
    gateway    = models.CharField(max_length=50)
    event_type = models.CharField(max_length=100)
    order_id   = models.CharField(max_length=255)
    payload    = models.JSONField()
    status     = models.CharField(max_length=50)  # received|processed|failed|duplicate
    error      = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

Log bisa dicek di Django Admin untuk debugging.
