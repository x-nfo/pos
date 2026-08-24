# Inventory & Stock

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Menjaga akurasi stok melalui master produk, stock opname, dan histori mutasi stok.

## Fitur Saat Ini

- CRUD produk
- initial stock saat create product
- stock tidak bisa diubah langsung dari edit product
- stock opname draft → finalized
- stock mutation list (mencakup penjualan POS, pesanan meja, restock pembelian, retur, transfer gudang, opname, dan initial stock)
- low stock notification

## Halaman dan Route

- `dashboard/products`
- `dashboard/stock-opnames`
- `dashboard/stock-mutations`

## Permission

- `products-access`, `products-create`, `products-edit`, `products-delete`
- `stock-opnames-access`, `stock-opnames-create`, `stock-opnames-finalize`
- `stock-mutations-access`

## Alur User

1. produk dibuat dengan initial stock
2. initial stock menghasilkan stock mutation awal (`product_create`)
3. penjualan POS / pesanan meja mengurangi stok dan mencatat mutasi keluar (`transaction` / `dine_order`)
4. penerimaan barang dan retur penjualan mencatat mutasi masuk (`goods_receiving` / `sales_return`)
5. stock opname dibuat sebagai draft
6. produk ditambahkan ke sesi opname
7. stok fisik diisi per item
8. finalize mengubah stok produk dan membuat stock mutation adjustment (`stock_opname`)

## Integrasi Data

- `products`
- `stock_opnames`
- `stock_opname_items`
- `stock_mutations`
- `product_warehouses`
- `product_notification_reads`

## Efek Bisnis Penting

- edit product tidak lagi menjadi jalur mutasi stok
- sales checkout dan dine-in order otomatis mencatat histori mutasi keluar
- sales return dan stock opname dapat menambah stok kembali
- histori mutasi adalah audit trail inventory utama yang mencakup seluruh alur pergerakan barang

## Batasan Saat Ini

- alur multi warehouse belum sepenuhnya mendukung sinkronisasi stok lintas cabang secara desentralisasi

## File Sentral

- `app/Http/Controllers/Apps/ProductController.php`
- `app/Http/Controllers/Apps/TransactionController.php`
- `app/Http/Controllers/Apps/StockOpnameController.php`
- `app/Http/Controllers/Apps/StockMutationController.php`
- `app/Services/StockMutationService.php`
- `app/Services/DineOrderService.php`
