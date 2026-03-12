# Security — Client Side

Validasi dan sanitasi di sisi client untuk mencegah injection melalui schema JSON yang datang dari server.

## File

```
lib/security/
├── schemaValidator.ts     ← Validasi flow schema sebelum dirender
├── componentWhitelist.ts  ← Daftar komponen yang diizinkan
├── propsSanitizer.ts      ← Sanitasi props sebelum diteruskan ke komponen
└── cspNonce.ts            ← CSP nonce untuk inline scripts
```

## schemaValidator.ts

```typescript
// lib/security/schemaValidator.ts
import { FlowSchema, FlowStep } from '@/lib/api/types'
import { ALLOWED_COMPONENTS } from './componentWhitelist'

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(`[Schema Validation] ${message}`)
    this.name = 'SchemaValidationError'
  }
}

export function validateFlowSchema(schema: unknown): FlowSchema {
  if (!schema || typeof schema !== 'object') {
    throw new SchemaValidationError('Schema bukan object')
  }

  const s = schema as any

  // Validasi field wajib
  if (typeof s.business_type !== 'string') {
    throw new SchemaValidationError('business_type harus string')
  }
  if (!Array.isArray(s.transaction_flow)) {
    throw new SchemaValidationError('transaction_flow harus array')
  }
  if (s.transaction_flow.length === 0) {
    throw new SchemaValidationError('transaction_flow tidak boleh kosong')
  }

  // Validasi setiap step
  s.transaction_flow.forEach((step: any, i: number) => {
    validateStep(step, i)
  })

  return s as FlowSchema
}

function validateStep(step: unknown, index: number): FlowStep {
  const s = step as any
  const prefix = `step[${index}]`

  if (typeof s.step !== 'number')     throw new SchemaValidationError(`${prefix}.step harus number`)
  if (typeof s.key !== 'string')      throw new SchemaValidationError(`${prefix}.key harus string`)
  if (typeof s.component !== 'string')throw new SchemaValidationError(`${prefix}.component harus string`)

  // KRITIS: Whitelist component codes
  if (!ALLOWED_COMPONENTS.includes(s.component)) {
    throw new SchemaValidationError(
      `${prefix}.component '${s.component}' tidak ada di whitelist. ` +
      `Daftar yang diizinkan: ${ALLOWED_COMPONENTS.join(', ')}`
    )
  }

  // on_complete harus diawali 'emit:' — bukan arbitrary code
  if (!s.on_complete?.startsWith('emit:')) {
    throw new SchemaValidationError(
      `${prefix}.on_complete harus dimulai dengan 'emit:'. Diterima: '${s.on_complete}'`
    )
  }

  // Validasi props tidak mengandung function atau script
  validateProps(s.props, `${prefix}.props`)

  return s as FlowStep
}

function validateProps(props: unknown, path: string) {
  if (!props || typeof props !== 'object') return

  for (const [key, value] of Object.entries(props as object)) {
    // Tidak boleh ada function sebagai props
    if (typeof value === 'function') {
      throw new SchemaValidationError(`${path}.${key} tidak boleh berupa function`)
    }
    // Tidak boleh ada string yang mengandung script injection
    if (typeof value === 'string') {
      if (/<script|javascript:|on\w+=/i.test(value)) {
        throw new SchemaValidationError(`${path}.${key} mengandung konten berbahaya`)
      }
    }
    // Rekursif untuk nested object
    if (typeof value === 'object' && value !== null) {
      validateProps(value, `${path}.${key}`)
    }
  }
}
```

## componentWhitelist.ts

```typescript
// lib/security/componentWhitelist.ts
// Daftar komponen yang diizinkan di-render dari schema server.
// Jika komponen tidak ada di sini → SchemaValidationError → render gagal.
// Update daftar ini setiap kali menambah komponen baru.

export const ALLOWED_COMPONENTS: readonly string[] = [
  // Input (18)
  'product_grid', 'cart_summary', 'payment_method', 'barcode_scanner',
  'barcode_scanner_pos', 'text_input', 'customer_search', 'laundry_input_form',
  'booking_form', 'patient_checkin_form', 'soap_form', 'prescription_form',
  'customer_form_extended', 'guest_form', 'negotiation_form',
  'document_checklist', 'financing_form', 'test_drive_form',

  // Display (14)
  'metric_card', 'chart_bar', 'price_breakdown', 'stock_alert_list',
  'queue_display', 'table_map', 'room_availability_grid', 'bill_summary',
  'chart_line', 'chart_pie', 'data_table', 'product_detail_card',
  'order_status_timeline', 'notification_bell',

  // Action (10)
  'order_confirm', 'print_receipt', 'handover_form', 'room_key_issue',
  'charge_input', 'refund_action', 'stock_adjust_form', 'approval_request',
  'signature_capture', 'photo_capture',

  // Navigation (4)
  'step_wizard', 'breadcrumb', 'bottom_nav', 'sidebar_menu',

  // Layout (6)
  'page_layout', 'modal_wrapper', 'offline_banner', 'loading_skeleton',
  'error_boundary', 'confirmation_dialog',
] as const
```

## propsSanitizer.ts

```typescript
// lib/security/propsSanitizer.ts

/**
 * Sanitasi props sebelum diteruskan ke komponen.
 * Hapus/escape semua string yang berpotensi XSS.
 */
export function sanitizeProps(props: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}

  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string') {
      result[key] = escapeHtml(value)
    } else if (Array.isArray(value)) {
      result[key] = value.map(v => typeof v === 'string' ? escapeHtml(v) : v)
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeProps(value)
    } else {
      result[key] = value  // number, boolean, null — aman langsung
    }
  }

  return result
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;')
}
```

## Penggunaan di FlowRenderer

```typescript
// components/registry/FlowRenderer.tsx
import { validateFlowSchema } from '@/lib/security/schemaValidator'
import { sanitizeProps }      from '@/lib/security/propsSanitizer'

// Validasi schema saat pertama kali diterima dari server
const schema = validateFlowSchema(rawSchemaFromAPI)  // Throw jika invalid

// Sanitasi props sebelum diserahkan ke komponen
const safeProps = sanitizeProps(currentStep.props)
return <Component {...safeProps} />
```
