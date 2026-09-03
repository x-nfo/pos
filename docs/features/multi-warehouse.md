# Multi-Warehouse & Multi-Cabang

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Memisahkan stok produk, operasional kasir, piutang, dan pelaporan per lokasi fisik (gudang pusat, cabang toko, gudang penyangga). Memungkinkan pengelolaan ritel multi-cabang terintegrasi secara profesional dengan pemisahan peran antara kantor pusat (HQ) dan staf cabang.

## Definisi & Tipe Lokasi

| Istilah | Tipe Sistem | Arti & Peran |
|---------|-------------|--------------|
| **Gudang Utama (Pusat)** | `main` | Pusat penerimaan barang dari supplier (PO & GR), transit logistik, dan suplai ke cabang. |
| **Cabang Toko (Outlet)** | `branch` | Lokasi toko fisik yang melayani penjualan langsung ke pelanggan (POS kasir), memiliki kasir shift, stok fisik rak, serta alamat dan nomor telepon unik pada struk. |
| **Gudang Penyangga** | `warehouse` | Tempat penyimpanan stok cadangan (tidak melayani penjualan kasir langsung). |

## Arsitektur & Aturan Multi-Cabang

### 1. Model Pengguna: Kantor Pusat (HQ) vs Akun Cabang
- **Super Admin / Akun Pusat (`warehouse_id = null`)**:
  - Dianggap sebagai akun HQ (`$user->isHQ() === true`).
  - Memiliki akses konsolidasi ke seluruh cabang.
  - Dapat beralih (*switch*) tampilan Dashboard, Laporan Penjualan, Laba Rugi, Insights, Piutang, PO, dan Shift Kasir ke cabang manapun melalui dropdown filter.
- **Akun Cabang (`warehouse_id != null`)**:
  - Diberikan penugasan tetap ke satu cabang (`$user->isHQ() === false`).
  - Terkunci secara otomatis (*hard-isolation*):
    - **Dashboard**: Hanya melihat omzet, grafik pendapatan, dan transaksi cabangnya.
    - **POS & Kasir**: Hanya dapat membuka shift dan menjual produk dengan stok di cabangnya (`product_warehouse.stock > 0`).
    - **Katalog Produk**: Kolom stok otomatis menampilkan stok fisik cabangnya.
    - **Laporan**: Hanya dapat melihat Laporan Penjualan, Laba Rugi, dan Insights untuk cabangnya.
    - **Piutang**: Hanya mengelola dan menagih piutang yang berasal dari transaksi cabangnya.
    - **Stock Transfer**: Wajib melibatkan cabangnya sebagai asal (*source*) atau tujuan (*destination*).
    - **Stock Opname**: Hanya dapat mengaudit stok pada rak/gudang cabangnya.

### 2. Header Struk Dinamis Per Cabang (*Dynamic Receipt*)
- Struk cetak thermal (58mm / 80mm) dan invoice digital/PDF otomatis menampilkan **Nama Cabang**, **Alamat Cabang**, dan **Nomor Telepon/WhatsApp Cabang** tempat kasir bertugas.
- Jika alamat cabang belum diisi, sistem secara otomatis melakukan *fallback* ke alamat profil toko pusat (`StoreProfile`), menjamin tampilan struk selalu rapi dan tidak pernah kosong.

### 3. Product-Warehouse Pivot (Stok Fisik Terpisah)
- Stok fisik dicatat per produk per gudang/cabang pada tabel pivot `product_warehouse`.
- Saat cabang/gudang baru ditambahkan, seluruh produk otomatis disinkronkan dengan saldo awal `0`.
- Saat seeder dijalankan, stok awal produk dialokasikan ke Gudang Pusat (`main`).

### 4. Siklus Pengadaan & Transfer Antar-Gudang
- **Purchase Order (PO)**: Memiliki `warehouse_id` tujuan pengiriman barang.
- **Goods Receiving (GR)**: Penerimaan barang otomatis menambah stok fisik di gudang tujuan PO.
- **Transfer Stok Antar-Cabang**: Mendukung status *draft* $\rightarrow$ *in_transit* (stok asal berkurang) $\rightarrow$ *completed* (stok tujuan bertambah setelah konfirmasi penerimaan) atau *cancelled* (stok kembali ke asal).

### 5. Pelaporan & Analisis Multi-Cabang
- **Dashboard Switcher**: Di header Dashboard, pengguna HQ dapat memilih *"Semua Cabang (Konsolidasi)"* atau memilih cabang tertentu untuk mengubah seluruh metrik KPI secara instan.
- **Laporan Penjualan & Laba Rugi**: Dilengkapi filter dropdown cabang dan kolom cabang di tabel transaksi.
- **Advanced Sales Insights**: Analisis jam sibuk (*sales by hour*), produk terlaris, produk *slow moving*, retensi pelanggan, dan leaderboard performa kasir per cabang.

## Halaman dan Route

| Route | Fungsi | Akses Peran |
|-------|--------|-------------|
| `settings.warehouses.index` | Manajemen master cabang & gudang (nama, alamat, telepon, tipe) | HQ / Super Admin |
| `stock-transfers.index` | Daftar transfer stok antar-cabang | HQ & Cabang terkait |
| `stock-transfers.create` | Formulir pengiriman transfer stok | HQ & Cabang terkait |
| `stock-transfers.show` | Detail transfer & tombol aksi (Kirim / Terima / Batalkan) | HQ & Cabang terkait |
| `stock-opnames.index` | Audit fisik opname stok per cabang | HQ & Cabang terkait |

## Permission

| Permission | Kegunaan |
|-----------|----------|
| `warehouses-access` | Melihat daftar gudang / cabang |
| `warehouses-create` | Mendaftarkan cabang / gudang baru |
| `warehouses-update` | Mengubah informasi cabang (alamat, nomor telp) |
| `warehouses-delete` | Menghapus cabang (hanya jika saldo stok 0) |
| `stock-transfers-access` | Mengakses modul transfer stok |
| `stock-transfers-create` | Membuat dokumen transfer stok |
| `stock-transfers-send` | Menjalankan pengiriman transfer stok |
| `stock-transfers-receive` | Mengonfirmasi penerimaan transfer di cabang tujuan |
| `stock-transfers-cancel` | Membatalkan transfer barang |

## Standar Operasional (SOP Multi-Cabang)

1. **Setup Cabang**: Daftarkan cabang baru di `Settings > Gudang / Cabang`, lengkapi alamat dan kontak.
2. **Penugasan Karyawan**: Daftarkan kasir/staf di menu `Pengguna` dan pilih cabang penempatannya. Untuk pemilik/manajer area, kosongkan field cabang agar berstatus HQ.
3. **Distribusi Stok**: Kirim barang dari Gudang Pusat ke Cabang Toko menggunakan menu `Transfer Stok`.
4. **Operasional Kasir**: Kasir membuka shift, melayani pelanggan, dan mencetak struk dengan alamat cabang dinamis.
5. **Monitoring & Audit**: Manajer/Owner memantau omzet konsolidasi atau memilih cabang tertentu di Dashboard & Laporan.
