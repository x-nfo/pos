# Thermal Printer

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Cetak receipt ke printer thermal (ESC/POS protocol) langsung dari browser via WebUSB, atau melalui server-side text generation.

## Fitur Saat Ini

### ThermalPrintService (Server-side)
- Generate teks receipt dalam format monospace
- Support 80mm (48 karakter) dan 58mm (32 karakter)
- Format: header toko, invoice info, item list, subtotal, diskon, PPN, total, pembayaran, footer
- Output: plain text (`generateReceiptText`) dan HTML (`generateReceiptHtml`)

### Thermal Print Route
- `GET /dashboard/documents/transactions/{invoice}/print/thermal` — HTML receipt
- Dapat dibuka di tab baru untuk print via browser

### Printer Settings
- Paper size: 80mm / 58mm
- Auto-print toggle & driver pilihan (Browser Print, WebUSB Direct, WebBluetooth PWA)
- WebUSB: koneksi printer thermal via USB langsung dari browser
- WebBluetooth: koneksi printer thermal Bluetooth BLE langsung dari browser/PWA

### Thermal Print Options
- Tombol "Print Browser", "WebUSB", dan "Bluetooth" di halaman print transaksi
- Auto-print langsung berjalan otomatis saat checkout kasir selesai sesuai setting driver

## Route

| Route | Method | Fungsi |
|-------|--------|--------|
| `transactions.print` | GET | Halaman cetak transaksi multi-driver (Browser, USB, Bluetooth) |
| `pdf.transactions.thermal` | GET | HTML receipt thermal monospace |
| `settings.printer` | GET | Halaman settings printer |
| `settings.printer.update` | POST | Simpan settings printer |

## Format Receipt (80mm)

```
            TOKO ANDA
        Jl. Contoh No. 123
        Telp: 021-123456
--------------------------------
No: TRX-XXXXXXXXXX
Tgl: 22/06/2026 14:30
Kasir: Arya
Pelanggan: Umum
--------------------------------
Produk A
2x @ 10.000          20.000
Produk B
1x @ 15.000          15.000
--------------------------------
Subtotal             35.000
PPN                   3.850
--------------------------------
TOTAL                38.850
Tunai                50.000
Kembali              11.150
--------------------------------
        Terima kasih
```

## Catatan

- Untuk direct print via USB: browser Chrome/Edge dengan WebUSB API support
- Untuk direct print via Bluetooth: browser Chrome Android/Desktop dengan Web Bluetooth API support
- Auto-print terintegrasi penuh pada halaman invoice/print setelah transaksi kasir berhasil diselesaikan
