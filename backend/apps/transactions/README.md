# App: Transactions

Mengelola transaksi, items, shift kasir, dan refund. Server selalu re-kalkulasi semua total — tidak pernah percaya data dari client.

## Isi

```
apps/transactions/
├── models.py               ← Transaction, TransactionItem, Payment, Shift
├── serializers.py
├── views.py                ← Create, list, detail, refund
├── validators.py           ← Sanitize & re-kalkulasi dari server
├── number_generator.py     ← Generate nomor transaksi unik 'TRX-YYYYMMDD-NNNN'
├── stock_handler.py        ← Kurangi stok atomik saat transaksi berhasil
├── receipt_builder.py      ← Build receipt data dari transaksi
├── signals.py              ← Post-save: update laporan, kirim notif
└── tests/
    ├── test_transaction_create.py
    ├── test_server_recalculation.py   ← Kritis: pastikan total selalu dihitung server
    ├── test_stock_deduction.py
    └── test_refund.py
```

## Alur Create Transaction

```
POST /transactions/
        │
        ▼
1. Deserialize & validate input (DRF)
        │
        ▼
2. sanitize_transaction_data()
   ├─ Hapus total_amount dari client
   ├─ Ambil harga terkini dari DB (snapshot)
   └─ Hitung ulang: subtotal, tax, discount, total
        │
        ▼
3. check_stock_availability()
   ├─ Lock stok dengan SELECT FOR UPDATE
   └─ Raise StockInsufficientError jika kurang
        │
        ▼
4. Transaction.objects.create(...)
   └─ generate transaction_number
        │
        ▼
5. deduct_stock() — atomic
        │
        ▼
6. Payment.objects.create(...)
        │
        ▼
7. Return TransactionSerializer(tx).data
```

## Server-Side Recalculation (KRITIS)

```python
# apps/transactions/validators.py
from decimal import Decimal, ROUND_HALF_UP

def sanitize_and_recalculate(data: dict) -> dict:
    """
    Server TIDAK PERNAH percaya total dari client.
    Hitung ulang dari harga produk di DB.
    """
    items = data.get('items', [])
    if not items:
        raise ValidationError('Minimal 1 item')

    # Ambil harga dari DB — bukan dari payload client
    product_ids = [item['product_id'] for item in items]
    products_db = {
        str(p.id): p
        for p in Product.objects.filter(id__in=product_ids, is_active=True)
    }

    validated_items = []
    subtotal = Decimal('0')

    for item in items:
        product = products_db.get(item['product_id'])
        if not product:
            raise ValidationError(f"Produk tidak ditemukan: {item['product_id']}")

        # Harga dari DB, bukan dari client
        unit_price = product.base_price
        quantity   = Decimal(str(item['quantity']))
        item_total = (unit_price * quantity).quantize(Decimal('0.01'), ROUND_HALF_UP)

        validated_items.append({
            'product_id':   str(product.id),
            'product_name': product.name,
            'quantity':     quantity,
            'unit_price':   unit_price,
            'subtotal':     item_total,
            'notes':        item.get('notes', ''),
        })
        subtotal += item_total

    # Kalkulasi tax dan discount
    tax_rate = Decimal(str(data.get('tax_rate', '0')))
    tax_amount = (subtotal * tax_rate).quantize(Decimal('0.01'), ROUND_HALF_UP)

    discount = Decimal(str(data.get('discount_amount', '0')))
    # Discount tidak boleh melebihi subtotal
    discount = min(discount, subtotal)

    total = subtotal + tax_amount - discount

    # Overwrite data dari client
    data['items']           = validated_items
    data['subtotal']        = float(subtotal)
    data['tax_amount']      = float(tax_amount)
    data['discount_amount'] = float(discount)
    data['total_amount']    = float(total)

    # Hapus field yang tidak boleh datang dari client
    for key in ['id', 'transaction_number', 'cashier_id', 'synced_at']:
        data.pop(key, None)

    return data
```

## Atomic Stock Deduction

```python
# apps/transactions/stock_handler.py
from django.db import transaction as db_tx
from django.db.models import F

def deduct_stock(items: list, branch_id: str):
    """
    Kurangi stok secara atomik. Gunakan SELECT FOR UPDATE untuk cegah race condition.
    Dipanggil di dalam database transaction.
    """
    with db_tx.atomic():
        for item in items:
            # Lock row sebelum update
            stock = (
                Stock.objects
                .select_for_update()
                .get(product_id=item['product_id'], branch_id=branch_id)
            )
            if stock.available_quantity < item['quantity']:
                raise StockInsufficientError(
                    product_id=item['product_id'],
                    requested=item['quantity'],
                    available=stock.available_quantity
                )
            # Update dengan F() untuk menghindari race condition
            Stock.objects.filter(
                product_id=item['product_id'],
                branch_id=branch_id
            ).update(quantity=F('quantity') - item['quantity'])

            # Invalidate cache
            invalidate_stock_cache(item['product_id'], branch_id)
```

## Transaction Number Generator

```python
# apps/transactions/number_generator.py
import threading

_lock = threading.Lock()

def generate_transaction_number(branch_code: str, date=None) -> str:
    """
    Format: TRX-{BRANCH}-{YYYYMMDD}-{NNNN}
    Contoh: TRX-JKT01-20250601-0042
    Thread-safe menggunakan DB sequence.
    """
    if date is None:
        date = timezone.now().date()

    prefix = f"TRX-{branch_code}-{date.strftime('%Y%m%d')}"

    with _lock:
        last = (
            Transaction.objects
            .filter(transaction_number__startswith=prefix)
            .order_by('-transaction_number')
            .values_list('transaction_number', flat=True)
            .first()
        )
        if last:
            seq = int(last.split('-')[-1]) + 1
        else:
            seq = 1
        return f"{prefix}-{seq:04d}"
```

## Shift Management

```python
class Shift(models.Model):
    """Kasir wajib buka shift sebelum bisa transaksi."""
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4)
    branch       = models.ForeignKey('tenants.Branch', on_delete=models.CASCADE)
    cashier      = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    opening_cash = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    closing_cash = models.DecimalField(max_digits=15, decimal_places=2, null=True)
    status       = models.CharField(
        max_length=20,
        choices=[('open', 'Open'), ('closed', 'Closed')],
        default='open'
    )
    opened_at    = models.DateTimeField(auto_now_add=True)
    closed_at    = models.DateTimeField(null=True)
    notes        = models.TextField(blank=True)

    class Meta:
        # Hanya boleh 1 shift open per kasir per cabang
        constraints = [
            models.UniqueConstraint(
                fields=['cashier', 'branch'],
                condition=models.Q(status='open'),
                name='unique_open_shift_per_cashier'
            )
        ]
```

## API Endpoints

| Method | Path | Permission | Keterangan |
|--------|------|-----------|-----------|
| POST | `/transactions/` | Kasir+ | Buat transaksi, server re-kalkulasi total |
| GET | `/transactions/` | Kasir+ | List transaksi, filter: branch, date, status |
| GET | `/transactions/{id}/` | Kasir+ | Detail transaksi + items + payment |
| POST | `/transactions/{id}/refund/` | Supervisor+ | Refund + restore stok |
| POST | `/shifts/open/` | Kasir+ | Buka shift — wajib sebelum transaksi |
| POST | `/shifts/{id}/close/` | Kasir+ | Tutup shift + generate Z-Report |
| GET | `/shifts/{id}/` | Kasir+ | Detail shift + summary transaksi |
