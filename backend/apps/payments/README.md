# App: Payments

Integrasi payment gateway — Midtrans (Indonesia) dan Stripe (global). Mendukung cash, transfer, QRIS, kartu debit/kredit, dan BPJS.

## Isi

```
apps/payments/
├── models.py               ← Payment, PaymentGatewayLog
├── serializers.py
├── views.py                ← Initiate, webhook, status check
├── gateways/
│   ├── base.py             ← Abstract PaymentGateway class
│   ├── midtrans.py         ← Midtrans Snap + Core API
│   ├── stripe.py           ← Stripe Payment Intents (global)
│   └── manual.py           ← Cash, transfer manual
├── webhook_handler.py      ← Dispatch webhook ke gateway yang benar
├── signature.py            ← Verifikasi signature Midtrans & Stripe
└── tests/
    ├── test_midtrans.py
    ├── test_webhook.py
    └── test_signature.py
```

## Payment Gateway Architecture

```
PaymentMethod (client)
       │
       ▼
POST /payments/initiate/
       │
       ▼
GatewayFactory.create(tenant, method)
       │
   ┌───┴──────────┬────────────────┐
   ▼              ▼                ▼
MidtransGateway  StripeGateway  ManualGateway
   │              │                │
   ▼              ▼                ▼
Snap Token    PaymentIntent    Langsung paid
   │
   ▼
Client buka Snap UI
   │
   ▼
User bayar → Midtrans callback
   │
   ▼
POST /payments/webhook/midtrans/
   │
   ▼
webhook_handler.py → verify signature → update Payment status
```

## MidtransGateway

```python
# apps/payments/gateways/midtrans.py
import midtransclient

class MidtransGateway:
    def __init__(self, tenant: Tenant):
        server_key = tenant.get_setting('payment.midtrans_server_key')
        is_prod    = tenant.get_setting('payment.midtrans_is_production', False)

        self.snap = midtransclient.Snap(
            is_production=is_prod,
            server_key=server_key,
        )
        self.core = midtransclient.CoreApi(
            is_production=is_prod,
            server_key=server_key,
        )

    def initiate_snap(self, transaction: Transaction) -> dict:
        """Create Snap transaction, return snap_token."""
        param = {
            'transaction_details': {
                'order_id':    f"ORDER-{transaction.id}",
                'gross_amount': int(transaction.total_amount),
            },
            'item_details': [
                {
                    'id':       str(item.product_id),
                    'price':    int(item.unit_price),
                    'quantity': int(item.quantity),
                    'name':     item.product_name[:50],
                }
                for item in transaction.items.all()
            ],
            'customer_details': self._build_customer(transaction),
            'callbacks': {
                'finish': f"{settings.FRONTEND_URL}/payment/finish",
            },
        }
        result = self.snap.create_transaction(param)
        return {
            'snap_token':       result['token'],
            'snap_redirect_url': result['redirect_url'],
        }

    def check_status(self, order_id: str) -> dict:
        return self.core.transactions.status(order_id)
```

## Webhook Handler

```python
# apps/payments/webhook_handler.py

MIDTRANS_STATUS_MAP = {
    'settlement': 'paid',
    'capture':    'paid',
    'pending':    'pending',
    'deny':       'failed',
    'expire':     'failed',
    'cancel':     'failed',
    'refund':     'refunded',
    'chargeback': 'refunded',
}

class MidtransWebhookHandler:
    def __init__(self, tenant: Tenant):
        self.tenant = tenant

    def handle(self, payload: dict) -> bool:
        # 1. Verifikasi signature
        if not self._verify_signature(payload):
            logger.warning(f"Invalid Midtrans signature: {payload.get('order_id')}")
            return False

        # 2. Ambil Payment dari DB
        order_id = payload['order_id']
        payment  = Payment.objects.get(gateway_tx_id=order_id)

        # 3. Map status
        new_status = MIDTRANS_STATUS_MAP.get(payload['transaction_status'], 'pending')

        # 4. Update Payment
        payment.status           = new_status
        payment.gateway_response = payload
        payment.paid_at          = timezone.now() if new_status == 'paid' else None
        payment.save()

        # 5. Jika paid → update Transaction
        if new_status == 'paid':
            payment.transaction.payment_status = 'paid'
            payment.transaction.save()

        # 6. Trigger notifikasi
        notify_payment_status.delay(payment.id, new_status)
        return True

    def _verify_signature(self, payload: dict) -> bool:
        server_key   = self.tenant.get_setting('payment.midtrans_server_key')
        order_id     = payload.get('order_id', '')
        status_code  = payload.get('status_code', '')
        gross_amount = payload.get('gross_amount', '')

        signature_str = f"{order_id}{status_code}{gross_amount}{server_key}"
        expected = hashlib.sha512(signature_str.encode()).hexdigest()
        return hmac.compare_digest(expected, payload.get('signature_key', ''))
```

## Per-Tenant Payment Credentials

Setiap tenant punya credential Midtrans sendiri. Disimpan encrypted di `tenant.settings`:

```python
# Simpan saat onboarding
import cryptography

def save_payment_credentials(tenant: Tenant, server_key: str, client_key: str):
    """Encrypt sebelum simpan ke DB."""
    fernet = Fernet(settings.CREDENTIALS_ENCRYPTION_KEY)
    tenant.settings['payment'] = {
        'midtrans_server_key': fernet.encrypt(server_key.encode()).decode(),
        'midtrans_client_key': fernet.encrypt(client_key.encode()).decode(),
        'midtrans_is_production': False,  # Default sandbox
    }
    tenant.save()

def get_payment_credential(tenant: Tenant, key: str) -> str:
    """Decrypt saat dibutuhkan."""
    fernet = Fernet(settings.CREDENTIALS_ENCRYPTION_KEY)
    encrypted = tenant.get_setting(f'payment.{key}', '')
    return fernet.decrypt(encrypted.encode()).decode()
```

## Payment Methods yang Didukung

| Method | Gateway | Keterangan |
|--------|---------|-----------|
| `cash` | Manual | Hitung kembalian di client |
| `qris` | Midtrans | Generate QR, polling status 30 detik |
| `debit_card` | Midtrans | Snap redirect |
| `credit_card` | Midtrans | Snap redirect |
| `bank_transfer` | Midtrans | VA number per bank |
| `gopay` | Midtrans | Deep-link ke GoPay app |
| `shopeepay` | Midtrans | Deep-link ke ShopeePay |
| `bpjs` | Manual | Input nomor SEP, tracking manual |
| `stripe` | Stripe | Global (USD, EUR, dll) |
| `installment` | Midtrans | Cicilan 3/6/12 bulan |

## API Endpoints

| Method | Path | Keterangan |
|--------|------|-----------|
| POST | `/payments/initiate/` | Inisiasi pembayaran, return snap_token atau langsung paid |
| POST | `/payments/webhook/midtrans/` | Public — Midtrans callback (verified via signature) |
| POST | `/payments/webhook/stripe/` | Public — Stripe webhook |
| GET | `/payments/{id}/status/` | Cek status pembayaran |
