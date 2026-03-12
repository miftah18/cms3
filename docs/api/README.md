# API Contract

REST API v1 untuk platform. Semua request memerlukan JWT Bearer token kecuali disebutkan lain.

## Base URL

```
Production:  https://{tenant-domain}/api/v1/
Development: http://localhost:8000/api/v1/
```

## Standard Headers

```
Authorization: Bearer {access_token}
X-Device-ID:   {device_uuid}        # Wajib dari POS device
X-Branch-ID:   {branch_uuid}        # Wajib dari kasir
Content-Type:  application/json
```

## Response Envelope

```json
// Success
{ "success": true, "data": {...}, "meta": {"page":1,"total":50}, "timestamp": "..." }

// Error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {} } }
```

## HTTP Status Codes

| Code | Penggunaan |
|------|------------|
| 200 | GET, PUT, PATCH berhasil |
| 201 | POST berhasil — resource dibuat |
| 204 | DELETE berhasil |
| 400 | Input tidak valid |
| 401 | Token tidak ada / expired |
| 403 | Permission tidak cukup |
| 404 | Resource tidak ditemukan |
| 409 | Duplikasi / conflict state |
| 422 | Business logic error (stok kurang, dll) |
| 429 | Rate limit terlampaui |
| 500 | Server error |

## Error Codes

| Code | Keterangan |
|------|------------|
| `AUTH_TOKEN_EXPIRED` | Access token expired — refresh |
| `AUTH_TOKEN_INVALID` | Token tidak valid / blacklisted |
| `AUTH_PERMISSION_DENIED` | Role tidak punya akses |
| `TENANT_INACTIVE` | Tenant suspended / expired |
| `VALIDATION_ERROR` | Input gagal validasi |
| `RESOURCE_NOT_FOUND` | Data tidak ditemukan |
| `STOCK_INSUFFICIENT` | Stok tidak cukup |
| `DUPLICATE_TRANSACTION` | local_id sudah pernah diproses |
| `SYNC_SIGNATURE_INVALID` | Signature payload tidak cocok |
| `RATE_LIMIT_EXCEEDED` | Terlalu banyak request |
| `PAYMENT_FAILED` | Pembayaran gagal di gateway |
| `OFFLINE_TOKEN_EXPIRED` | Offline token expired |

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Login | 10 request/menit per IP |
| API umum | 1000 request/menit per tenant |
| Sync | 100 request/menit per device |
| Report export | 10 request/menit per user |

## Referensi Lengkap

- [Semua Endpoint](endpoints.md)
- [Auth Flow](auth-flow.md)
- [Payment Integration](payment-integration.md)
- [Offline Sync Protocol](sync-protocol.md)
- [Webhook Reference](webhooks.md)
