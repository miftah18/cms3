# Nginx Configuration

Nginx sebagai reverse proxy di depan Django (backend) dan Next.js (frontend). Cloudflare ada di depan Nginx.

## nginx.conf

```nginx
# infra/nginx/nginx.conf
user  nginx;
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Logging dengan request ID untuk tracing
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" req_id=$request_id';

    access_log /var/log/nginx/access.log main;
    error_log  /var/log/nginx/error.log warn;

    # Performance
    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout 65;
    gzip            on;
    gzip_vary       on;
    gzip_min_length 1024;
    gzip_types      text/plain text/css application/json application/javascript
                    application/x-javascript text/xml application/xml text/javascript;

    # Security
    server_tokens off;  # Jangan expose Nginx version

    include /etc/nginx/conf.d/*.conf;
}
```

## conf.d/upstream.conf

```nginx
# infra/nginx/conf.d/upstream.conf
upstream backend {
    least_conn;
    server backend:8000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

upstream frontend {
    least_conn;
    server frontend:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}
```

## conf.d/saas.conf

```nginx
# infra/nginx/conf.d/saas.conf
# Semua traffic HTTPS — HTTP redirect

server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name *.saas.id saas.id;

    # SSL — dikelola Cloudflare (Origin Certificate)
    ssl_certificate     /etc/nginx/ssl/cloudflare-origin.crt;
    ssl_certificate_key /etc/nginx/ssl/cloudflare-origin.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;

    # Client max upload (dokumen dealer, foto KTP, dll)
    client_max_body_size 20M;

    # ── API Backend ───────────────────────────────────
    location /api/ {
        proxy_pass          http://backend;
        proxy_http_version  1.1;
        proxy_set_header    Host              $host;
        proxy_set_header    X-Real-IP         $remote_addr;
        proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto $scheme;
        proxy_set_header    X-Request-ID      $request_id;
        proxy_connect_timeout 5s;
        proxy_read_timeout   30s;
        proxy_send_timeout   30s;
    }

    # ── Midtrans Webhook (public, no rate limit tambahan) ──
    location /api/v1/payments/webhook/ {
        proxy_pass          http://backend;
        proxy_set_header    Host              $host;
        proxy_set_header    X-Real-IP         $remote_addr;
        proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_read_timeout  10s;
    }

    # ── Static Files Django ───────────────────────────
    location /static/ {
        alias /app/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # ── Media Files ───────────────────────────────────
    location /media/ {
        alias /app/media/;
        expires 7d;
    }

    # ── Frontend Next.js ──────────────────────────────
    location / {
        proxy_pass          http://frontend;
        proxy_http_version  1.1;
        proxy_set_header    Upgrade           $http_upgrade;
        proxy_set_header    Connection        "upgrade";
        proxy_set_header    Host              $host;
        proxy_set_header    X-Real-IP         $remote_addr;
        proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto $scheme;
        proxy_cache_bypass  $http_upgrade;
    }

    # ── Next.js Static Assets (immutable) ────────────
    location /_next/static/ {
        proxy_pass http://frontend;
        expires    365d;
        add_header Cache-Control "public, immutable";
    }

    # ── Health Check ──────────────────────────────────
    location /health/ {
        access_log off;
        proxy_pass http://backend;
    }
}
```

## conf.d/security.conf

```nginx
# infra/nginx/conf.d/security.conf
# Rate limiting — berlapis dengan rate limit Django

# Login brute force protection
limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;
# API rate limit per IP
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
# Sync endpoint
limit_req_zone $binary_remote_addr zone=sync:10m rate=10r/s;

# Apply rate limit ke login endpoint
location /api/v1/auth/login/ {
    limit_req zone=login burst=5 nodelay;
    proxy_pass http://backend;
}

location /api/v1/sync/ {
    limit_req zone=sync burst=20 nodelay;
    proxy_pass http://backend;
}
```
