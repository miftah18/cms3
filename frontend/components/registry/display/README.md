# Display Components

14 komponen untuk menampilkan data dan visualisasi.

## MetricCard

```tsx
<MetricCard
  data_source="sales.today"
  label="Penjualan Hari Ini"
  format="currency"
  show_trend={true}
  color_scheme="blue"
/>
```

## ChartBar

```tsx
<ChartBar
  data_source="sales.weekly"
  label="Penjualan Mingguan"
  height={200}
  show_values={true}
/>
```

## TableMap (Restoran)

```tsx
<TableMap
  show_occupancy={true}
  allow_merge_tables={false}
  layout_from_server={true}
  onComplete={(data) => console.log(data.tableId)}
/>
```

## RoomAvailabilityGrid (Hotel)

```tsx
<RoomAvailabilityGrid
  date_range_picker={true}
  show_room_type={true}
  show_price_per_night={true}
  onComplete={(data) => console.log(data.roomId, data.checkIn, data.checkOut)}
/>
```

## Komponen Lainnya

| Kode | Digunakan oleh |
|------|----------------|
| `price_breakdown` | Laundry, Dealer, Klinik |
| `stock_alert_list` | Dashboard semua |
| `queue_display` | Klinik, Salon |
| `bill_summary` | Hotel, Restoran |
| `chart_line` | Dashboard |
| `chart_pie` | Dashboard |
| `data_table` | Reports |
| `order_status_timeline` | Laundry, Klinik |
