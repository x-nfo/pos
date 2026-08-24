# Payables & Suppliers

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Menangani master supplier dan pencatatan hutang supplier beserta pelunasannya.

## Fitur Saat Ini

- CRUD supplier
- list payables
- detail payable
- terintegrasi otomatis dengan **Purchase Order (PO)** & **Goods Receiving (GR)**
- terintegrasi dengan **Supplier Return (SR)** untuk pemotongan/koreksi nilai hutang
- pembayaran hutang supplier (bertahap / parsial)
- status hutang & aging analysis
- PDF payable

## Halaman dan Route

- `dashboard/suppliers`
- `dashboard/payables`
- `payables.show`
- `payables.pay`
- `pdf.payables.show`
- `purchase-orders.*` (lihat `docs/features/purchasing-chain.md`)
- `goods-receivings.*` (lihat `docs/features/purchasing-chain.md`)
- `supplier-returns.*` (lihat `docs/features/purchasing-chain.md`)

## Permission

- `suppliers-access`
- `payables-access`
- `payables-pay`

## Alur User

1. admin/kasir mengelola data supplier
2. hutang supplier otomatis terbuat saat penerimaan barang (**Goods Receiving**) dari **Purchase Order** (atau dapat dicatat manual)
3. retur barang (**Supplier Return**) otomatis memotong sisa tagihan hutang supplier
4. pembayaran dicatat bertahap sampai lunas
5. user dapat membuka detail dan dokumen PDF bukti hutang

## Integrasi Data

- `suppliers`
- `purchase_orders`
- `goods_receivings`
- `supplier_returns`
- `payables`
- `payable_payments`
- `bank_accounts`

## Efek Bisnis Penting

- payable terintegrasi dengan siklus pengadaan (purchasing chain)
- status hutang dan aging menentukan visibilitas kewajiban operasional
- dokumen PDF hutang tersedia untuk kebutuhan administrasi

## Batasan Saat Ini

- reminder otomatis jatuh tempo hutang ke supplier belum terhubung ke channel notifikasi eksternal (misal webhook/email otomatis)

## File Sentral

- `app/Http/Controllers/Apps/SupplierController.php`
- `app/Http/Controllers/Apps/PayableController.php`
- `app/Services/GoodsReceivingService.php`
- `app/Services/SupplierReturnService.php`
- `resources/js/Pages/Dashboard/Suppliers`
- `resources/js/Pages/Dashboard/Payables`
