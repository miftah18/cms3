# Cara Menambah Business Type Baru

Panduan step-by-step menambah jenis bisnis baru ke platform tanpa kode baru.

## Langkah 1: Buat JSON Schema

```bash
touch backend/apps/tenants/fixtures/business_types/apotek_v1.json
```

```json
{
  "business_type": "apotek",
  "version": "v1",
  "display_name": "Apotek",
  "icon": "local_pharmacy",
  "transaction_flow": [
    {
      "step": 1,
      "key": "scan_prescription",
      "label": "Scan Resep",
      "component": "barcode_scanner",
      "props": { "lookup_entity": "prescription" },
      "on_complete": "emit:PRESCRIPTION_SCANNED",
      "can_go_back": false
    },
    {
      "step": 2,
      "key": "dispense_drugs",
      "label": "Siapkan Obat",
      "component": "prescription_form",
      "props": { "drug_search": true, "check_stock": true },
      "on_complete": "emit:DRUGS_DISPENSED",
      "can_go_back": true
    },
    {
      "step": 3,
      "key": "payment",
      "label": "Pembayaran",
      "component": "payment_method",
      "props": { "allowed": ["cash", "bpjs", "midtrans"] },
      "on_complete": "emit:PAYMENT_PROCESSED",
      "can_go_back": true
    },
    {
      "step": 4,
      "key": "receipt",
      "label": "Struk",
      "component": "print_receipt",
      "props": { "include_prescription": true },
      "on_complete": "emit:FLOW_END",
      "can_go_back": false
    }
  ],
  "business_rules": {
    "stock": { "track": true, "drug_only": true, "expiry_tracking": true },
    "customer": { "required": false }
  },
  "offline_strategy": {
    "cache_products": true,
    "max_cached_products": 2000,
    "cache_ttl_hours": 12
  }
}
```

## Langkah 2: Identifikasi Komponen yang Dibutuhkan

Cek apakah semua `component` di flow schema sudah ada di ComponentRegistry:

```bash
# Komponen yang dipakai: barcode_scanner, prescription_form, payment_method, print_receipt
# Semua sudah ada! Tidak perlu komponen baru.
```

Jika ada komponen baru yang dibutuhkan, lihat [cara membuat komponen baru](#cara-membuat-komponen-baru).

## Langkah 3: Seed ke Database

```bash
python manage.py seed_business_types --type apotek
# Output: Created: Apotek
```

## Langkah 4: Test

```bash
# Validasi schema
python manage.py validate_flow_schemas --type apotek

# Test via API
curl -H "Authorization: Bearer {token}" \
     https://apotek.saas.local/api/v1/flow/schema/
```

## Langkah 5: Assign ke Tenant

```python
# Di Django admin atau via API:
tenant.business_type = BusinessType.objects.get(code='apotek')
tenant.save()
```

## Cara Membuat Komponen Baru

Jika flow membutuhkan komponen yang belum ada:

```bash
mkdir frontend/components/registry/inputs/ApotekForm
touch frontend/components/registry/inputs/ApotekForm/index.tsx
touch frontend/components/registry/inputs/ApotekForm/types.ts
touch frontend/components/registry/inputs/ApotekForm/ApotekForm.test.tsx
```

```typescript
// index.tsx
import { BaseComponentProps } from '../../types'

interface ApotekFormProps extends BaseComponentProps {
  drug_search?: boolean
  check_stock?: boolean
}

export default function ApotekForm({ drug_search, onComplete }: ApotekFormProps) {
  // Implementasi komponen
  return <div data-testid="apotek-form">...</div>
}
```

```typescript
// Daftarkan di registry
// frontend/components/registry/index.ts
import ApotekForm from './inputs/ApotekForm'

export const ComponentRegistry = {
  // ... komponen existing
  'apotek_form': ApotekForm,
}
```
