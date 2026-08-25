# Sales Returns

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Mengoreksi transaksi penjualan yang sudah terjadi melalui retur parsial atau penuh yang tetap menjaga stok, profit, dan piutang tetap sinkron.

## Fitur Saat Ini

- create draft sales return dari histori transaksi
- update draft retur
- complete retur
- refund tunai
- store credit
- tukar barang langsung (*product exchange*) dengan kalkulasi selisih harga, tambah bayar, atau refund selisih
- cetak struk termal retur / tukar barang
- restock ke inventory dan pemotongan stok barang pengganti
- koreksi receivable untuk transaksi `pay_later`
- histori retur penjualan

## Halaman dan Route

- `dashboard/transactions/history`
- `dashboard/sales-returns`
- `sales-returns.create`
- `sales-returns.store`
- `sales-returns.show`
- `sales-returns.update`
- `sales-returns.complete`
- `sales-returns.receipt`

## Permission

- `sales-returns-access`
- `sales-returns-create`
- `sales-returns-complete`

## Alur User

1. user membuka histori transaksi
2. jika transaksi masih punya qty yang returnable, tombol retur tampil
3. user membuat draft retur dari transaksi asal
4. user memilih tipe retur: Refund Tunai, Saldo Toko, atau Tukar Barang
5. jika Tukar Barang, user memilih barang pengganti baru
6. sistem mengkalkulasi selisih harga (Tukar Pas / Kurang Bayar / Lebih Bayar)
7. user menyimpan draft dan menyelesaikan retur
8. sistem memperbarui stok (restock barang lama & potong stok barang baru), mutasi stok, kas shift kasir, profit, dan receivable bila relevan

## Integrasi Data

- `sales_returns`
- `sales_return_items`
- `sales_return_exchange_items`
- `customer_credits`
- `transactions`
- `transaction_details`
- `profits`
- `receivables`
- `stock_mutations`

## Efek Bisnis Penting

- retur completed bisa menambah stok kembali dan memotong stok barang pengganti
- transaksi tukar barang memperhitungkan net cash flow pada shift kasir aktif
- retur pada transaksi piutang bisa mengurangi total receivable
- overpayment dari piutang dapat berubah menjadi refund atau customer credit

## Batasan Saat Ini

- fitur ini bergantung pada migration tabel retur
- shipping cost tidak menjadi bagian nominal retur

## File Sentral

- `app/Http/Controllers/Apps/SalesReturnController.php`
- `app/Models/SalesReturn.php`
- `app/Models/SalesReturnExchangeItem.php`
- `app/Services/StockMutationService.php`
- `app/Services/CashierShiftService.php`
- `app/Services/ThermalPrintService.php`
- `resources/js/Pages/Dashboard/SalesReturns`
