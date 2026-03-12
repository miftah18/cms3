# Component Library

52 komponen UI yang membentuk semua tampilan platform. Semua komponen mengimplementasikan `BaseComponentProps` dan mendukung offline mode.

## BaseComponentProps

```typescript
// frontend/components/registry/types.ts
export interface BaseComponentProps {
  onComplete?: (data: any) => void
  onBack?:     () => void
  onError?:    (error: Error) => void
  isLoading?:  boolean
  isDisabled?: boolean
  isOffline?:  boolean
  testId?:     string
}
```

## Kategori & Komponen

### ⌨️ Input (18 komponen)
| Kode | Nama | Digunakan oleh |
|------|------|----------------|
| `product_grid` | ProductGrid | Coffee Shop, Retail, Salon, Restoran, Dealer |
| `cart_summary` | CartSummary | Coffee Shop, Retail, Restoran, Laundry |
| `payment_method` | PaymentMethod | Semua business type |
| `barcode_scanner` | BarcodeScanner | Laundry, Retail, Klinik |
| `barcode_scanner_pos` | BarcodeScannerPOS | Retail/Minimarket |
| `text_input` | TextInput | Semua business type |
| `customer_search` | CustomerSearch | Semua business type |
| `laundry_input_form` | LaundryInputForm | Laundry |
| `booking_form` | BookingForm | Salon/Barbershop |
| `patient_checkin_form` | PatientCheckinForm | Klinik |
| `soap_form` | SOAPForm | Klinik |
| `prescription_form` | PrescriptionForm | Klinik |
| `customer_form_extended` | CustomerFormExtended | Dealer, Klinik |
| `guest_form` | GuestForm | Hotel |
| `negotiation_form` | NegotiationForm | Dealer |
| `document_checklist` | DocumentChecklist | Dealer, Klinik |
| `financing_form` | FinancingForm | Dealer |
| `test_drive_form` | TestDriveForm | Dealer |

### 📊 Display (14 komponen)
| Kode | Nama | Digunakan oleh |
|------|------|----------------|
| `metric_card` | MetricCard | Dashboard semua |
| `chart_bar` | ChartBar | Dashboard semua |
| `price_breakdown` | PriceBreakdown | Laundry, Dealer, Klinik |
| `stock_alert_list` | StockAlertList | Dashboard semua |
| `queue_display` | QueueDisplay | Klinik, Salon |
| `table_map` | TableMap | Restoran |
| `room_availability_grid` | RoomAvailabilityGrid | Hotel |
| `bill_summary` | BillSummary | Hotel, Restoran |
| `chart_line` | ChartLine | Dashboard |
| `chart_pie` | ChartPie | Dashboard |
| `data_table` | DataTable | Reports |
| `product_detail_card` | ProductDetailCard | Dealer |
| `order_status_timeline` | OrderStatusTimeline | Laundry, Klinik |
| `notification_bell` | NotificationBell | Header global |

### ⚡ Action (10 komponen)
| Kode | Nama | Digunakan oleh |
|------|------|----------------|
| `order_confirm` | OrderConfirm | Semua business type |
| `print_receipt` | PrintReceipt | Semua business type |
| `handover_form` | HandoverForm | Dealer |
| `room_key_issue` | RoomKeyIssue | Hotel |
| `charge_input` | ChargeInput | Hotel |
| `refund_action` | RefundAction | Semua (supervisor+) |
| `stock_adjust_form` | StockAdjustForm | Branch Manager+ |
| `approval_request` | ApprovalRequest | Dealer (diskon besar) |
| `signature_capture` | SignatureCapture | Dealer, Hotel |
| `photo_capture` | PhotoCapture | Dealer, Hotel, Klinik |

### 🧭 Navigation (4 komponen)
`step_wizard` · `breadcrumb` · `bottom_nav` · `sidebar_menu`

### 🏗️ Layout (6 komponen)
`page_layout` · `modal_wrapper` · `offline_banner` · `loading_skeleton` · `error_boundary` · `confirmation_dialog`

## Component Registry

```typescript
// frontend/components/registry/index.ts
import { ProductGrid } from './inputs/ProductGrid'
import { CartSummary } from './inputs/CartSummary'
// ...

export const ComponentRegistry: Record<string, React.ComponentType<any>> = {
  product_grid:         ProductGrid,
  cart_summary:         CartSummary,
  payment_method:       PaymentMethod,
  order_confirm:        OrderConfirm,
  print_receipt:        PrintReceipt,
  // ... 47 komponen lainnya
}

export function resolveComponent(code: string) {
  const Component = ComponentRegistry[code]
  if (!Component) {
    console.error(`Komponen tidak ditemukan: ${code}`)
    return null
  }
  return Component
}
```

## Offline-Safe Pattern

```typescript
// Semua komponen yang fetch data gunakan hook ini
export function useOfflineData<T>(
  onlineQuery: () => Promise<T[]>,
  offlineQuery: () => Promise<T[]>,
  cacheKey: string
) {
  const { isOnline } = useSyncStore()
  const [data, setData] = useState<T[]>([])
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      if (isOnline) {
        try {
          const result = await onlineQuery()
          setData(result)
          await cacheToIndexedDB(cacheKey, result)
        } catch {
          const cached = await offlineQuery()
          setData(cached)
          setFromCache(true)
        }
      } else {
        const cached = await offlineQuery()
        setData(cached)
        setFromCache(true)
      }
    }
    fetch()
  }, [isOnline])

  return { data, isLoading: data.length === 0, fromCache }
}
```

## Prioritas Implementasi

| Fase | Komponen | Sprint |
|------|----------|--------|
| Fase 1 — Core POS | product_grid, cart_summary, payment_method, order_confirm, print_receipt, step_wizard, page_layout, offline_banner, loading_skeleton, error_boundary | Sprint 3 |
| Fase 2 — Coffee Shop Dashboard | metric_card, chart_bar, stock_alert_list, customer_search, confirmation_dialog, bottom_nav, sidebar_menu | Sprint 4 |
| Fase 3 — Retail & Laundry | barcode_scanner, barcode_scanner_pos, laundry_input_form, price_breakdown, queue_display | Sprint 7 |
| Fase 4 — Klinik & Salon | patient_checkin_form, soap_form, prescription_form, booking_form, modal_wrapper | Sprint 8 |
| Fase 5 — Dealer & Hotel | negotiation_form, document_checklist, financing_form, test_drive_form, handover_form, room_availability_grid, guest_form, room_key_issue, bill_summary, charge_input, table_map | Sprint 9 |
