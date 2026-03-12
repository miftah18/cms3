# Config — Django Settings & Routing

Konfigurasi Django menggunakan split settings pattern — `base.py` berisi semua settings umum, `development.py` dan `production.py` meng-override hanya yang perlu diubah.

## Struktur

```
config/
├── settings/
│   ├── __init__.py            ← Pilih settings berdasarkan ENV variable
│   ├── base.py                ← Settings untuk semua environment
│   ├── development.py         ← Override: DEBUG, local DB, CORS
│   └── production.py          ← Override: gunicorn, Sentry, SSL, Redis cache
├── urls.py                    ← Root URL routing semua apps
├── wsgi.py                    ← WSGI entry point (gunicorn)
└── asgi.py                    ← ASGI entry point (daphne, opsional)
```

## settings/\_\_init\_\_.py

```python
import os
env = os.environ.get('DJANGO_ENV', 'development')
if env == 'production':
    from .production import *
else:
    from .development import *
```

## base.py — Settings Utama

```python
# config/settings/base.py
import environ
env = environ.Env()
environ.Env.read_env()

SECRET_KEY  = env('SECRET_KEY')
DEBUG       = False
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS')

# ── Apps ──────────────────────────────────────────
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'django_ratelimit',
    'corsheaders',
    'django_celery_beat',
    'drf_spectacular',
]

LOCAL_APPS = [
    'apps.core',
    'apps.tenants',
    'apps.flow_engine',
    'apps.products',
    'apps.transactions',
    'apps.sync',
    'apps.payments',
    'apps.notifications',
    'apps.reports',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ── Middleware (urutan kritis!) ────────────────────
MIDDLEWARE = [
    'apps.core.middleware.tenant_resolver.TenantResolverMiddleware',   # Pertama
    'apps.core.middleware.schema_router.SchemaRouterMiddleware',       # Kedua
    'django.middleware.security.SecurityMiddleware',
    'apps.core.middleware.security_headers.SecurityHeadersMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'apps.core.middleware.rate_limit.RateLimitMiddleware',
]

# ── Database ──────────────────────────────────────
DATABASES = {
    'default': env.db('DATABASE_URL')
}
DATABASES['default']['OPTIONS'] = {
    'options': '-c default_transaction_isolation=read committed'
}

# ── Redis & Cache ─────────────────────────────────
REDIS_URL = env('REDIS_URL', default='redis://localhost:6379/0')
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'SOCKET_CONNECT_TIMEOUT': 5,
            'SOCKET_TIMEOUT': 5,
        },
        'TIMEOUT': 300,
    }
}

# ── Celery ────────────────────────────────────────
CELERY_BROKER_URL           = REDIS_URL
CELERY_RESULT_BACKEND       = REDIS_URL
CELERY_ACCEPT_CONTENT       = ['json']
CELERY_TASK_SERIALIZER      = 'json'
CELERY_RESULT_SERIALIZER    = 'json'
CELERY_TIMEZONE             = 'Asia/Jakarta'
CELERY_BEAT_SCHEDULER       = 'django_celery_beat.schedulers:DatabaseScheduler'

# ── JWT ───────────────────────────────────────────
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':      timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME':     timedelta(days=7),
    'ROTATE_REFRESH_TOKENS':      True,
    'BLACKLIST_AFTER_ROTATION':   True,
    'ALGORITHM':                  'RS256',
    'SIGNING_KEY':                env('JWT_PRIVATE_KEY').replace('\\n', '\n'),
    'VERIFYING_KEY':              env('JWT_PUBLIC_KEY').replace('\\n', '\n'),
    'AUTH_HEADER_TYPES':          ('Bearer',),
}

OFFLINE_JWT = {
    'LIFETIME':       timedelta(hours=12),
    'SCOPES':         ['pos:read', 'pos:write', 'stock:read', 'products:read'],
    'REFRESH_ON_SYNC': True,
}

# ── DRF ───────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'EXCEPTION_HANDLER': 'apps.core.exceptions.custom_exception_handler',
}

# ── Spectacular (OpenAPI) ─────────────────────────
SPECTACULAR_SETTINGS = {
    'TITLE': 'SaaS Platform API',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# ── Sentry ────────────────────────────────────────
import sentry_sdk
SENTRY_DSN = env('SENTRY_DSN', default='')
if SENTRY_DSN:
    sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=0.1)

# ── Email (SendGrid) ──────────────────────────────
EMAIL_BACKEND    = 'sendgrid_backend.SendgridBackend'
SENDGRID_API_KEY = env('SENDGRID_API_KEY', default='')
DEFAULT_FROM_EMAIL = 'noreply@saas.id'

# ── Static & Media ────────────────────────────────
STATIC_URL   = '/static/'
STATIC_ROOT  = BASE_DIR / 'staticfiles'
MEDIA_URL    = '/media/'
MEDIA_ROOT   = BASE_DIR / 'media'

# ── Tenant-specific ───────────────────────────────
TENANT_CACHE_TTL_SECONDS = 300      # 5 menit untuk tenant lookup
SYNC_SECRET_KEY = env('SYNC_SECRET_KEY')
```

## development.py

```python
# config/settings/development.py
from .base import *

DEBUG        = True
ALLOWED_HOSTS = ['*']

# CORS — izinkan semua origin di development
CORS_ALLOW_ALL_ORIGINS = True

# Logging verbose di dev
LOGGING = {
    'version': 1,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'loggers': {
        'django': {'handlers': ['console'], 'level': 'INFO'},
        'apps':   {'handlers': ['console'], 'level': 'DEBUG'},
    },
}

# Django Debug Toolbar
INSTALLED_APPS += ['debug_toolbar']
MIDDLEWARE    += ['debug_toolbar.middleware.DebugToolbarMiddleware']
INTERNAL_IPS   = ['127.0.0.1']
```

## production.py

```python
# config/settings/production.py
from .base import *

DEBUG = False

# Security
SECURE_SSL_REDIRECT             = True
SECURE_HSTS_SECONDS             = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS  = True
SECURE_HSTS_PRELOAD             = True
SESSION_COOKIE_SECURE           = True
CSRF_COOKIE_SECURE              = True

# CORS — hanya dari domain tertentu
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^https://.*\.saas\.id$',    # Semua subdomain saas.id
]

# Cache — lebih agresif di prod
CACHES['default']['TIMEOUT'] = 3600

# Logging ke file dan Sentry
LOGGING = {
    'version': 1,
    'handlers': {
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/saas/django.log',
            'maxBytes': 1024 * 1024 * 100,  # 100 MB
            'backupCount': 5,
        },
    },
    'loggers': {
        'django':   {'handlers': ['file'], 'level': 'WARNING'},
        'apps':     {'handlers': ['file'], 'level': 'WARNING'},
    },
}
```

## urls.py

```python
# config/urls.py
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/',       admin.site.urls),
    path('api/docs/',    SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/',  SpectacularAPIView.as_view(), name='schema'),
    path('api/v1/',      include([
        path('auth/',          include('apps.core.urls.auth')),
        path('flow/',          include('apps.flow_engine.urls')),
        path('products/',      include('apps.products.urls')),
        path('stock/',         include('apps.products.urls.stock')),
        path('transactions/',  include('apps.transactions.urls')),
        path('shifts/',        include('apps.transactions.urls.shifts')),
        path('sync/',          include('apps.sync.urls')),
        path('payments/',      include('apps.payments.urls')),
        path('notifications/', include('apps.notifications.urls')),
        path('reports/',       include('apps.reports.urls')),
    ])),
]
```

## Environment Variables (.env.example)

```bash
# Django
DJANGO_ENV=development
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=localhost,127.0.0.1,.saas.id

# Database
DATABASE_URL=postgresql://saas_user:saas_pass@localhost:5432/saas_db

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT (RS256)
# Generate: openssl genrsa -out private.pem 2048 && openssl rsa -in private.pem -pubout -out public.pem
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEow..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIj..."

# Sync HMAC
SYNC_SECRET_KEY=your-sync-secret-32-chars-minimum

# Midtrans
MIDTRANS_SERVER_KEY=Mid-server-xxxx
MIDTRANS_CLIENT_KEY=Mid-client-xxxx
MIDTRANS_IS_PRODUCTION=false

# Email
SENDGRID_API_KEY=SG.xxxxx

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
```
