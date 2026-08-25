# Receivables

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Mencatat piutang pelanggan yang berasal dari transaksi `pay_later` dan menyediakan alur pelunasan bertahap.

## Fitur Saat Ini

- list piutang & dashboard aging piutang
- filter status, customer, invoice, due date
- detail piutang & riwayat pembayaran
- pembayaran parsial / bertahap
- bayar piutang online oleh customer via Customer Portal (`docs/features/customer-portal.md`)
- reminder jatuh tempo via CRM & WhatsApp (`docs/features/crm-segments.md`)
- status `unpaid`, `partial`, `paid`, `overdue`
- PDF receivable & statement

## Halaman dan Route

- `dashboard/receivables`
- `receivables.show`
- `receivables.pay`
- `pdf.receivables.show`
- `customer-portal` (bayar piutang online mandiri)

## Permission

- `receivables-access`
- `receivables-pay`

## Alur User

1. checkout `pay_later` membuat receivable dengan tanggal jatuh tempo
2. kasir/admin memantau daftar piutang dan umur piutang (*aging*)
3. customer dapat membayar mandiri via portal publik atau kasir mencatat pembayaran tunai/transfer
4. sistem memperbarui nilai `paid`, `remaining`, dan `status`

## Integrasi Data

- `receivables`
- `receivable_payments`
- `transactions`
- `customers`
- `bank_accounts`
- `customer_campaigns` / `crm_reminders`

## Efek Bisnis Penting

- pembayaran receivable ikut memengaruhi `payment_status` transaksi terkait
- sales return dapat mengoreksi total receivable jika retur berasal dari transaksi piutang
- customer dapat melunasi tagihan secara mandiri lewat payment gateway

## Batasan Saat Ini

- approval flow bertingkat untuk pelunasan manual bernilai besar belum diterapkan

## File Sentral

- `app/Http/Controllers/Apps/ReceivableController.php`
- `app/Services/ReceivableService.php`
- `resources/js/Pages/Dashboard/Receivables`
