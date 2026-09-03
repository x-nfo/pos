# Reports & Documents

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Menyediakan visibilitas performa bisnis menyeluruh melalui laporan analitik, laporan operasional multi-cabang, serta dokumen transaksi siap cetak dan bagikan (*shareable documents*).

## Fitur Saat Ini

- **Laporan Penjualan (*Sales Report*)**: Ringkasan omzet, total item terjual, laba bersih, filter rentang tanggal, kasir, pelanggan, dan **filter Cabang/Gudang**, serta kolom asal Cabang.
- **Laporan Laba Rugi (*Profit Report*)**: Evaluasi profitabilitas kotor, HPP/COGS per transaksi, rekonsiliasi retur penjualan, serta pemilahan per Cabang.
- **Advanced Sales Insights**: Analisis analitik jam sibuk (*sales by hour*), kurva tren harian, top 10 produk terlaris, produk kurang laku (*slow moving*), margin laba per kategori, performa kasir (*cashier leaderboard*), retensi pelanggan (*repeat customer rate*), dan estimasi ketahanan stok (*stock coverage*) per cabang.
- **Invoice Transaksi**: Format PDF dan web publik dengan identitas dinamis cabang penugasan kasir.
- **Receipt Thermal 58mm / 80mm**: Format struk kasir dengan nama, alamat, dan kontak cabang dinamis.
- **Shipping Label & Slip Pengiriman**: Label paket pengiriman barang.
- **Dokumen Piutang & Hutang (PDF)**: Rekap penagihan piutang pelanggan dan faktur hutang supplier.

## Halaman dan Route

- `dashboard/reports/sales` (`reports.sales.index`) — Laporan Penjualan
- `dashboard/reports/profits` (`reports.profits.index`) — Laporan Laba Rugi
- `dashboard/reports/insights` (`reports.insights.index`) — Advanced Sales Insights
- `pdf.transactions.invoice` — PDF Invoice Transaksi
- `pdf.transactions.thermal` — Struk Thermal Monospace
- `pdf.transactions.shipping` — Label Pengiriman
- `pdf.receivables.show` — PDF Rekap Piutang
- `pdf.payables.show` — PDF Faktur Hutang

## Dukungan Multi-Cabang (*Branch Scoping*)

1. **Akun Pusat (HQ)**:
   - Memiliki dropdown filter **Cabang / Gudang** pada Laporan Penjualan, Laba Rugi, dan Advanced Insights.
   - Pilihan default *"Semua Cabang"* menyajikan data konsolidasi seluruh bisnis.
2. **Akun Cabang**:
   - Sistem secara otomatis mengunci (*hard-isolated*) laporan ke cabang penempatan pengguna (`warehouse_id`).
   - Pilihan cabang lain disembunyikan dan data cabang lain tidak dapat diakses.

## Permission

- `reports-access` — Mengakses laporan penjualan dan insights
- `profits-access` — Mengakses laporan laba rugi dan HPP
- Akses dokumen mengikuti modul asal seperti `transactions-access`, `receivables-access`, dan `payables-access`.

## File Sentral

- `app/Http/Controllers/Reports/SalesReportController.php`
- `app/Http/Controllers/Reports/ProfitReportController.php`
- `app/Http/Controllers/Reports/AdvancedSalesInsightsController.php`
- `app/Http/Controllers/DocumentController.php`
- `resources/js/Pages/Dashboard/Reports/Sales.jsx`
- `resources/js/Pages/Dashboard/Reports/Profit.jsx`
- `resources/js/Pages/Dashboard/Reports/Insights.jsx`
