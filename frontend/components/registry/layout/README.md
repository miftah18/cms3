# Layout Components

6 komponen wrapper dan layout yang digunakan di semua halaman.

## PageLayout

```tsx
// Wrap semua halaman dengan ini
<PageLayout layout="sidebar-top" show_header={true} show_nav={true} padding="normal">
  {children}
</PageLayout>
```

**Layout options:** `full` | `sidebar-top` | `top-only` | `centered`

## OfflineBanner

Muncul otomatis saat `isOnline === false`. Jangan perlu di-render manual.

```tsx
// Sudah di-mount di PageLayout, tidak perlu import manual
// Tapi bisa dikustomisasi via props:
<OfflineBanner
  show_pending_count={true}
  show_sync_button={true}
  style="banner"    // banner | chip | toast
/>
```

## ErrorBoundary

```tsx
// Wrap setiap komponen dalam flow
<ErrorBoundary report_to_sentry={true} show_retry={true}>
  <ProductGrid {...props} />
</ErrorBoundary>
```

## LoadingSkeleton

```tsx
<LoadingSkeleton type="card" count={6} />
// type: card | list | table | chart | form
```

## ConfirmationDialog

```tsx
<ConfirmationDialog
  title="Hapus Produk?"
  message="Tindakan ini tidak bisa dibatalkan."
  confirm_label="Ya, Hapus"
  cancel_label="Batal"
  danger_mode={true}
  onConfirm={handleDelete}
  onCancel={handleClose}
/>
```
