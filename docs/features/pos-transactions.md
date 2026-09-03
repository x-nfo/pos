# POS & Transactions

Kembali ke indeks dokumentasi: `docs/README.md`

## Daftar Isi

- Tujuan
- Fitur Saat Ini
- Halaman dan Route
- Permission
- Alur User
- Integrasi Data
- Batasan Saat Ini
- File Sentral

## Tujuan

Menyediakan alur kasir cepat untuk pencarian produk, pengelolaan cart, checkout, hold/resume, dan distribusi dokumen transaksi.

## Fitur Saat Ini

- cari produk via barcode / pencarian
- **Isolasi Stok Cabang**: Hanya produk dengan stok fisik > 0 di cabang shift kasir yang aktif yang dapat dijual
- cart multi-item dengan dukungan multi-satuan (Multi-UOM)
- update qty cart & harga bertingkat (Price List)
- hold transaction (antrean belanja)
- resume held cart
- clear held cart
- checkout tunai, bank transfer, Midtrans, Xendit, QRIS, pay later
- **Struk Kasir Dinamis Per Cabang**: Cetak struk otomatis mencantumkan nama, alamat, dan nomor kontak cabang penempatan kasir
- print invoice / receipt / shipping label (WebUSB Direct & Web Bluetooth)
- share invoice publik
- add customer langsung dari POS

## Halaman dan Route

- `dashboard/transactions`
- `dashboard/transactions/history`
- `transactions.searchProduct`
- `transactions.addToCart`
- `transactions.updateCart`
- `transactions.destroyCart`
- `transactions.hold`
- `transactions.resume`
- `transactions.clearHold`
- `transactions.held`
- `transactions.store`
- `transactions.print`
- `transactions.public`

## Permission

- `transactions-access`

Operasi transaksional tertentu juga mewajibkan middleware `active_shift`.

## Alur User

1. kasir membuka halaman transaksi POS (`/pos`)
2. jika shift aktif, kasir dapat cari produk dan membangun cart (stok otomatis mengacu pada cabang penempatan shift)
3. cart dapat di-hold lalu di-resume
4. checkout membuat transaksi, detail, profit, pengurangan stok fisik pada gudang/cabang terkait, dan pencatatan mutasi stok keluar
5. jika `pay_later`, sistem membuat receivable yang terikat ke transaksi cabang
6. user diarahkan ke dokumen print / invoice (dengan opsi auto-print direct receipt dengan header alamat cabang)

## Integrasi Data

- `transactions`
- `transaction_details`
- `profits`
- `receivables`
- `stock_mutations`
- `product_warehouses`
- `bank_accounts`
- `payment_settings`

## Batasan Saat Ini

- operasi cart dan checkout bergantung pada shift aktif
- payment gateway bergantung pada konfigurasi valid

## File Sentral

- `routes/web.php`
- `app/Http/Controllers/Apps/TransactionController.php`
- `app/Services/StockMutationService.php`
- `resources/js/Pages/Dashboard/Transactions`
