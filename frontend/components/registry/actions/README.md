# Action Components

10 komponen untuk aksi yang menghasilkan output atau menyelesaikan flow.

## OrderConfirm

```tsx
<OrderConfirm
  auto_advance_seconds={3}
  show_order_number={true}
  show_lottie_animation={true}
  onComplete={() => flowStore.nextStep()}
/>
```

## PrintReceipt

```tsx
<PrintReceipt
  format="thermal_80mm"    // thermal_80mm | thermal_58mm | a5 | a4
  auto_print={false}
  show_qr={true}
  show_loyalty_points={true}
  send_email_option={true}
  onComplete={() => flowStore.resetFlow()}
/>
```

## HandoverForm (Dealer)

```tsx
<HandoverForm
  capture_signature={true}
  photo_required={true}
  generate_bast={true}      // Generate BAST PDF otomatis
  inspection_checklist={true}
  onComplete={(data) => console.log(data.bastUrl)}
/>
```
