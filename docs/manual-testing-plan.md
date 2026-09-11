# Master Plan Pengujian Manual & Matriks Uji Kasus (QA Manual Testing Plan & Edge Test Matrix)

Dokumen ini berisi panduan, metodologi, dan matriks pengujian manual komprehensif untuk seluruh modul dan fitur pada sistem **Point of Sales (POS)**. Panduan ini dirancang untuk memastikan kestabilan fungsional, integritas data keuangan, konsistensi stok, keamanan RBAC, dan ketahanan terhadap skenario batas (*edge cases*).

---

## 📑 Daftar Isi
1. [Strategi, Lingkungan & Metodologi Pengujian](#1-strategi-lingkungan--metodologi-pengujian)
2. [Standar Klasifikasi Bug & Severity](#2-standar-klasifikasi-bug--severity)
3. [Modul 1: Autentikasi, RBAC & Keamanan Sistem](#3-modul-1-autentikasi-rbac--keamanan-sistem)
4. [Modul 2: Sesi & Manajemen Shift Kasir (Cashier Shifts)](#4-modul-2-sesi--manajemen-shift-kasir-cashier-shifts)
5. [Modul 3: Transaksi POS, Mobile PWA & Keranjang](#5-modul-3-transaksi-pos-mobile-pwa--keranjang)
6. [Modul 4: Dine-In & Self-Order QR Table System](#6-modul-4-dine-in--self-order-qr-table-system)
7. [Modul 5: Retur Penjualan (Sales Returns)](#7-modul-5-retur-penjualan-sales-returns)
8. [Modul 6: Inventori, Multi-Gudang & Mutasi Stok](#8-modul-6-inventori-multi-gudang--mutasi-stok)
9. [Modul 7: Stock Opname (Penyesuaian Fisik)](#9-modul-7-stock-opname-penyesuaian-fisik)
10. [Modul 8: Rantai Pembelian (Purchasing, GR & Retur Supplier)](#10-modul-8-rantai-pembelian-purchasing-gr--retur-supplier)
11. [Modul 9: Manajemen Keuangan (Hutang & Piutang Usaha)](#11-modul-9-manajemen-keuangan-hutang--piutang-usaha)
12. [Modul 10: Skema Harga, Diskon, Voucher & Loyalty](#12-modul-10-skema-harga-diskon-voucher--loyalty)
13. [Modul 11: CRM, Segmentasi & WhatsApp Gateway](#13-modul-11-crm-segmentasi--whatsapp-gateway)
14. [Modul 12: Laporan Keuangan, BI Insights & Cetak ESC/POS](#14-modul-12-laporan-keuangan-bi-insights--cetak-escpos)
15. [Modul 13: Import/Export & Pengaturan Sistem](#15-modul-13-importexport--pengaturan-sistem)
16. [Modul 14: REST API Sanctum & Payment Webhooks](#16-modul-14-rest-api-sanctum--payment-webhooks)
17. [Modul 15: Skenario Edge Case Ekstrem Lintas Sistem (Cross-Cutting Chaos Testing)](#17-modul-15-skenario-edge-case-ekstrem-lintas-sistem-cross-cutting-chaos-testing)
18. [Checklist Eksekusi & Kriteria Kelulusan Rilis (QA Sign-Off)](#18-checklist-eksekusi--kriteria-kelulusan-rilis-qa-sign-off)

---

## 1. Strategi, Lingkungan & Metodologi Pengujian

### 1.1. Prasyarat Lingkungan Uji (Test Environment)
- **Aplikasi Web**: Jalankan dev server Laravel (`php artisan serve`) dan Vite (`npm run dev`).
- **Layanan WhatsApp**: Jalankan Node service (`cd whatsapp-service && npm start`).
- **Database & Storage**:
  ```bash
  php artisan migrate:fresh --seed
  php artisan storage:link
  ```
- **Kredensial Default**:
  - Administrator: `admin@mail.com` / `password`
  - Kasir: `kasir@mail.com` / `password`

### 1.2. Perangkat & Hardware Pendukung
- Browser Desktop: Chrome / Firefox / Edge (Resolusi 1366x768, 1920x1080).
- Browser Mobile / Tablet: Chrome Android / Safari iOS (Mobile PWA & Dine-In QR scan).
- Barcode Scanner: USB HID Scanner & Bluetooth Handheld Scanner.
- Printer Kasir: Thermal Printer 58mm & 80mm (ESC/POS via USB/Bluetooth/Network).

### 1.3. Panduan Pengisian Status Checklist
Gunakan kolom **Status** pada setiap tabel untuk menandai progres pengujian:
- `[ ]` : **Belum Diuji / Pending** (kondisi awal)
- `[x]` : **Lulus / Passed (✅)**
- `[F]` : **Gagal / Failed (❌)** — *tulis nomor issue/bug jika ada*
- `[B]` : **Tertahan / Blocked (⚠️)** — *fitur/lingkungan belum siap*

---

## 2. Standar Klasifikasi Bug & Severity

| Severity | Definisi Dampak | Toleransi Rilis |
| :--- | :--- | :--- |
| **P0 - Blocker / Critical** | Kerusakan data finansial, selisih stok tanpa log mutasi, bypass autentikasi/step-up, crash total sistem. | **0 Bug (Wajib Fix)** |
| **P1 - Major** | Fitur utama terhenti (gagal checkout pembayaran tertentu, webhook macet, retur salah hitung, sync offline error). | **0 Bug (Wajib Fix)** |
| **P2 - Moderate** | Fitur sekunder bermasalah, layout cetak thermal terpotong, performa pencarian lambat, validasi form lolos minor. | Max 2 (mitigasi terdokumentasi) |
| **P3 - Minor / Cosmetic** | Typo penulisan teks, ketidaksejajaran icon pada resolusi tertentu, animasi UI kurang halus. | Boleh ditunda ke minor patch |

---

## 3. Modul 1: Autentikasi, RBAC & Keamanan Sistem

### 3.1. Login, Registrasi & Proteksi Bot
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-AUTH-01** | Login Berhasil | Input email & password valid (`admin@mail.com` / `password`). | Redirect ke dashboard sesuai permission; sesi aktif terbentuk. | *Positive* |
| [X] | **TC-AUTH-02** | Login Gagal - Password Salah | Input password salah sebanyak 5 kali berturut-turut. | Muncul notifikasi error; trigger rate limiting (throttling) setelah percobaan berlebih. | *Negative* |
| [X] | **TC-AUTH-03** | BotGuard - Honeypot Terisi | Isi field honeypot tersembunyi via script / DOM console lalu submit. | Request diblokir oleh `EnsureBotGuard` (HTTP 422/403) tanpa mengeksekusi auth. | **Edge / Security** |
| [X] | **TC-AUTH-04** | BotGuard - Waktu Submit Terlalu Cepat | Submit form register/login dalam waktu < 300ms setelah halaman render. | Request diblokir karena terdeteksi bot otomasi. | **Edge / Security** |
| [X] | **TC-AUTH-05** | Toggle Registrasi Publik Nonaktif | Atur `public_registration = false`. Akses `/register`. | Halaman return 404 / dialihkan ke login (`EnsurePublicRegistrationEnabled`). | *Negative* |
| [X] | **TC-AUTH-06** | Landing Page Mode Switch | Ubah setting `landing_page_mode` ke `direct_login` vs `landing_page`. Akses `/`. | Jika `direct_login`, otomatis redirect ke `/login`. Jika tidak, tampil Welcome page. | *Boundary* |

### 3.2. Role, Permissions & Step-up Authentication
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-RBAC-01** | Akses Menu Kasir | Login sebagai kasir tanpa permission `users-access`. Akses `/dashboard/users`. | HTTP 403 Forbidden; menu User di sidebar tidak terlihat. | *Negative* |
| [X] | **TC-RBAC-02** | Step-Up Password Trigger | Lakukan aksi sensitif: Update Payment Settings, Hapus User, atau Konfirmasi Bank Transfer. | Muncul modal popup konfirmasi password (`step_up` middleware). | *Positive* |
| [X] | **TC-RBAC-03** | Step-Up Expiry Timeout | Selesaikan step-up auth, diamkan > 15 menit, lalu lakukan aksi sensitif lagi. | Sistem kembali mewajibkan verifikasi password ulang. | **Edge / Security** |
| [X] | **TC-RBAC-04** | Invalidation Cache Permission | Admin mencabut role/permission kasir saat kasir sedang membuka halaman POS. | Aksi berikutnya dari kasir langsung terblokir tanpa perlu restart server. | **Edge Case** |

---

## 4. Modul 2: Sesi & Manajemen Shift Kasir (Cashier Shifts)

| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-SHIFT-01** | Buka Shift (Open Shift) Normal | Buka shift dengan Modal Awal (Starting Cash) = Rp 200.000. | Shift status: `open`; `active_shift` terdeteksi di shared Inertia props. | *Positive* |
| [X] | **TC-SHIFT-02** | Akses POS Tanpa Buka Shift | Kasir mencoba akses `/transactions/addToCart` atau checkout tanpa shift aktif. | Terblokir oleh middleware `active_shift`; diarahkan wajib buka shift terlebih dahulu. | *Negative* |
| [X] | **TC-SHIFT-03** | Buka Shift Ganda di Kasir Sama | User membuka shift kedua saat shift pertama masih berstatus `open`. | Ditolak dengan pesan "Sesi shift kasir masih aktif". | **Edge Case** |
| [X] | **TC-SHIFT-04** | Tutup Shift - Selisih Kas (Discrepancy) | Kas sistem tercatat Rp 1.500.000. Kasir input fisik Rp 1.450.000 (Selisih -Rp 50.000). | Shift tertutup; tercatat `difference = -50000`; flag selisih tersimpan di audit log. | **Edge Case** |
| [X] | **TC-SHIFT-05** | Tutup Shift dengan Pending Hold Cart | Kasir menutup shift saat masih ada keranjang yang di-`hold`. | Sistem memunculkan dialog konfirmasi daftar transaksi tertahan sebelum tutup. | **Edge Case** |
| [X] | **TC-SHIFT-06** | Rekap Multi-Metode Pembayaran | Selesaikan transaksi via Cash, Midtrans, Xendit, QRISly, Transfer, dan Piutang dalam 1 shift. | Ringkasan shift memisahkan total per metode secara presisi (tanpa selisih 1 rupiah). | *Integrity* |

---

## 5. Modul 3: Transaksi POS, Mobile PWA & Keranjang

### 5.1. Keranjang, Barcode & Multi-Satuan
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-POS-01** | Scan Barcode & Text Lookup | Scan barcode via scanner fisik dan pencarian teks nama/SKU. | Produk masuk ke keranjang dalam < 300ms dengan harga & stok real-time. | *Positive* |
| [X] | **TC-POS-02** | Konversi Satuan (Unit Conversion) | Tambah produk satuan "Box" (faktor konversi = 24 Pcs) sebanyak 2 Box. | Subtotal = 2 × Harga Box; saat checkout, stok master terpotong 48 Pcs. | *Positive* |
| [X] | **TC-POS-03** | Pembelian Melebihi Stok Tersedia | Tambah qty = 10 untuk produk dengan sisa stok = 5 (tanpa izin minus stock). | Ditolak dengan notifikasi "Stok tidak mencukupi". | *Negative* |
| [X] | **TC-POS-04** | Produk Kit / Bundling (Komposit) | Jual 1 Paket Hemat (berisi 1 Pcs Item A, 2 Pcs Item B). | Stok Paket terjual 1; stok Item A terpotong 1, stok Item B terpotong 2. | *Positive* |
| [X] | **TC-POS-05** | Produk Kit dengan Komponen Kosong | Jual Paket Hemat saat salah satu komponennya memiliki stok = 0. | Checkout diblokir dengan rincian komponen yang habis. | **Edge Case** |
| [ ] | **TC-POS-06** | Pemilihan Batch / Expiry (FEFO) | Jual produk obat ber-batch; pilih batch yang mendekati kadaluarsa. | Stok batch terpilih berkurang; tanggal kadaluarsa tercetak di struk jika diaktifkan. | *Positive* |

### 5.2. Diskon, Promo, Voucher & Approval
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-POS-07** | Pricing Rules - Grosir Bertingkat | Beli 1-9 @ Rp 10.000, Beli ≥ 10 @ Rp 8.500. Masukkan 12 item. | Otomatis berubah menjadi @ Rp 8.500; total = Rp 102.000. | *Positive* |
| [X] | **TC-POS-08** | Pricing Rules - Buy X Get Y | Beli 2 Kopi gratis 1 Donat. Masukkan 2 Kopi ke keranjang. | Promo otomatis terpicu; item Donat diskon 100% atau auto-add ke cart. | *Positive* |
| [X] | **TC-POS-09** | Voucher Pelanggan - Kuota Habis | Gunakan kode voucher dengan kuota = 0 atau sudah kadaluarsa. | Muncul notifikasi error "Voucher tidak valid / kuota habis". | *Negative* |
| [X] | **TC-POS-10** | Stacking Diskon Ekstrem | Terapkan: Diskon Produk (10%) + Diskon Member (5%) + Voucher (Rp 20.000). | Perhitungan matematis urut; Grand Total tidak boleh bernilai negatif (< 0). | **Boundary / Edge** |
| [X] | **TC-POS-11** | Discount Approval Threshold | Kasir input manual diskon 30% (di atas threshold kasir 15%). | Transaksi masuk status `pending_approval`; menunggu approval di `/discount-approvals`. | *Security* |
| [X] | **TC-POS-12** | Reject Discount Approval | Manajer me-reject permohonan diskon kasir. | Transaksi kembali ke keranjang kasir dengan diskon dibatalkan. | *Negative* |

### 5.3. Hold & Resume Cart
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-POS-13** | Multi-Hold Cart | Hold 5 transaksi berbeda dengan catatan nama customer berbeda. | Seluruh 5 transaksi tersimpan di daftar "Held Transactions" tanpa data tertukar. | *Positive* |
| [X] | **TC-POS-14** | Resume Cart & Modifikasi | Resume Hold Cart #3, tambah 1 item baru, lalu selesaikan pembayaran. | Transaksi selesai dengan benar; Hold Cart #3 terhapus dari daftar held. | *Positive* |
| [ ] | **TC-POS-15** | Perubahan Harga Saat Hold | Hold cart saat harga produk Rp 10.000. Admin ubah harga jadi Rp 15.000. Resume cart. | Sistem memvalidasi harga terbaru atau mengonfirmasi perbedaan harga ke kasir. | **Edge Case** |

### 5.4. Metode Pembayaran & Penyelesaian (Checkout)
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-POS-16** | Pembayaran Tunai & Kembalian | Total Rp 137.500, Bayar Rp 150.000. | Kembalian Rp 12.500; cash drawer terbuka; stok terpotong. | *Positive* |
| [X] | **TC-POS-17** | Tunai Kurang | Total Rp 50.000, Bayar Rp 40.000. | Tombol Bayar disabled / error "Nominal pembayaran kurang". | *Negative* |
| [⚠️] | **TC-POS-18** | Split Payment (Tunai + Transfer/QRIS) | Total Rp 500.000. Bayar Tunai Rp 200.000 + QRIS Rp 300.000. | Transaksi mencatat 2 split payment records; total lunas Rp 500.000. | *Positive* |
| [X] | **TC-POS-19** | Pembayaran Piutang (Tempo) | Pelanggan Member checkout dengan metode Tempo / Piutang. | Faktur terbit; otomatis masuk ke modul **Receivables** dengan status *Unpaid*. | *Positive* |
| [⚠️] | **TC-POS-20** | Piutang Melebihi Credit Limit | Pelanggan memiliki sisa limit kredit Rp 200.000, transaksi Rp 500.000. | Sistem memblokir transaksi piutang dengan notifikasi "Melebihi limit kredit". | **Boundary / Edge** |
| [X] | **TC-POS-21** | Integrasi Dynamic QRIS (QRISly / Midtrans) | Kasir pilih bayar QRIS. Sistem memanggil gateway untuk render dynamic QR. | QR muncul di layar; webhook gateway otomatis mengubah status jadi *Paid*. | *Positive* |
| [X] | **TC-POS-22** | QRIS Expired / Timeout | Customer tidak scan QR hingga batas waktu (misal 5 menit). | Status transaksi pending/expire; kasir bisa menekan tombol `qrisly-retry`. | **Edge Case** |
| [X] | **TC-POS-23** | Double Click Checkout (Race Condition) | Klik tombol "Bayar" 5 kali berturut-turut secara cepat (< 100ms). | Hanya 1 transaksi terbentuk; invoice tidak ganda; stok tidak terpotong dobel. | **Race Condition** |

---

## 6. Modul 4: Dine-In & Self-Order QR Table System

| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-DINE-01** | Floor Plan Editor Drag-and-Drop | Atur posisi Meja M1 ke koordinat grid X:5, Y:8 pada SVG Floor Plan. | Koordinat tersimpan di DB; tampilan denah sinkron saat reload. | *Positive* |
| [ ] | **TC-DINE-02** | Scan QR Meja Publik | Buka URL `/dine/{token_meja_1}` dari browser HP (tanpa login). | Halaman menu restoran terbuka dengan identitas "Meja M1". | *Positive* |
| [ ] | **TC-DINE-03** | Scan QR Meja Tidak Aktif / Token Salah | Buka URL `/dine/invalid-uuid-token`. | Muncul pesan error 404 / "Meja tidak ditemukan atau tidak aktif". | *Negative* |
| [ ] | **TC-DINE-04** | Self-Order Submission (Bayar di Kasir) | Pelanggan pilih 2 Nasi Goreng + Catatan "Pedas", pilih bayar di kasir, submit. | Pesanan berstatus `submitted`; muncul notifikasi pesanan baru di dashboard kasir. | *Positive* |
| [ ] | **TC-DINE-05** | Polling Status Pesanan Pelanggan | Buka halaman `/dine-order/{accessToken}` saat kasir menerima pesanan. | Polling setiap 5 detik mengupdate UI dari "Menunggu" menjadi "Diterima" tanpa reload. | *Positive* |
| [X] | **TC-DINE-06** | Kasir Terima (Accept) Pesanan Dine-In | Kasir klik "Terima Pesanan". | Status order menjadi `accepted`; stok bahan/produk **langsung terpotong**. | *Integrity* |
| [ ] | **TC-DINE-07** | Kasir Tolak (Reject) Pesanan Dine-In | Kasir klik "Tolak" dengan alasan "Bahan habis". | Status order menjadi `rejected`; stok **tidak terpotong**; status di HP user berubah ditolak. | *Negative* |
| [ ] | **TC-DINE-08** | Pesanan Serentak di Meja Sama | 2 pelanggan di meja yang sama submit pesanan berbeda bersamaan. | Kedua pesanan masuk terpisah dengan nomor order unik pada meja tersebut. | **Concurrency** |
| [ ] | **TC-DINE-09** | Self-Order Saat Dine-In Dimatikan | Akses `/dine/{token}` saat setting `dine_in_enabled = false`. | Menu ditutup dengan pesan "Layanan Dine-In sedang nonaktif". | *Negative* |

---

## 7. Modul 5: Retur Penjualan (Sales Returns)

| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-RET-01** | Retur Sebagian (Kondisi Bagus) | Faktur beli 5 Pcs @ Rp 20.000. Retur 2 Pcs karena salah beli. Barang bagus. | Pengembalian uang Rp 40.000; Stok barang di gudang bertambah +2 Pcs. | *Positive* |
| [X] | **TC-RET-02** | Retur Barang Rusak (Damaged Stock) | Retur 1 Pcs barang rusak/cacat. Pilih kondisi "Damaged/Quarantine". | Uang dikembalikan; stok utama **tidak bertambah**; mutasi masuk ke stok karantina. | **Edge Case** |
| [X] | **TC-RET-03** | Retur Melebihi Jumlah Pembelian | Faktur beli 3 Pcs. Kasir mencoba input retur 4 Pcs. | Ditolak dengan validasi "Jumlah retur melebihi jumlah pembelian". | **Boundary / Negative** |
| [X] | **TC-RET-04** | Retur Transaksi yang Sudah Diretur | Faktur beli 3 Pcs. Retur #1 sudah mengembalikan 2 Pcs. Coba retur lagi 2 Pcs. | Sistem hanya mengizinkan maksimal 1 Pcs lagi untuk diretur. | **Edge Case** |
| [X] | **TC-RET-05** | Retur Transaksi Piutang (Kredit) | Transaksi tempo (belum lunas) diretur sebagian. | Sisa tagihan piutang pelanggan otomatis berkurang sesuai nilai retur. | *Integrity* |
| [X] | **TC-RET-06** | Cetak Bukti Nota Retur | Klik cetak nota retur di printer thermal 58mm/80mm. | Struk retur tercetak jelas memuat nomor retur, referensi invoice asli, dan alasan. | *Positive* |

---

## 8. Modul 6: Inventori, Multi-Gudang & Mutasi Stok

### 8.1. Master Gudang/Cabang, Jam Operasional & Proteksi Integritas
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-WH-01** | Daftarkan Cabang Baru & Konfigurasi Jam Kerja | Masuk ke `Settings > Gudang / Cabang`, klik Tambah. Input kode `CABANG-BDO`, nama "Cabang Bandung", tipe `branch`, jam operasional 08:00 - 22:00, pilih hari Senin-Minggu, aktifkan toggle Delivery & Pickup katalog. | Cabang baru tersimpan; seluruh produk otomatis disinkronkan ke pivot `product_warehouse` dengan saldo `0`. | *Positive* |
| [X] | **TC-WH-02** | Penutupan Sementara Cabang (*Temporary Closure*) | Edit cabang, aktifkan `is_temporarily_closed = true`, isi alasan "Renovasi Toko" dan tanggal buka kembali H+7. | Status tersimpan; portal katalog publik (`/menu`) menampilkan badge "Toko Tutup Sementara: Renovasi Toko" dan memblokir order baru. | *Positive* |
| [X] | **TC-WH-03** | Proteksi Hapus Cabang dengan Riwayat Historis | Coba hapus cabang yang pernah digunakan untuk transaksi penjualan, shift kasir, PO, atau mutasi stok (`hasHistoricalRelations`). | Tombol hapus dicegah / request dibatalkan dengan error "Gudang tidak dapat dihapus karena memiliki riwayat transaksi, pergeseran kasir, atau mutasi stok." | **Security / Integrity** |
| [X] | **TC-WH-04** | Hapus Cabang Kosong Tanpa Riwayat | Buat cabang baru pengujian, pastikan belum ada transaksi/stok (`totalStock = 0` dan tidak ada relasi). Klik hapus. | Cabang berhasil dihapus secara soft-delete. Gudang tipe `main` tetap diproteksi dan tidak bisa dihapus sama sekali. | *Positive* |

### 8.2. Isolasi Peran & Akses Cabang (Branch Hard-Isolation)
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-WH-05** | Isolasi Dashboard Staf Cabang | Login sebagai kasir cabang (`kasir@mail.com` / `password`, assigned ke Cabang 1). Buka Dashboard. | Metrik KPI (Omzet, Transaksi, Laba, Tren) otomatis terisolasi hanya untuk Cabang 1; header menampilkan badge terkunci nama cabang; dropdown switcher cabang disembunyikan. | *Security* |
| [X] | **TC-WH-06** | Dashboard Konsolidasi Super Admin (HQ) | Login sebagai Super Admin (`admin@mail.com`). Buka Dashboard. | Header menampilkan dropdown switcher "Semua Cabang (Konsolidasi)"; saat memilih cabang tertentu, seluruh metrik KPI berubah seketika sesuai cabang terpilih. | *Positive* |
| [X] | **TC-WH-07** | Buka Shift Kasir Terkunci ke Cabang | Kasir Cabang 1 mencoba membuka shift kasir di Cabang 2 via form injection / manipulasi request `warehouse_id`. | Validasi `StoreCashierShiftRequest` menolak dengan error "Kasir hanya dapat membuka shift di cabang penempatannya." | *Security* |
| [X] | **TC-WH-08** | Isolasi Stok POS Kasir | Kasir Cabang 1 membuka halaman kasir `/transactions`. | Hanya produk yang memiliki saldo fisik > 0 pada cabang kasir (`product_warehouse.stock > 0`) yang muncul di grid POS. Kasir dapat melihat informasi stok cabang lain untuk edukasi pelanggan. | *Integrity* |
| [X] | **TC-WH-09** | POS Quick Store Menautkan Stok ke Cabang Kasir | Kasir Cabang 1 menambah produk cepat via modal Quick Store di POS dengan stok awal 20 unit. | Stok awal 20 unit otomatis dialokasikan ke cabang kasir aktif (`Cabang 1`), gudang lain tersinkronisasi 0, dan mutasi awal mencatat `warehouse_id` Cabang 1. | *Integrity* |
| [X] | **TC-WH-10** | Indeks Katalog Produk Scoped ke Cabang | Staf cabang membuka menu `Produk` (`/products`). | Kolom "Stok" otomatis menampilkan stok fisik di cabangnya; badge filter cabang terkunci tanpa bisa melihat total stok gabungan jika tidak memiliki izin HQ. | *Positive* |
| [X] | **TC-WH-11** | Dynamic Receipt Header (Thermal & PDF) | Kasir Cabang 1 menyelesaikan transaksi dan mencetak struk thermal serta PDF invoice. | Header struk otomatis memuat Nama Cabang, Alamat Cabang, dan No. Telepon Cabang kasir bertugas. Jika alamat cabang belum diisi, sistem otomatis fallback rapi ke `StoreProfile`. | *Positive* |

### 8.3. Transfer Stok Antar Gudang & Multi-UOM
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-WH-12** | Buat Dokumen Transfer Stok (Draft) | Buat transfer 50 Pcs dari Gudang Pusat ke Cabang 1. Status: `Draft`. | Belum ada stok fisik yang berpindah; dokumen tersimpan dengan status `draft`. | *Positive* |
| [X] | **TC-WH-13** | Kirim Barang (Send Transfer) & Mutasi Keluar | Klik "Kirim" pada transfer draft. | Status berubah menjadi `in_transit`; saldo fisik Gudang Pusat terpotong -50 Pcs; mutasi keluar (`out`) tercatat spesifik untuk Gudang Pusat; stok Cabang 1 belum bertambah. | *Integrity* |
| [X] | **TC-WH-14** | Terima Sebagian & Selisih Rusak/Hilang | Cabang 1 melakukan konfirmasi penerimaan barang, tetapi hanya menerima 45 Pcs (5 Pcs rusak di jalan). Beri catatan "5 Pcs rusak". | Stok fisik Cabang 1 bertambah +45 Pcs; status transfer: `completed`; selisih 5 Pcs tercatat transparan di mutasi stok dan audit log penerimaan. | **Edge Case** |
| [X] | **TC-WH-15** | Batalkan Transfer yang Sedang In-Transit | Admin membatalkan transfer yang berstatus `in_transit` karena pembatalan armada pengiriman. | Status berubah menjadi `cancelled`; seluruh barang otomatis dikembalikan ke saldo fisik gudang asal dengan mutasi pemulihan (`in`). | *Integrity* |
| [X] | **TC-WH-16** | Transfer Stok Multi-Satuan (Multi-UOM) | Kirim 2 Karton (faktor konversi = 24 Pcs) dari Pusat ke Cabang. | Gudang asal terpotong 48 Pcs; saat diterima penuh di cabang tujuan, stok dasar bertambah +48 Pcs dengan catatan satuan Karton pada histori mutasi. | *Positive* |
| [X] | **TC-WH-17** | Otorisasi Akses Transfer Staf Cabang | Staf Cabang 1 mencoba mengakses atau memanipulasi dokumen transfer antara Gudang Pusat dan Cabang 2 via direct URL. | Sistem memblokir request dengan HTTP 403 "Anda tidak memiliki akses ke transfer stok cabang ini." | *Security* |

### 8.4. Log Mutasi Stok (Stock Mutation Audit Trail)
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-MUT-01** | Verifikasi Rantai Mutasi Lengkap Per Cabang | Eksekusi urutan: Penerimaan PO di Cabang (+100) -> Penjualan POS di Cabang (-20) -> Retur Penjualan (+2) -> Transfer keluar (-10). | Log mutasi di `/stock-mutations` mencatat semua urutan secara kronologis dengan saldo awal & akhir presisi merefleksikan kartu stok fisik cabang tersebut. | *Integrity* |
| [X] | **TC-MUT-02** | Filter Log Mutasi per Gudang & Tipe | Filter mutasi berdasarkan Gudang, Produk, Tanggal, dan Tipe mutasi (`in` / `out`). | Tabel menampilkan data mutasi spesifik gudang terpilih tanpa record hantu (*ghost records*). Staf cabang terkunci hanya melihat mutasi cabangnya. | *Positive* |

---

## 9. Modul 7: Stock Opname (Penyesuaian Fisik)

| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-OPN-01** | Buka Sesi Stock Opname | Buat opname untuk Gudang Utama & Kategori "Minuman". Klik `Populate Items`. | Daftar seluruh produk minuman beserta stok sistem saat itu ter-load ke tabel. | *Positive* |
| [X] | **TC-OPN-02** | Input Hitungan Fisik (Selisih +/-) | Produk A: Sistem 10, Fisik 8 (Selisih -2). Produk B: Sistem 5, Fisik 7 (Selisih +2). | Sistem otomatis menghitung selisih unit dan selisih nominal (Rp). | *Positive* |
| [X] | **TC-OPN-03** | Finalisasi Opname (Finalize) | Klik Finalisasi Opname dengan permission `stock-opnames-finalize`. | Sesi terkunci (`finalized`); stok master diubah menjadi 8 dan 7; terbit mutasi tipe `Opname Adjustment`. | *Integrity* |
| [ ] | **TC-OPN-04** | Transaksi Terjadi Saat Opname Berlangsung | Ada penjualan POS saat sesi opname belum di-finalize. | Sistem mencatat snapshot waktu perhitungan fisik atau memberi konfirmasi rekonsiliasi. | **Edge Case** |
| [X] | **TC-OPN-05** | Edit Opname yang Sudah Final | Coba update item atau populate ulang pada opname yang sudah `finalized`. | Request diblokir (403/422); data historis terkunci permanen. | *Security* |

---

## 10. Modul 8: Rantai Pembelian (Purchasing, GR & Retur Supplier)

### 10.1. Purchase Order (PO) & Multi-UOM
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-PUR-01** | Buat & Terbitkan Purchase Order Multi-UOM | Buat PO ke Supplier PT ABC untuk 10 Karton (faktor konversi = 24 Pcs) @ Rp 240.000/Karton + PPN 11%, pilih Gudang Tujuan "Cabang 1". Klik "Place Order". | Status PO: `ordered`; nomor dokumen otomatis berformat cabang `PO-[BRANCH]-YYYYMMDD-XXXX`; stok belum bertambah. | *Positive* |
| [X] | **TC-PUR-02** | Saran Kuantitas Restock (*Suggested Order Qty*) | Buka form PO, pilih produk dengan `min_stock = 20`, `max_stock = 100`, dan stok fisik cabang saat ini = 30 Pcs. | Sistem otomatis menghitung dan mengisi saran pemesanan = 70 Pcs (mengurangi kuantitas PO yang masih in-transit jika ada). | *Positive* |
| [X] | **TC-PUR-03** | Lifecycle Status PO (Draft -> Ordered -> Cancel) | Buat PO draft, klik Place Order (status `ordered`), lalu uji tombol Cancel PO pada PO yang belum diterima. | PO berubah status menjadi `cancelled`; tidak dapat dibuatkan penerimaan barang (GR). | *Integrity* |
| [X] | **TC-PUR-04** | Cetak Struk, Ekspor PDF A4 & Share Link Publik | Buka detail PO. Uji tombol Cetak Struk, Unduh PDF A4, dan buka tautan publik `/share/purchase-orders/{docNumber}` via browser incognito. | Dokumen PO tampil resmi tanpa perlu login dashboard; nomor dokumen dan rincian item presisi. | *Positive* |
| [X] | **TC-PUR-05** | Isolasi PO Staf Cabang | Login sebagai staf Cabang 1. Akses `/purchase-orders`. Coba akses detail PO Cabang 2 via direct URL. | Daftar PO hanya menampilkan PO Cabang 1; akses direct ke PO cabang lain ditolak dengan HTTP 403 Forbidden. | *Security* |

### 10.2. Goods Receiving (GR), Batch Tracking & Moving Average Costing
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-PUR-06** | Penerimaan Barang Bertahap (Partial GR) | PO pesan 10 Karton (240 Pcs). Supplier kirim 4 Karton pertama. Buat Goods Receiving. | Stok gudang tujuan bertambah +96 Pcs; status PO berubah menjadi `partially_received`; sisa PO tersisa 6 Karton (144 Pcs). | *Positive* |
| [X] | **TC-PUR-07** | Batch Tracking & Tanggal Kadaluarsa | Pada form GR, isi `batch_number: BATCH-2026-X1` dan `expired_at: H+365`. Simpan GR. | Data batch tersimpan di `goods_receiving_items`; stok batch otomatis terbentuk di tabel `product_batches` untuk gudang tujuan; mutasi stok mencatat referensi batch. | *Integrity* |
| [X] | **TC-PUR-08** | Penerimaan Barang Multi-Satuan (Multi-UOM GR) | PO dalam satuan Box. Input penerimaan barang dalam satuan Pcs atau Box dengan faktor konversi valid. | Sistem mengonversi kuantitas ke satuan dasar (*base unit*) secara presisi sebelum menambah saldo fisik gudang. | *Positive* |
| [X] | **TC-PUR-09** | Proteksi Over-Receiving & Row Locking | Staff mencoba input penerimaan 8 Karton pada sisa PO yang hanya 6 Karton. | Sistem menolak transaksi dengan pesan validasi "Kuantitas diterima melebihi sisa pesanan PO." Transaksi terkunci aman via `lockForUpdate`. | **Boundary / Edge** |
| [X] | **TC-PUR-10** | Kalkulasi Biaya Rata-Rata Bergerak (*Perpetual Moving Average*) | Produk memiliki stok lama 50 Pcs @ Rp 10.000. Terima GR 50 Pcs @ Rp 12.000. | Nilai HPP master produk (`products.buy_price`) otomatis terhitung ulang secara tertimbang menjadi Rp 11.000. | *Integrity* |
| [X] | **TC-PUR-11** | Otomatisasi Terbit Hutang (*Payables*) Cabang | Simpan GR senilai Rp 2.400.000. Buka menu `Hutang Supplier`. | Invoice hutang baru otomatis terbit dengan nomor `PAY-[BRANCH]-...`, mewarisi `warehouse_id` cabang tujuan, dan jatuh tempo default 30 hari. | *Integrity* |
| [X] | **TC-PUR-12** | Saldo Kartu Mutasi Masuk Spesifik Cabang | Buka riwayat mutasi stok di `/stock-mutations` untuk transaksi GR di atas. | Kolom `stock_before` dan `stock_after` merefleksikan saldo fisik gudang cabang penerima (bukan agregat global toko). | *Integrity* |

### 10.3. Retur Pembelian ke Supplier (Supplier Returns / SR)
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-SUPRET-01** | Retur Supplier Berdasarkan Referensi GR | Buka menu Retur Supplier, klik Tambah, pilih dokumen rujukan GR. | Form otomatis mengisi data Supplier, Gudang Tujuan, dan dokumen Hutang (`payable_id`) terkait. | *Positive* |
| [X] | **TC-SUPRET-02** | Retur Multi-Satuan & Pemotongan Stok Batch | Retur 1 Karton (24 Pcs) dengan memilih nomor batch `BATCH-2026-X1`. Selesaikan retur (Complete). | Stok fisik cabang terpotong -24 Pcs; stok batch `BATCH-2026-X1` berkurang 24; mutasi keluar tipe `supplier_return` tercatat. | *Integrity* |
| [X] | **TC-SUPRET-03** | Otomatisasi Koreksi Saldo Hutang Supplier | Cek invoice hutang pada menu `Hutang Supplier` yang terhubung dengan GR tersebut. | Nilai total hutang berkurang secara otomatis dan proporsional senilai retur yang diselesaikan. | *Integrity* |
| [X] | **TC-SUPRET-04** | Retur Melebihi Saldo Stok Fisik Cabang | Coba retur 10 Karton padahal sisa stok fisik di cabang tersebut hanya 2 Karton (sebagian sudah terjual di POS). | Sistem memblokir retur dengan notifikasi "Stok fisik di gudang tidak mencukupi untuk melakukan retur." | **Edge Case** |
| [X] | **TC-SUPRET-05** | Isolasi Retur Supplier Staf Cabang | Staf Cabang 1 mencoba mengakses atau menyelesaikan dokumen retur milik Cabang 2 via direct route. | Akses ditolak dengan HTTP 403 Forbidden. | *Security* |

---

## 11. Modul 9: Manajemen Keuangan (Hutang & Piutang Usaha)

### 11.1. Piutang Usaha (Receivables / Nota Barang)
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-REC-01** | Catat Pembayaran Cicilan Piutang | Customer berhutang Rp 1.000.000. Bayar cicilan #1 Rp 400.000. | Saldo piutang tersisa Rp 600.000; status tetap `partial`; kas masuk bertambah. | *Positive* |
| [X] | **TC-REC-02** | Pelunasan Piutang | Bayar sisa cicilan #2 Rp 600.000. | Saldo piutang Rp 0; status berubah menjadi `paid`. | *Positive* |
| [X] | **TC-REC-03** | Pembayaran Melebihi Sisa Piutang | Input pembayaran Rp 700.000 pada sisa piutang Rp 600.000. | Ditolak dengan validasi "Nominal bayar tidak boleh melebihi sisa tagihan". | **Boundary** |
| [X] | **TC-REC-04** | Analisis Umur Piutang (Aging Buckets) | Cek halaman `/receivables/aging` untuk faktur umur 15 hari, 40 hari, 75 hari, dan 120 hari. | Tampil akurat di bucket 0-30 Hari, 31-60 Hari, 61-90 Hari, dan >90 Hari. | *Positive* |
| [ ] | **TC-REC-05** | Customer Portal Self-Payment | Customer buka invoice di portal `/portal/transactions/{invoice}`, bayar via QRIS/Snap. | Setelah webhook sukses, approval payment tercatat dan saldo piutang terupdate. | *Integration* |
| [X] | **TC-REC-06** | Approval Pembayaran Piutang Transfer | Kasir input konfirmasi transfer dengan slip. Admin klik `Reject` di `/receivables/payments/{id}/reject`. | Pembayaran dibatalkan; saldo piutang kembali ke nilai sebelum submit slip. | *Negative* |

### 11.2. Hutang Usaha (Payables ke Supplier)
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-PAY-01** | Bayar Hutang Supplier dari Rekening | Bayar hutang supplier Rp 5.000.000 menggunakan Rekening Bank BCA. | Saldo hutang berkurang; histori pembayaran bank account terkait tercatat. | *Positive* |
| [X] | **TC-PAY-02** | Hapus Riwayat Pembayaran Hutang (Rollback) | Hapus salah satu cicilan hutang yang salah input. | Saldo hutang supplier otomatis kembali bertambah (*reversal*). | **Integrity** |
| [X] | **TC-PAY-03** | Cetak Rekening Koran Supplier (Supplier Statement) | Generate PDF Rekening Koran Supplier untuk periode 3 bulan terakhir. | Tampil mutasi hutang, pembayaran, dan retur supplier dengan saldo berjalan akurat. | *Positive* |

---

## 12. Modul 10: Skema Harga, Diskon, Voucher & Loyalty

| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-LOY-01** | Akumulasi Poin Member per Transaksi | Setting: Belanja Rp 10.000 dapat 1 Poin. Member belanja Rp 105.000. | Member memperoleh 10 Poin baru; saldo poin terakumulasi di akun member. | *Positive* |
| [X] | **TC-LOY-02** | Naik Tier Otomatis (Bronze -> Silver -> Gold) | Akumulasi belanja member mencapai batas threshold Tier Gold (misal Rp 10.000.000). | Tier member otomatis naik ke Gold; multiplier poin berubah sesuai aturan Tier Gold. | *Positive* |
| [X] | **TC-LOY-03** | Redeem Poin Jadi Diskon di Kasir | Kasir redeem 50 Poin (Nilai 1 Poin = Rp 1.000 -> Diskon Rp 50.000). | Grand total berkurang Rp 50.000; saldo poin member berkurang 50. | *Positive* |
| [X] | **TC-LOY-04** | Redeem Poin Melebihi Saldo Poin | Member hanya punya 30 Poin, coba redeem 50 Poin. | Ditolak dengan notifikasi "Saldo poin tidak mencukupi". | *Negative* |
| [X] | **TC-PRICELIST-01**| Multi-Price List (Daftar Harga Khusus) | Hubungkan Customer A ke Price List "Reseller". Tambahkan produk ke cart di POS. | Harga produk otomatis menggunakan tarif "Reseller", bukan tarif retail umum. | *Positive* |
| [X] | **TC-PRICELIST-02**| Bulk Update Harga Price List | Upload CSV perubahan harga untuk 500 SKU pada Price List Reseller. | Semua harga terupdate dalam satu transaksi database atomic; tidak ada data parsial. | *Performance* |

---

## 13. Modul 11: CRM, Segmentasi & WhatsApp Gateway

| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-CRM-01** | Segmentasi Otomatis (RFM Rules) | Buat segment: Pelanggan tidak belanja > 30 hari. Klik sync/recalculate. | Semua pelanggan yang sesuai kriteria otomatis masuk ke daftar member segmen. | *Positive* |
| [X] | **TC-CRM-02** | Template Broadcast Pesan Dinamis | Buat template: `Halo {customer_name}, Anda punya {loyalty_points} poin di {store_name}`. | Saat dikirim, placeholder variabel ter-replace dengan data riil pelanggan. | *Positive* |
| [X] | **TC-WA-01** | Pairing QR WhatsApp Gateway | Buka Settings > WhatsApp, klik Start, scan QR code via aplikasi WhatsApp HP. | Status berubah menjadi `Connected`; nomor HP gateway & status koneksi tampil. | *Integration* |
| [X] | **TC-WA-02** | Kirim Struk Transaksi Otomatis via WA | Selesaikan transaksi customer dengan nomor WA terdaftar. Klik Share WhatsApp. | Pesan struk + link PDF invoice terkirim ke nomor WA customer dalam hitungan detik. | *Integration* |
| [X] | **TC-WA-03** | Penanganan Layanan WA Down / Disconnect | Layanan Node.js WA service mati (port 3001 down). Lakukan transaksi di kasir. | Kasir tetap bisa checkout tanpa blocking/crash (graceful degradation; log error di backend). | **Resilience / Edge** |
| [X] | **TC-WA-04** | Nomor HP Tidak Valid (Karakter Aneh) | Kirim broadcast ke nomor `0812-abc-!@#` atau nomor tanpa format internasional `+62`. | Sistem melakukan sanitasi format otomatis menjadi `62812...` atau mencatat log `Skipped`. | **Boundary** |
| [X] | **TC-WA-05** | Pengingat Otomatis Piutang (Auto-Reminder WA) | Aktifkan Auto-Reminder di Settings > WA. Buat piutang H-3. Jalankan scheduler `php artisan crm:generate-reminders`. | Pesan WA pengingat tagihan piutang otomatis terbuat di campaign log & terkirim ke nomor WA customer. | *Integration* |

---

## 14. Modul 12: Laporan Keuangan, BI Insights & Cetak ESC/POS

### 14.1. Laporan Finansial & Margin
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-REP-01** | Laporan Penjualan (Sales Report) Filter | Filter laporan per Kasir, Gudang, Metode Bayar, dan Range Tanggal (1 Jan - 31 Jan). | Menampilkan total Omzet Kotor, Diskon, PPN, Omzet Bersih, dan HPP/COGS secara presisi. | *Positive* |
| [X] | **TC-REP-02** | Laporan Laba Rugi (Profit & Loss) | Bandingkan Omzet Bersih dikurangi Total HPP dan Biaya Operasional / Retur. | Angka Laba Kotor dan Laba Bersih sesuai dengan seluruh transaksi yang terekam. | *Integrity* |
| [X] | **TC-REP-03** | Rekonsiliasi Retur di Laporan | Transaksi Rp 100.000 diretur Rp 30.000. Cek laporan penjualan. | Net Sales mencatat Rp 70.000; retur tercatat terpisah sebagai pengurang. | *Integrity* |
| [X] | **TC-REP-04** | Advanced BI Insights & Heatmap Jam Ramai | Buka halaman `/reports/insights`. | Grafik produk terlaris, visualisasi jam sibuk kasir, dan matriks loyalitas tampil responsif. | *Positive* |

### 14.2. Cetak Struk ESC/POS Thermal & PDF
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-PRN-01** | Cetak Struk Thermal 58mm vs 80mm | Cetak transaksi dengan setting lebar kertas 58mm, lalu ganti ke 80mm. | Layout teks, tabel item, dan grand total otomatis menyesuaikan (*text wrap* rapi). | *Hardware* |
| [ ] | **TC-PRN-02** | Buka Laci Kas Otomatis (Cash Drawer Kick) | Cetak struk tunai dengan opsi `open_cash_drawer = true`. | Perintah ESC/POS (`\x1B\x70\x00...`) terkirim dan laci uang fisik otomatis terbuka. | *Hardware* |
| [X] | **TC-PRN-03** | Generate Dokumen PDF Surat Jalan (Shipping) | Buka `/documents/transactions/{invoice}/pdf/shipping`. | PDF Surat Jalan ter-render rapi (alamat pengirim, penerima, qty barang, kolom tanda tangan). | *Positive* |

---

## 15. Modul 13: Import/Export & Pengaturan Sistem

| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-IMP-01** | Download Template Import Excel & CSV | Download template produk di `/import/template/products`. | File spreadsheet valid ter-download dengan header kolom lengkap. | *Positive* |
| [X] | **TC-IMP-02** | Import 1.000 Produk Sekaligus | Upload file Excel berisi 1.000 produk dengan beberapa kategori baru. | Semua produk masuk ke DB; kategori baru auto-create jika belum ada; tidak timeout. | *Performance* |
| [X] | **TC-IMP-03** | Import Data Duplikat / SKU Kembar | Upload file dengan barcode / SKU yang sudah ada di database. | Sistem menampilkan error list baris yang gagal dengan keterangan "SKU sudah digunakan". | **Negative / Edge** |
| [X] | **TC-IMP-04** | Export Data Pelanggan & Transaksi | Export 10.000 transaksi ke format Excel & CSV dengan filter tahun berjalan. | File ter-download sempurna tanpa memori overflow (*chunked streaming export*). | *Positive* |
| [X] | **TC-SET-01** | Update Pengaturan Pajak (PPN Dinamis) | Ubah tarif PPN dari 11% menjadi 12% dan toggle "Harga Termasuk Pajak (Inclusive)". | Transaksi POS baru langsung menghitung PPN 12% sesuai mode inklusif/eksklusif. | *Positive* |
| [X] | **TC-SET-02** | Ganti Bahasa (Localization ID / EN) | Ubah bahasa di dropdown header dari Bahasa Indonesia ke English. | Seluruh label navigasi, tombol, dan pesan validasi beralih ke Bahasa Inggris. | *Positive* |

---

## 16. Modul 14: REST API Sanctum & Payment Webhooks

| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-API-01** | Login API Mobile Kasir via Sanctum | POST `/api/v1/auth/login` dengan kredensial kasir. | Return HTTP 200 dengan `bearer_token` dan object user permissions. | *Positive* |
| [X] | **TC-API-02** | Akses Endpoint Master Data Tanpa Token | GET `/api/v1/products` tanpa header `Authorization`. | Return HTTP 401 Unauthorized (`Unauthenticated.`). | *Security* |
| [X] | **TC-API-03** | Webhook Midtrans - Valid Signature | POST `/webhooks/midtrans` dengan status `settlement` & signature key valid. | Return 200 OK; status transaksi POS terkait otomatis berubah menjadi `Paid`. | *Integration* |
| [X] | **TC-API-04** | Webhook Midtrans - Fake Signature Key | POST `/webhooks/midtrans` dengan signature key palsu. | Return 403 / 400 Bad Request; status pembayaran tidak berubah. | **Security / Edge** |
| [X] | **TC-API-05** | Webhook Idempotency (Notifikasi Ganda) | Kirim webhook sukses yang sama 3 kali berturut-turut dari gateway. | Sistem hanya memproses 1x; tidak memotong stok ganda atau mencatat pembayaran dobel. | **Race / Edge** |

---

## 17. Modul 15: Skenario Edge Case Ekstrem Lintas Sistem (Cross-Cutting Chaos Testing)

### 17.1. Offline Mode & Sinkronisasi Jaringan
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-CHAOS-01** | Putus Koneksi Saat Checkout (Network Drop Midway) | Buka POS, isi keranjang, matikan koneksi internet, lalu tekan "Bayar". | POS beralih ke IndexedDB Offline Mode, struk offline terbit dengan nomor UUID invoice sementara. | *Offline / Resilience* |
| [X] | **TC-CHAOS-02** | Sinkronisasi Massal Pasca Reconnect | Lakukan 20 transaksi offline. Nyalakan internet kembali. Klik "Sync Offline Transactions" (`/transactions/sync-offline`). | Seluruh 20 transaksi ter-upload, nomor invoice resmi di-assign, stok master di server terpotong, audit log tersinkron tanpa ada duplikasi invoice ID. | *Integrity* |
| [X] | **TC-CHAOS-03** | Konflik Stok Saat Sinkronisasi Offline | Kasir A (offline) menjual 2 unit Barang X (stok awal 2). Kasir B (online) juga menjual 2 unit Barang X. Saat Kasir A online dan melakukan sync. | Sistem mendeteksi konflik stok negatif; mencatat flag warning penyesuaian di dashboard admin tanpa membatalkan transaksi yang sudah terjadi di fisik. | **Edge Case** |

### 17.2. Konkurensi & Race Condition
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-CHAOS-04** | Rebutan Stok Terakhir (Flash Sale Simulation) | Sisa stok Produk Z = 1 Pcs. Kasir 1 dan Kasir 2 menekan tombol "Bayar" secara bersamaan (< 10ms diff). | Database transaction locking (`lockForUpdate`) memastikan hanya 1 kasir yang berhasil; kasir kedua menerima notifikasi "Stok telah habis". | **Race Condition** |
| [X] | **TC-CHAOS-05** | Double Checkout Rapid Clicks | Kasir melakukan spam click tombol "Checkout" sebanyak 10 kali dalam 1 detik. | Frontend mendisable tombol instan; backend memiliki token idempotency sehingga hanya 1 transaksi tersimpan. | **Concurrency** |

### 17.3. Presisi Desimal, Pembulatan Pajak & Keuangan
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-CHAOS-06** | Pembulatan Pajak Nominal Koma (Floating Point Inaccuracy) | Beli 3 item @ Rp 33.333 dengan PPN 11% (Total = Rp 99.999 + PPN Rp 10.999,89). | Pembulatan konsisten (misal *round half up* ke Rp 11.000); total tagihan Rp 110.000 tanpa perbedaan 1 rupiah antara detail item dan grand total. | **Boundary / Math** |
| [X] | **TC-CHAOS-07** | Diskon 100% (Barang Gratis / Tester) | Terapkan diskon manual 100% pada total belanja Rp 250.000. | Grand total = Rp 0; metode bayar otomatis "Free/Complimentary"; stok tetap terpotong; tidak muncul error kembalian negatif. | **Edge Case** |

### 17.4. Manipulasi Input & Keamanan (SQLi, XSS, Special Chars)
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-CHAOS-08** | Input Karakter Khusus & Unicode | Buat nama produk, nama pelanggan, atau catatan pesanan dengan karakter: `' OR '1'='1`, `<script>alert(1)</script>`, emoji `🔥🎉🍕`, dan karakter Mandarin/Arab. | Data tersimpan aman tanpa SQL Error; render di layar dan di PDF/print thermal tidak memicu XSS dan tidak memecah layout. | **Security** |

---

## 18. Checklist Eksekusi & Kriteria Kelulusan Rilis (QA Sign-Off)

### 18.1. Lembar Checksheet Eksekusi
| Modul Pengujian | Total Test Cases | Passed (✅) | Failed (❌) | Blocked (⚠️) | Pass Rate (%) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| 1. Autentikasi & RBAC | 10 | 10 | 0 | 0 | 100% |
| 2. Sesi Kasir & Shift | 6 | 6 | 0 | 0 | 100% |
| 3. Transaksi POS & Cart | 23 | 17 | 0 | 0 | 73.9% |
| 4. Dine-In & QR Table | 9 | 2 | 0 | 0 | 22.2% |
| 5. Retur Penjualan | 6 | 6 | 0 | 0 | 100% |
| 6. Multi-Gudang & Mutasi Stok | 19 | 19 | 0 | 0 | 100% |
| 7. Stock Opname | 5 | 4 | 0 | 0 | 80.0% |
| 8. Rantai Pembelian (PO, GR, Retur) | 17 | 17 | 0 | 0 | 100% |
| 9. Hutang & Piutang | 9 | 6 | 0 | 0 | 66.7% |
| 10. Promo, Diskon & Loyalty | 6 | 5 | 0 | 0 | 83.3% |
| 11. CRM & WhatsApp Gateway | 7 | 6 | 0 | 0 | 85.7% |
| 12. Laporan & Thermal Print | 7 | 5 | 0 | 0 | 71.4% |
| 13. Import/Export & Settings | 6 | 6 | 0 | 0 | 100% |
| 14. REST API & Webhooks | 5 | 5 | 0 | 0 | 100% |
| 15. Chaos & Cross-Cutting Edges | 8 | 8 | 0 | 0 | 100% |
| **TOTAL** | **143** | **122** | **0** | **0** | **85.3%** |

### 18.2. Kriteria Kelulusan Rilis (Sign-Off Criteria)
Aplikasi dinyatakan **siap untuk rilis produksi (Ready for Production)** apabila:
1. **100% Test Case Severity P0 (Critical) & P1 (Major) berstatus PASSED.**
2. **Tidak ada selisih stok (*stock drift*)** antara tabel produk/gudang dan tabel mutasi stok.
3. **Seluruh webhook gateway pembayaran (Midtrans, Xendit, QRISly)** lulus uji idempotency dan verifikasi signature.
4. **Offline synchronization** berhasil merekonsiliasi 100% data tanpa kehilangan data (*zero data loss*).
5. **Cetak thermal 58mm & 80mm** telah diverifikasi pada perangkat printer fisik (ESC/POS).

