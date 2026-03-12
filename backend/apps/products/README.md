# App: Products

Mengelola produk, kategori, dan stok per cabang. Mendukung delta sync untuk offline cache.

## Isi

```
apps/products/
├── models.py               ← ProductCategory, Product, Stock, StockAdjustment
├── serializers.py          ← ProductSerializer, StockSerializer (dengan delta sync field)
├── views.py                ← CRUD Products, Stock adjust, delta sync endpoint
├── filters.py              ← DjangoFilter: category, search, updated_after
├── signals.py              ← Auto-update stock cache saat ada perubahan
├── admin.py
└── tests/
    ├── test_product_api.py
    ├── test_stock_api.py
    └── test_delta_sync.py
```

## Models

### Product

```python
class Product(models.Model):
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4)
    category      = models.ForeignKey('ProductCategory', null=True, on_delete=models.SET_NULL)
    sku           = models.CharField(max_length=100, unique=True, null=True, blank=True)
    barcode       = models.CharField(max_length=100, null=True, blank=True, db_index=True)
    name          = models.CharField(max_length=255)
    description   = models.TextField(blank=True)
    base_price    = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tax_rate      = models.DecimalField(max_digits=5, decimal_places=4, default=0)
    unit          = models.CharField(max_length=50, default='pcs')
    has_variants  = models.BooleanField(default=False)
    track_stock   = models.BooleanField(default=True)
    image_url     = models.URLField(null=True, blank=True)
    metadata      = models.JSONField(default=dict)  # Data spesifik bisnis
    is_active     = models.BooleanField(default=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)   # Kritis untuk delta sync

    class Meta:
        ordering = ['name']
        indexes  = [
            models.Index(fields=['updated_at']),   # Delta sync
            models.Index(fields=['barcode']),
            models.Index(fields=['is_active']),
        ]
```

### Stock

```python
class Stock(models.Model):
    id                = models.UUIDField(primary_key=True, default=uuid.uuid4)
    product           = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stocks')
    branch            = models.ForeignKey('tenants.Branch', on_delete=models.CASCADE)
    quantity          = models.DecimalField(max_digits=15, decimal_places=4, default=0)
    reserved_quantity = models.DecimalField(max_digits=15, decimal_places=4, default=0)
    min_quantity      = models.DecimalField(max_digits=15, decimal_places=4, default=0)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('product', 'branch')

    @property
    def available_quantity(self):
        return self.quantity - self.reserved_quantity

    @property
    def is_low(self):
        return self.quantity <= self.min_quantity
```

## Delta Sync

Endpoint `GET /products/?updated_after=<iso_datetime>` hanya return produk yang berubah:

```python
# views.py
class ProductListView(generics.ListAPIView):
    def get_queryset(self):
        qs = Product.objects.filter(is_active=True)
        updated_after = self.request.query_params.get('updated_after')
        if updated_after:
            qs = qs.filter(updated_at__gt=parse_datetime(updated_after))
        return qs
```

**Client pattern:**
```typescript
// Pertama kali: download semua (max 500)
GET /products/?per_page=500

// Subsequent: hanya yang berubah
GET /products/?updated_after=2025-06-01T08:00:00Z
```

## Stok Adjustment

```python
class StockAdjustment(models.Model):
    """Audit trail semua perubahan stok."""
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4)
    stock            = models.ForeignKey(Stock, on_delete=models.CASCADE)
    user             = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True)
    adjustment_type  = models.CharField(
        max_length=50,
        choices=[
            ('add',     'Tambah Stok'),      # Restock dari supplier
            ('subtract','Kurangi Stok'),     # Koreksi, kerusakan
            ('set',     'Set Stok'),         # Stock opname
            ('transfer','Transfer Cabang'),   # Antar cabang
        ]
    )
    quantity_before  = models.DecimalField(max_digits=15, decimal_places=4)
    adjustment       = models.DecimalField(max_digits=15, decimal_places=4)
    quantity_after   = models.DecimalField(max_digits=15, decimal_places=4)
    reason           = models.TextField(blank=True)
    reference_number = models.CharField(max_length=100, blank=True)  # Nomor PO, dll
    created_at       = models.DateTimeField(auto_now_add=True)
```

## API Endpoints

| Method | Path | Permission | Keterangan |
|--------|------|-----------|-----------|
| GET | `/products/` | Kasir+ | List produk, support `updated_after`, `search`, `category_id` |
| GET | `/products/{id}/` | Kasir+ | Detail produk |
| POST | `/products/` | Branch Manager+ | Buat produk baru |
| PUT | `/products/{id}/` | Branch Manager+ | Update produk |
| DELETE | `/products/{id}/` | Tenant Admin+ | Soft delete (is_active=False) |
| GET | `/stock/` | Kasir+ | Stok per cabang, support `low_stock_only` |
| POST | `/stock/adjust/` | Branch Manager+ | Adjust stok + audit trail |

## Cache Strategy

Stok di-cache Redis 5 menit untuk mengurangi DB query di hot path:

```python
def get_stock_cached(product_id: str, branch_id: str) -> Decimal:
    key = f'stock:{branch_id}:{product_id}'
    cached = cache.get(key)
    if cached is not None:
        return Decimal(cached)
    stock = Stock.objects.get(product_id=product_id, branch_id=branch_id)
    cache.set(key, str(stock.available_quantity), timeout=300)
    return stock.available_quantity

def invalidate_stock_cache(product_id: str, branch_id: str):
    cache.delete(f'stock:{branch_id}:{product_id}')
```
