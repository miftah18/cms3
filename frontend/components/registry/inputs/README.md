# Input Components

18 komponen untuk menerima input dari user dalam flow transaksi.

## ProductGrid

Komponen paling sering digunakan — grid produk interaktif.

```tsx
<ProductGrid
  show_search={true}
  show_categories={true}
  grid_columns={3}
  show_image={true}
  onComplete={(data) => console.log(data.items, data.totalAmount)}
/>
```

**Props:** show_search, show_categories, grid_columns, show_image, allow_multiple, show_stock_badge, show_notes_per_item, send_to_kitchen, multi_round_order  
**Emits:** ITEMS_SELECTED `{ items[], totalAmount }`

---

## CartSummary

Review dan edit cart sebelum pembayaran.

```tsx
<CartSummary
  show_notes={true}
  allow_qty_edit={true}
  show_promo={false}
  service_charge_percent={5}
  tax_percent={11}
  onComplete={(data) => console.log(data.total)}
/>
```

**Props:** show_notes, allow_qty_edit, allow_remove, show_promo, membership_discount, show_all_rounds, allow_split_bill, service_charge_percent, tax_percent  
**Emits:** CART_CONFIRMED `{ items[], subtotal, discount, tax, total }`

---

## PaymentMethod

Universal payment — cash, Midtrans, QRIS, debit, BPJS.

```tsx
<PaymentMethod
  allowed={["cash", "midtrans", "qris"]}
  allow_split={true}
  cashback_display={true}
  onComplete={(data) => console.log(data.method, data.amount)}
/>
```

**Props:** allowed, allow_split, allow_dp, dp_minimum_percent, cashback_display, collect_deposit, deposit_amount, show_tips_option, show_rincian_biaya  
**Emits:** PAYMENT_PROCESSED `{ method, amount, changeAmount? }` | MIDTRANS_INITIATED `{ snapToken }`

---

## Komponen Lainnya

| Kode | Props Utama |
|------|-------------|
| `barcode_scanner` | mode, auto_submit, lookup_entity |
| `barcode_scanner_pos` | auto_add_on_scan, show_running_total, beep_on_scan |
| `text_input` | field_type, label, required, max_length |
| `customer_search` | search_by, allow_create, required |
| `laundry_input_form` | weight_unit, allow_express, service_types |
| `booking_form` | select_stylist, time_slot_picker, walk_in_option |
| `patient_checkin_form` | search_existing_patient, collect_complaint, select_doctor |
| `soap_form` | fields (SOAP), vital_signs, icd10_search |
| `prescription_form` | drug_search, dosage_templates, drug_interaction_check |
| `customer_form_extended` | fields, id_scan, capture_photo |
| `guest_form` | id_scan, nationality_select, police_report_fields |
| `negotiation_form` | show_otr_price, allow_discount_input, require_supervisor_approval_above |
| `document_checklist` | required_docs, allow_upload |
| `financing_form` | leasing_partners, show_installment_calculator |
| `test_drive_form` | capture_signature, require_id_scan |
