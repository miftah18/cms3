# App: Notifications

Sistem notifikasi multi-channel — in-app, email (SendGrid), WhatsApp (Twilio), dan push notification.

## Isi

```
apps/notifications/
├── models.py               ← Notification, NotificationTemplate
├── serializers.py
├── views.py                ← List, mark read, mark all read
├── channels/
│   ├── inapp.py            ← In-app notifications (simpan ke DB, polling)
│   ├── email.py            ← Email via SendGrid
│   ├── whatsapp.py         ← WhatsApp via Twilio / WA Business API
│   └── push.py             ← Web push via web-push library
├── dispatcher.py           ← Route notif ke channel yang tepat
├── tasks.py                ← Celery async tasks
└── tests/
    └── test_notifications.py
```

## Model

```python
class Notification(models.Model):
    TYPES = [
        ('stock_low',          'Stok Rendah'),
        ('sync_conflict',      'Konflik Sync'),
        ('payment_success',    'Pembayaran Berhasil'),
        ('payment_failed',     'Pembayaran Gagal'),
        ('laundry_ready',      'Laundry Siap Diambil'),
        ('shift_not_closed',   'Shift Belum Ditutup'),
        ('subscription_expiry','Langganan Hampir Habis'),
        ('approval_needed',    'Perlu Persetujuan'),
        ('report_ready',       'Laporan Siap'),
    ]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user        = models.ForeignKey('auth.User', on_delete=models.CASCADE, null=True)
    type        = models.CharField(max_length=100, choices=TYPES)
    title       = models.CharField(max_length=255)
    body        = models.TextField()
    data        = models.JSONField(default=dict)  # Payload extra (misal: link ke transaksi)
    is_read     = models.BooleanField(default=False)
    read_at     = models.DateTimeField(null=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes  = [models.Index(fields=['user', 'is_read'])]
```

## Dispatcher

```python
# apps/notifications/dispatcher.py

class NotificationDispatcher:
    """Route notifikasi ke channel yang tepat berdasarkan tipe dan preferensi user."""

    CHANNEL_MAP = {
        'stock_low':          ['inapp', 'email'],
        'sync_conflict':      ['inapp', 'email'],
        'payment_success':    ['inapp'],
        'laundry_ready':      ['inapp', 'whatsapp'],
        'subscription_expiry':['inapp', 'email'],
        'approval_needed':    ['inapp', 'push'],
        'shift_not_closed':   ['inapp', 'push'],
    }

    @classmethod
    def send(cls, notification_type: str, recipients: list, context: dict):
        """Send notifikasi ke semua channel yang relevan via Celery task."""
        channels = cls.CHANNEL_MAP.get(notification_type, ['inapp'])
        for channel in channels:
            dispatch_notification.delay(
                notification_type=notification_type,
                recipients=[str(r.id) for r in recipients],
                channel=channel,
                context=context,
            )
```

## Celery Tasks

```python
# apps/notifications/tasks.py
from celery import shared_task

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def dispatch_notification(self, notification_type, recipients, channel, context):
    """Kirim notifikasi. Auto-retry 3x jika gagal."""
    try:
        handler = get_channel_handler(channel)
        handler.send(notification_type, recipients, context)
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task
def check_low_stock():
    """Cek stok rendah semua cabang aktif. Dijadwalkan setiap 6 jam."""
    for tenant in Tenant.objects.filter(status='active'):
        with tenant_schema_context(tenant):
            low_stocks = Stock.objects.filter(quantity__lte=F('min_quantity'))
            if low_stocks.exists():
                managers = User.objects.filter(role='branch_manager')
                NotificationDispatcher.send(
                    'stock_low',
                    managers,
                    {'items': list(low_stocks.values('product__name', 'quantity', 'min_quantity'))}
                )


@shared_task
def check_unclosed_shifts():
    """Reminder tutup shift — dijadwalkan jam 23:00 setiap hari."""
    for tenant in Tenant.objects.filter(status='active'):
        with tenant_schema_context(tenant):
            open_shifts = Shift.objects.filter(
                status='open',
                opened_at__date=timezone.now().date()
            )
            for shift in open_shifts:
                NotificationDispatcher.send(
                    'shift_not_closed',
                    [shift.cashier],
                    {'shift_id': str(shift.id), 'opened_at': shift.opened_at.isoformat()}
                )
```

## WhatsApp Channel (Laundry)

```python
# apps/notifications/channels/whatsapp.py
from twilio.rest import Client

class WhatsAppChannel:
    def __init__(self):
        self.client = Client(
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_AUTH_TOKEN
        )

    def send_laundry_ready(self, customer_phone: str, order_number: str):
        """Kirim WA saat laundry selesai."""
        message = (
            f"Halo! Laundry Anda dengan nomor order *{order_number}* sudah selesai "
            f"dan siap diambil. Terima kasih telah menggunakan layanan kami! 🧺"
        )
        self.client.messages.create(
            from_=f"whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}",
            to=f"whatsapp:{customer_phone}",
            body=message,
        )
```

## Celery Beat Schedule (Otomatis)

```python
# config/settings/base.py
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    'check-low-stock':      {'task': 'apps.notifications.tasks.check_low_stock',    'schedule': crontab(hour='*/6')},
    'check-unclosed-shifts':{'task': 'apps.notifications.tasks.check_unclosed_shifts','schedule': crontab(hour=23, minute=0)},
    'subscription-reminder':{'task': 'apps.notifications.tasks.subscription_expiry_reminder','schedule': crontab(hour=9, minute=0)},
    'generate-daily-reports':{'task':'apps.reports.tasks.generate_daily_reports',   'schedule': crontab(hour=1, minute=0)},
}
```
