# Purchasing Chain

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Modul pembelian formal dari supplier: Purchase Order, Goods Receiving, dan Supplier Return. Melengkapi siklus inventory dari pengadaan barang sampai stok masuk ke gudang, pencatatan hutang, pelacakan satuan bertingkat (Multi-UOM), dan batch tracking kadaluarsa.

## Fitur Saat Ini

### Purchase Order (PO)
- Buat PO dengan pilih supplier + item produk.
- **Multi-UOM**: Dukungan satuan bertingkat (`unit_id`, `conversion_factor`) dan penyesuaian harga beli per satuan.
- **Saran Restock (Suggested Qty)**: Kalkulasi otomatis saran kuantitas pemesanan berdasarkan selisih `max_stock` dan stok gudang saat ini.
- Modal pencarian & pemilihan produk massal (*Product Picker Modal*).
- Auto-generate nomor dokumen dengan kode cabang/gudang: `PO-[BRANCH]-YYYYmmdd-XXXX` (contoh: `PO-HQ-20260910-0001`).
- Status lifecycle: `draft` → `ordered` → `partial_received` / `completed` → `cancelled`.
- Filter by status, supplier, nomor dokumen, dan warehouse (khusus HQ).
- Dokumen cetak struk thermal dan ekspor resmi format PDF A4.
- Tautan publik (*public share link*): Akses aman dokumen PO resmi untuk dibagikan ke supplier via tautan token dokumen tanpa login (dilindungi dari enumerasi ID integer).

### Goods Receiving (GR)
- Terima barang dari PO (full atau partial penerimaan bertahap).
- Auto-generate nomor dokumen: `GR-[BRANCH]-YYYYmmdd-XXXX`.
- Qty diterima per item beserta catatan penerimaan.
- Konversi otomatis kuantitas multi-satuan ke satuan dasar (*base unit*) untuk penambahan stok fisik gudang.
- **Proteksi Over-receipt & Race Condition**: Validasi dengan row locking (`lockForUpdate`) di tingkat database transaksi untuk menjamin kuantitas diterima tidak melampaui sisa pesanan PO.
- Auto-update status PO (`partial_received` atau `completed` jika semua item telah diterima penuh).
- **Batch Tracking**: Input **nomor batch** (`batch_number`) + **tanggal kadaluarsa** (`expired_at`) per item penerimaan:
  - Tersimpan pada `goods_receiving_items`.
  - Otomatis membuat atau mengakumulasi stok pada `product_batches`.
  - Dicatat ke riwayat `stock_mutations` dengan referensi batch.
- **Sinkronisasi HPP/COGS (Perpetual Moving Average)**: Otomatis menghitung ulang harga beli produk (`Product::buy_price`) dengan metode rata-rata bergerak tertimbang (*weighted moving average*) antara saldo stok lama dengan stok masuk dari PO yang dikonversi ke satuan dasar.
- Increment stok pada pivot gudang tujuan (`product_warehouse.stock`).
- **Auto-create Payable**: Otomatis membentuk tagihan hutang supplier dengan default jatuh tempo 30 hari (*due date* = 30 hari).

### Supplier Return (SR)
- Retur barang ke supplier berdasarkan referensi dokumen Goods Receiving (GR) atau pemilihan langsung item produk.
- **Auto-resolve Referensi & Hutang**: Saat memilih dokumen GR rujukan, sistem secara otomatis mengaitkan gudang, supplier, dan dokumen hutang terkait (`payable_id`).
- **Multi-UOM & Batch Tracking**:
  - Mendukung satuan bertingkat (`unit_id`, `conversion_factor`) dan pencatatan nomor batch (`batch_number`).
  - Pemotongan stok fisik gudang pivot dihitung akurat berdasarkan kuantitas satuan dasar (`qty_returned * conversion_factor`).
  - Otomatis mengurangi stok batch pada `product_batches` sesuai nomor batch yang diretur.
  - Mencatat mutasi stok keluar (`mutation_type = out`) beserta nomor batch pada `stock_mutations`.
- Auto-generate nomor dokumen dengan kode cabang/gudang: `SR-[BRANCH]-YYYYmmdd-XXXX` (contoh: `SR-HQ-20260911-0001`).
- Status lifecycle: `draft` → `completed` / `cancelled`.
- Validasi ketersediaan stok fisik gudang sebelum retur dibuat maupun diselesaikan.
- Koreksi payable: Otomatis memotong saldo tagihan hutang supplier terkait (`payables.total`) saat retur diselesaikan.
- Alasan retur dan catatan per item.

### Isolasi Cabang (Branch Isolation)
- Pengguna cabang non-HQ terkunci pada `warehouse_id` masing-masing (pada pembuatan PO, GR, maupun Retur).
- Proteksi otorisasi ketat (`authorizeWarehouseAccess`): Pengguna non-HQ tidak dapat melihat, membuat, atau memanipulasi dokumen PO, GR, maupun Retur Supplier milik cabang lain (menghasilkan respons `403 Forbidden`).

## Halaman dan Route

| Halaman | Route | Method | Keterangan |
|---------|-------|--------|------------|
| Daftar PO | `purchase-orders.index` | GET | Menampilkan riwayat dan status PO |
| Buat PO | `purchase-orders.create` | GET | Form pembuatan PO dengan multi-UOM & suggested qty |
| Simpan PO | `purchase-orders.store` | POST | Menyimpan draft PO |
| Detail PO | `purchase-orders.show` | GET | Melihat detail PO dan riwayat GR terkait |
| Cetak PO | `purchase-orders.print` | GET | Tampilan cetak struk/voucher PO |
| Unduh PDF PO | `pdf.purchase-orders.show` | GET | Cetak / unduh dokumen formal PO berformat PDF A4 |
| Public Share PO | `purchase-orders.public` | GET | Tautan publik PO untuk dibagikan ke supplier (tanpa login) |
| Edit PO | `purchase-orders.edit` | GET | Form edit PO (hanya untuk status draft) |
| Update PO | `purchase-orders.update` | PUT | Memperbarui data draft PO |
| Place PO | `purchase-orders.place` | POST | Mengubah status draft menjadi ordered |
| Cancel PO | `purchase-orders.cancel` | POST | Membatalkan PO (draft, ordered, atau partial_received) |
| Daftar GR | `goods-receivings.index` | GET | Menampilkan riwayat penerimaan barang |
| Buat GR | `goods-receivings.create` | GET | Form penerimaan barang dari PO ordered/partial |
| Simpan GR | `goods-receivings.store` | POST | Menyimpan penerimaan, menambah stok, batch & hutang |
| Detail GR | `goods-receivings.show` | GET | Melihat detail penerimaan barang dan nomor batch |
| Daftar SR | `supplier-returns.index` | GET | Menampilkan riwayat retur supplier |
| Buat SR | `supplier-returns.create` | GET | Form pembuatan retur barang dari GR / produk |
| Simpan SR | `supplier-returns.store` | POST | Menyimpan draft retur supplier |
| Detail SR | `supplier-returns.show` | GET | Melihat detail retur supplier |
| Complete SR | `supplier-returns.complete` | POST | Menyelesaikan retur, memotong stok gudang & saldo hutang |
| Cancel SR | `supplier-returns.cancel` | POST | Membatalkan draft retur supplier |

## Permission

| Permission | Untuk apa |
|-----------|-----------|
| `purchase-orders-access` | Lihat daftar, detail, cetak struk, dan PDF PO |
| `purchase-orders-create` | Buat draft PO baru |
| `purchase-orders-update` | Edit/update draft PO, pesan (place), dan batalkan (cancel) PO |
| `goods-receivings-access` | Lihat daftar & detail penerimaan barang (GR) |
| `goods-receivings-create` | Buat penerimaan barang baru dari PO |
| `supplier-returns-access` | Lihat daftar & detail retur supplier (SR) |
| `supplier-returns-create` | Buat draft retur supplier baru |
| `supplier-returns-update` | Selesaikan (complete) atau batalkan (cancel) retur supplier |

## Alur User

1. **Buat PO**: Pilih gudang tujuan, supplier, tambahkan item produk (opsional: pilih satuan bertingkat dan gunakan saran restock), lalu simpan sebagai draft.
2. **Place PO**: Konfirmasi pemesanan sehingga status berubah dari `draft` menjadi `ordered`.
3. **Goods Receiving**: Saat barang fisik tiba di gudang, pilih PO yang berstatus `ordered` atau `partial_received`, masukkan kuantitas barang diterima, nomor batch, tanggal kadaluarsa, lalu simpan.
4. **Supplier Return (Jika ada barang rusak/cacat)**: Buat dokumen retur dengan memilih item dari dokumen penerimaan (GR) atau produk langsung, lalu klik *Complete* untuk memotong stok fisik gudang (dan batch jika ada) serta memotong saldo hutang supplier terkait secara otomatis.
5. **Penyelesaian Hutang**: Dokumen hutang (*Payable*) otomatis terbentuk pada modul Payables saat GR dicatat dan dapat diselesaikan bertahap oleh bagian Keuangan.

## Integrasi Data

- `purchase_orders` → `purchase_order_items` → saat di-GR, `qty_received` bertambah sesuai qty yang masuk.
- `goods_receivings` → `goods_receiving_items` → mencatat qty diterima, `batch_number`, dan `expired_at`.
- `supplier_returns` → `supplier_return_items` → mencatat qty diretur, `unit_id`, `conversion_factor`, `batch_number`, dan referensi item GR.
- `product_batches` → otomatis dibuat atau bertambah stoknya saat GR, dan otomatis berkurang saat retur supplier diselesaikan.
- `product_warehouse` → stok fisik pada gudang tujuan bertambah pada GR dan berkurang pada Retur sebesar kuantitas dasar (`qty * conversion_factor`).
- `products.buy_price` → dihitung ulang otomatis menggunakan metode Perpetual Moving Average Costing saat GR agar valuasi stok dan HPP tetap adil dan akurat secara akuntansi.
- `stock_mutations` → mutasi tipe `in` tercatat untuk GR (beserta nomor batch) dan tipe `out` untuk retur supplier (beserta nomor batch).
- `payables` → otomatis dibuat/diakumulasi dari GR dengan jatuh tempo 30 hari; otomatis dipotong saldonya jika retur diselesaikan.
- `warehouse_id` pada PO → diturunkan ke GR dan divalidasi ke isolasi gudang pengguna.
- `audit_logs` → merekam audit trail lengkap pada setiap transisi status dan pembuatan dokumen.
