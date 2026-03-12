# Navigation Components

4 komponen navigasi yang di-render berdasarkan UI schema dari server.

## StepWizard

Progress indicator untuk multi-step flow. Otomatis dirender oleh FlowRenderer.

```tsx
<StepWizard
  steps={["Pilih Menu", "Keranjang", "Bayar", "Konfirmasi", "Struk"]}
  current_step={1}
  show_labels={true}
  style="dots"    // dots | numbers | progress_bar
/>
```

## BottomNav

Navigasi utama mobile. Items dikonfigurasi via UI schema dari server.

```tsx
<BottomNav
  items={[
    { label: "POS", icon: "point_of_sale", href: "/pos", roles: ["cashier"] },
    { label: "Laporan", icon: "bar_chart", href: "/reports", roles: ["branch_manager"] },
    { label: "Stok", icon: "inventory", href: "/stock", roles: ["branch_manager"] },
    { label: "Pengaturan", icon: "settings", href: "/settings", roles: ["tenant_admin"] },
  ]}
  show_badge={true}
/>
```

## SidebarMenu

Navigasi desktop/tablet. Collapsible.

```tsx
<SidebarMenu
  collapsible={true}
  show_tenant_logo={true}
  items={menuItems}  // dari UI schema server
/>
```
