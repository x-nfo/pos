# Payables & Suppliers

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Menangani master supplier dan pencatatan hutang supplier (*Accounts Payable*) beserta siklus pelunasan, koreksi, aging analysis, dan integrasi pengadaan barang.

## Fitur Saat Ini

- **Master Supplier**: CRUD data pemasok (nama, kontak telepon, email, alamat).
- **Pencatatan Hutang Terpadu**:
  - Otomatis terbuat dari penerimaan barang (**Goods Receiving**) dari **Purchase Order (PO)**.
  - Akumulasi akurat pada penerimaan bertahap (*Partial Goods Receiving*).
  - Pencatatan manual dengan dukungan **Nomor Faktur Supplier** (*Vendor Invoice Number*).
- **Pelunasan Bertahap (*Multi-stage Payment*)**:
  - Pembayaran dicatat per termin (Tunai atau Transfer Bank dengan referensi rekening).
  - Pengamanan transaksi dengan *Row Locking* (`lockForUpdate`) untuk mencegah *overpayment* dan *race condition*.
- **Koreksi & Pembatalan Pembayaran (*Void Payment*)**:
  - Penghapusan pembayaran yang salah input dengan verifikasi password akun pengguna (*Step-up Verification Popup*).
  - Saldo sisa hutang dan status otomatis dipulihkan.
  - Aktivitas tercatat lengkap di *Audit Log*.
- **Integrasi Retur Pembelian (*Supplier Return*)**:
  - Retur barang ke supplier otomatis memotong tagihan hutang terkait.
- **Analisis Umur Hutang (*Aging Analysis*)**:
  - Pengelompokan umur hutang (*Current, 1-30 hari, 31-60 hari, 61-90 hari, 90+ hari*).
  - Notifikasi proaktif tagihan yang akan jatuh tempo pada dashboard.
- **Supplier Statement & Dokumen PDF**:
  - Rekap riwayat mutasi hutang per supplier (*Statement of Account*).
  - Ekspor/Cetak voucher hutang dalam format PDF.

## Halaman dan Route

- `dashboard/suppliers` (`suppliers.index`, `suppliers.store`, `suppliers.update`, `suppliers.destroy`)
- `dashboard/payables` (`payables.index`, `payables.store`)
- `payables.show` (`/payables/{payable}`)
- `payables.pay` (`POST /payables/{payable}/pay`)
- `payables.payments.destroy` (`DELETE /payables/{payable}/payments/{payment}`)
- `payables.supplier-statement` (`GET /payables/supplier-statement`)
- `pdf.payables.show` (`GET /documents/payables/{payable}/pdf`)

## Matriks Wewenang & Hak Akses (RBAC Best Practice)

| Role | Lihat & Lacak Hutang (`payables-access`) | Catat Pelunasan (`payables-pay`) | Batalkan Pembayaran (Wajib Password) | Kelola Supplier (`suppliers-access`) |
| :--- | :---: | :---: | :---: | :---: |
| **Kasir (*Cashier*)** | ❌ | ❌ | ❌ | ❌ |
| **Gudang (*Warehouse Staff*)** | ❌ | ❌ | ❌ | ✅ (Hanya Referensi PO/GR) |
| **Staf Keuangan (*Finance Staff*)** | ✅ | ✅ | ✅ (Dengan Password) | ✅ |
| **Store Manager** | ✅ | ✅ | ✅ (Dengan Password) | ✅ |
| **Super Admin** | ✅ | ✅ | ✅ (Dengan Password) | ✅ |

## Alur Pengguna

1. Admin / Staf Purchasing membuat pesanan pembelian (**Purchase Order**).
2. Saat barang tiba di gudang, staf gudang mencatat penerimaan (**Goods Receiving**).
3. Sistem secara otomatis membentuk dokumen hutang (**Payable**) dengan nilai akumulatif barang yang diterima.
4. Jika ada faktur fisik dari supplier, nomor faktur eksternal dicatat di kolom *No. Faktur Supplier*.
5. Bagian Keuangan mencatat cicilan pembayaran hutang hingga lunas.
6. Jika terjadi kesalahan input pembayaran, staf berwenang dapat menghapusnya dengan mengonfirmasi password login akun.
7. Jika terdapat barang cacat/rusak, penyelesaian **Supplier Return** otomatis memotong sisa saldo hutang.

## Integrasi Data

- `suppliers`
- `purchase_orders` & `purchase_order_items`
- `goods_receivings` & `goods_receiving_items`
- `supplier_returns` & `supplier_return_items`
- `payables`
- `payable_payments`
- `bank_accounts`
- `audit_logs`

## File Sentral

- `app/Http/Controllers/Apps/SupplierController.php`
- `app/Http/Controllers/Apps/PayableController.php`
- `app/Services/GoodsReceivingService.php`
- `app/Services/SupplierReturnService.php`
- `app/Services/PayableAgingService.php`
- `resources/js/Pages/Dashboard/Suppliers/Index.jsx`
- `resources/js/Pages/Dashboard/Payables/Index.jsx`
- `resources/js/Pages/Dashboard/Payables/Show.jsx`
- `resources/views/pdf/payable.blade.php`
- `tests/Feature/Payables/PayableTest.php`
