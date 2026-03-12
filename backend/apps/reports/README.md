# App: Reports

Laporan, analytics, dan export data. Semua report di-generate via Celery untuk menghindari timeout.

## Isi

```
apps/reports/
├── models.py               ← CachedReport (laporan yang sudah di-generate)
├── serializers.py
├── views.py                ← GET daily, summary, shift report; trigger export
├── generators/
│   ├── daily_report.py     ← Laporan harian per cabang
│   ├── shift_report.py     ← Z-Report per shift
│   ├── tenant_summary.py   ← Konsolidasi semua cabang
│   └── product_report.py   ← Top produk, slow movers
├── exporters/
│   ├── pdf_exporter.py     ← Render ke PDF via WeasyPrint/ReportLab
│   └── excel_exporter.py   ← Export ke Excel via openpyxl
├── tasks.py                ← Celery tasks untuk async generation
└── tests/
    └── test_reports.py
```

## Report Types

### Daily Report (per Cabang)

```python
# apps/reports/generators/daily_report.py

def generate_daily_report(branch_id: str, date: date) -> dict:
    """
    Generate laporan harian lengkap untuk 1 cabang.
    Return dict yang bisa langsung di-serialize ke JSON atau render ke PDF.
    """
    txs = Transaction.objects.filter(
        branch_id=branch_id,
        created_at__date=date,
        status='completed'
    ).prefetch_related('items', 'payments')

    # Summary
    summary = txs.aggregate(
        total_transactions=Count('id'),
        total_revenue=Sum('total_amount'),
        total_items_sold=Sum('items__quantity'),
        average_transaction=Avg('total_amount'),
    )

    # Breakdown per payment method
    payment_breakdown = (
        Payment.objects.filter(transaction__in=txs)
        .values('method')
        .annotate(total=Sum('amount'), count=Count('id'))
        .order_by('-total')
    )

    # Top products
    top_products = (
        TransactionItem.objects.filter(transaction__in=txs)
        .values('product_name')
        .annotate(
            total_qty=Sum('quantity'),
            total_revenue=Sum('subtotal')
        )
        .order_by('-total_revenue')[:10]
    )

    # Hourly sales (untuk chart)
    hourly = (
        txs.annotate(hour=TruncHour('created_at'))
        .values('hour')
        .annotate(total=Sum('total_amount'), count=Count('id'))
        .order_by('hour')
    )

    return {
        'date':              date.isoformat(),
        'branch_id':         branch_id,
        'summary':           summary,
        'payment_breakdown': list(payment_breakdown),
        'top_products':      list(top_products),
        'hourly_sales':      list(hourly),
        'generated_at':      timezone.now().isoformat(),
    }
```

### Z-Report (Shift)

```python
def generate_shift_report(shift_id: str) -> dict:
    """Generate Z-Report saat shift ditutup."""
    shift = Shift.objects.get(id=shift_id)
    txs   = Transaction.objects.filter(shift=shift, status='completed')

    payment_totals = (
        Payment.objects.filter(transaction__in=txs)
        .values('method')
        .annotate(total=Sum('amount'))
    )

    total_cash_sales = (
        Payment.objects.filter(transaction__in=txs, method='cash')
        .aggregate(total=Sum('amount'))['total'] or 0
    )

    return {
        'shift_id':       str(shift.id),
        'cashier':        shift.cashier.full_name,
        'opened_at':      shift.opened_at.isoformat(),
        'closed_at':      shift.closed_at.isoformat() if shift.closed_at else None,
        'opening_cash':   float(shift.opening_cash),
        'total_cash_in':  float(total_cash_sales),
        'expected_cash':  float(shift.opening_cash + Decimal(str(total_cash_sales))),
        'closing_cash':   float(shift.closing_cash) if shift.closing_cash else None,
        'cash_difference':float(shift.closing_cash - (shift.opening_cash + Decimal(str(total_cash_sales)))) if shift.closing_cash else None,
        'total_transactions': txs.count(),
        'total_revenue':  float(txs.aggregate(t=Sum('total_amount'))['t'] or 0),
        'payment_breakdown': list(payment_totals),
    }
```

## Async Export (Celery)

```python
# apps/reports/tasks.py
from celery import shared_task

@shared_task(bind=True)
def export_report_pdf(self, report_type: str, params: dict, user_id: str):
    """
    Generate PDF export secara async.
    Kirim link download ke user via notifikasi saat selesai.
    """
    try:
        data = generate_report(report_type, params)
        pdf  = PDFExporter().export(data, template=report_type)

        # Simpan file
        filename = f"report_{report_type}_{params.get('date', 'all')}.pdf"
        path     = f"reports/{params['tenant_id']}/{filename}"
        save_to_storage(path, pdf)

        # Notif user
        Notification.objects.create(
            user_id=user_id,
            type='report_ready',
            title='Laporan Siap Diunduh',
            body=f'Laporan {report_type} sudah selesai di-generate.',
            data={'download_url': get_signed_url(path, expires=3600)}
        )
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60, max_retries=3)
```

## API Endpoints

| Method | Path | Permission | Keterangan |
|--------|------|-----------|-----------|
| GET | `/reports/branch/{branch_id}/daily/` | Branch Manager+ | Laporan harian, query: `date` |
| GET | `/reports/branch/{branch_id}/daily/?format=pdf` | Branch Manager+ | Download PDF langsung (< 1000 tx) atau async |
| GET | `/reports/branch/{branch_id}/daily/?format=excel` | Branch Manager+ | Download Excel |
| GET | `/reports/tenant/summary/` | Tenant Admin+ | Konsolidasi semua cabang |
| GET | `/reports/shift/{shift_id}/` | Kasir+ (shift sendiri), Manager+ (semua) | Z-Report shift |
| GET | `/reports/products/top/` | Branch Manager+ | Top produk, query: `date_from`, `date_to` |

## Cache Strategy

Laporan harian di-cache Redis dengan TTL 10 menit:

```python
def get_daily_report_cached(branch_id, date):
    key = f'report:daily:{branch_id}:{date.isoformat()}'
    cached = cache.get(key)
    if cached:
        return cached
    data = generate_daily_report(branch_id, date)
    # Cache lebih lama untuk tanggal lampau
    ttl = 600 if date == timezone.now().date() else 86400
    cache.set(key, data, timeout=ttl)
    return data
```
