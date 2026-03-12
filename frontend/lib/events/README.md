# Event Bus

Komunikasi antar komponen menggunakan `mitt` — tiny event emitter. Komponen tidak pernah coupling langsung satu sama lain.

## File

```
lib/events/
├── bus.ts       ← mitt instance + typed emitter
└── types.ts     ← EventMap TypeScript interface
```

## bus.ts

```typescript
// lib/events/bus.ts
import mitt, { Emitter } from 'mitt'
import { EventMap } from './types'

// Typed emitter — TypeScript tahu payload per event
export const eventBus: Emitter<EventMap> = mitt<EventMap>()
```

## types.ts

```typescript
// lib/events/types.ts

export interface CartItem {
  product_id:   string
  product_name: string
  quantity:     number
  unit_price:   number
  subtotal:     number
  notes?:       string
  metadata?:    Record<string, any>
}

export interface EventMap {
  // ── Flow Events ──────────────────────────────────────────
  /** Step 1: Selesai pilih produk/items */
  ITEMS_SELECTED: {
    items:       CartItem[]
    totalAmount: number
  }

  /** Step 2: Cart dikonfirmasi, siap bayar */
  CART_CONFIRMED: {
    items:          CartItem[]
    subtotal:       number
    discount:       number
    tax:            number
    total:          number
    notes?:         string
    customer_id?:   string
  }

  /** Step 3: Pembayaran berhasil diproses (cash/manual) */
  PAYMENT_PROCESSED: {
    method:        string
    amount:        number
    changeAmount?: number   // Kembalian (cash)
    referenceId?:  string
  }

  /** Pembayaran via Midtrans Snap diinisiasi */
  MIDTRANS_INITIATED: {
    snapToken:        string
    snapRedirectUrl:  string
    orderId:          string
  }

  /** Konfirmasi order — animasi sukses */
  ORDER_COMPLETE: {
    transactionId:     string
    transactionNumber: string
    totalAmount:       number
  }

  // ── Sync Events ───────────────────────────────────────────
  SYNC_STARTED: undefined
  SYNC_COMPLETE: {
    synced:    number
    conflicts: number
    failed:    number
  }
  SYNC_CONFLICT: {
    conflictId:   string
    conflictType: string
    detail:       Record<string, any>
  }

  // ── Stock Events ──────────────────────────────────────────
  STOCK_LOW: {
    productId:   string
    productName: string
    quantity:    number
    minimum:     number
  }

  // ── Shift Events ──────────────────────────────────────────
  SHIFT_OPENED: { shiftId: string; openingCash: number }
  SHIFT_CLOSED: { shiftId: string; closingCash: number }

  // ── Business-type Specific ────────────────────────────────
  /** Laundry: tiket di-scan untuk pickup */
  TICKET_SCANNED: {
    orderId:     string
    orderNumber: string
    status:      string
  }

  /** Klinik: pasien selesai checkout kasir */
  PATIENT_CHECKOUT_COMPLETE: {
    patientId:     string
    transactionId: string
  }

  /** Hotel: kamar berhasil di-checkout */
  ROOM_CHECKOUT_COMPLETE: {
    roomId:        string
    transactionId: string
  }

  /** Dealer: approval diskon diminta */
  DISCOUNT_APPROVAL_REQUESTED: {
    amount:      number
    requestedBy: string
    requestId:   string
  }
}
```

## Pola Penggunaan

```typescript
// ── Emit dari komponen ────────────────────────────────────────
// ProductGrid.tsx — emit saat user confirm cart
import { eventBus } from '@/lib/events/bus'

function handleConfirm() {
  eventBus.emit('ITEMS_SELECTED', {
    items: cartItems,
    totalAmount: total,
  })
}

// ── Subscribe di FlowRenderer ─────────────────────────────────
import { eventBus } from '@/lib/events/bus'

useEffect(() => {
  const handler = (data: EventMap['ITEMS_SELECTED']) => {
    flowStore.setStepData('select_items', data)
    flowStore.nextStep()
  }

  eventBus.on('ITEMS_SELECTED', handler)
  return () => eventBus.off('ITEMS_SELECTED', handler)  // Cleanup wajib!
}, [])

// ── One-time handler ──────────────────────────────────────────
// Gunakan mitt 'once' pattern:
const once = (event: keyof EventMap, handler: Function) => {
  const wrapper = (data: any) => {
    handler(data)
    eventBus.off(event, wrapper)
  }
  eventBus.on(event, wrapper)
}
```

## Aturan

1. **Selalu cleanup** — `return () => eventBus.off(...)` di useEffect
2. **Jangan emit di render** — hanya di event handler (onClick, useEffect)
3. **Payload harus serializable** — bisa di-JSON-stringify (untuk sync ke IndexedDB)
4. **Event name = SCREAMING_SNAKE_CASE** — konsistensi dengan constants
5. **Jangan subscribe yang sama dua kali** — cek apakah sudah subscribe sebelumnya
