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
  - Kasir: `cashier@gmail.com` / `password`

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
| [ ] | **TC-SHIFT-06** | Rekap Multi-Metode Pembayaran | Selesaikan transaksi via Cash, Midtrans, Xendit, QRISly, Transfer, dan Piutang dalam 1 shift. | Ringkasan shift memisahkan total per metode secara presisi (tanpa selisih 1 rupiah). | *Integrity* |

---

## 5. Modul 3: Transaksi POS, Mobile PWA & Keranjang

### 5.1. Keranjang, Barcode & Multi-Satuan
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-POS-01** | Scan Barcode & Text Lookup | Scan barcode via scanner fisik dan pencarian teks nama/SKU. | Produk masuk ke keranjang dalam < 300ms dengan harga & stok real-time. | *Positive* |
| [ ] | **TC-POS-02** | Konversi Satuan (Unit Conversion) | Tambah produk satuan "Box" (faktor konversi = 24 Pcs) sebanyak 2 Box. | Subtotal = 2 × Harga Box; saat checkout, stok master terpotong 48 Pcs. | *Positive* |
| [X] | **TC-POS-03** | Pembelian Melebihi Stok Tersedia | Tambah qty = 10 untuk produk dengan sisa stok = 5 (tanpa izin minus stock). | Ditolak dengan notifikasi "Stok tidak mencukupi". | *Negative* |
| [ ] | **TC-POS-04** | Produk Kit / Bundling (Komposit) | Jual 1 Paket Hemat (berisi 1 Pcs Item A, 2 Pcs Item B). | Stok Paket terjual 1; stok Item A terpotong 1, stok Item B terpotong 2. | *Positive* |
| [ ] | **TC-POS-05** | Produk Kit dengan Komponen Kosong | Jual Paket Hemat saat salah satu komponennya memiliki stok = 0. | Checkout diblokir dengan rincian komponen yang habis. | **Edge Case** |
| [ ] | **TC-POS-06** | Pemilihan Batch / Expiry (FEFO) | Jual produk obat ber-batch; pilih batch yang mendekati kadaluarsa. | Stok batch terpilih berkurang; tanggal kadaluarsa tercetak di struk jika diaktifkan. | *Positive* |

### 5.2. Diskon, Promo, Voucher & Approval
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-POS-07** | Pricing Rules - Grosir Bertingkat | Beli 1-9 @ Rp 10.000, Beli ≥ 10 @ Rp 8.500. Masukkan 12 item. | Otomatis berubah menjadi @ Rp 8.500; total = Rp 102.000. | *Positive* |
| [ ] | **TC-POS-08** | Pricing Rules - Buy X Get Y | Beli 2 Kopi gratis 1 Donat. Masukkan 2 Kopi ke keranjang. | Promo otomatis terpicu; item Donat diskon 100% atau auto-add ke cart. | *Positive* |
| [ ] | **TC-POS-09** | Voucher Pelanggan - Kuota Habis | Gunakan kode voucher dengan kuota = 0 atau sudah kadaluarsa. | Muncul notifikasi error "Voucher tidak valid / kuota habis". | *Negative* |
| [ ] | **TC-POS-10** | Stacking Diskon Ekstrem | Terapkan: Diskon Produk (10%) + Diskon Member (5%) + Voucher (Rp 20.000). | Perhitungan matematis urut; Grand Total tidak boleh bernilai negatif (< 0). | **Boundary / Edge** |
| [ ] | **TC-POS-11** | Discount Approval Threshold | Kasir input manual diskon 30% (di atas threshold kasir 15%). | Transaksi masuk status `pending_approval`; menunggu approval di `/discount-approvals`. | *Security* |
| [ ] | **TC-POS-12** | Reject Discount Approval | Manajer me-reject permohonan diskon kasir. | Transaksi kembali ke keranjang kasir dengan diskon dibatalkan. | *Negative* |

### 5.3. Hold & Resume Cart
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-POS-13** | Multi-Hold Cart | Hold 5 transaksi berbeda dengan catatan nama customer berbeda. | Seluruh 5 transaksi tersimpan di daftar "Held Transactions" tanpa data tertukar. | *Positive* |
| [ ] | **TC-POS-14** | Resume Cart & Modifikasi | Resume Hold Cart #3, tambah 1 item baru, lalu selesaikan pembayaran. | Transaksi selesai dengan benar; Hold Cart #3 terhapus dari daftar held. | *Positive* |
| [ ] | **TC-POS-15** | Perubahan Harga Saat Hold | Hold cart saat harga produk Rp 10.000. Admin ubah harga jadi Rp 15.000. Resume cart. | Sistem memvalidasi harga terbaru atau mengonfirmasi perbedaan harga ke kasir. | **Edge Case** |

### 5.4. Metode Pembayaran & Penyelesaian (Checkout)
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-POS-16** | Pembayaran Tunai & Kembalian | Total Rp 137.500, Bayar Rp 150.000. | Kembalian Rp 12.500; cash drawer terbuka; stok terpotong. | *Positive* |
| [ ] | **TC-POS-17** | Tunai Kurang | Total Rp 50.000, Bayar Rp 40.000. | Tombol Bayar disabled / error "Nominal pembayaran kurang". | *Negative* |
| [ ] | **TC-POS-18** | Split Payment (Tunai + Transfer/QRIS) | Total Rp 500.000. Bayar Tunai Rp 200.000 + QRIS Rp 300.000. | Transaksi mencatat 2 split payment records; total lunas Rp 500.000. | *Positive* |
| [ ] | **TC-POS-19** | Pembayaran Piutang (Tempo) | Pelanggan Member checkout dengan metode Tempo / Piutang. | Faktur terbit; otomatis masuk ke modul **Receivables** dengan status *Unpaid*. | *Positive* |
| [ ] | **TC-POS-20** | Piutang Melebihi Credit Limit | Pelanggan memiliki sisa limit kredit Rp 200.000, transaksi Rp 500.000. | Sistem memblokir transaksi piutang dengan notifikasi "Melebihi limit kredit". | **Boundary / Edge** |
| [ ] | **TC-POS-21** | Integrasi Dynamic QRIS (QRISly / Midtrans) | Kasir pilih bayar QRIS. Sistem memanggil gateway untuk render dynamic QR. | QR muncul di layar; webhook gateway otomatis mengubah status jadi *Paid*. | *Positive* |
| [ ] | **TC-POS-22** | QRIS Expired / Timeout | Customer tidak scan QR hingga batas waktu (misal 5 menit). | Status transaksi pending/expire; kasir bisa menekan tombol `qrisly-retry`. | **Edge Case** |
| [ ] | **TC-POS-23** | Double Click Checkout (Race Condition) | Klik tombol "Bayar" 5 kali berturut-turut secara cepat (< 100ms). | Hanya 1 transaksi terbentuk; invoice tidak ganda; stok tidak terpotong dobel. | **Race Condition** |

---

## 6. Modul 4: Dine-In & Self-Order QR Table System

| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-DINE-01** | Floor Plan Editor Drag-and-Drop | Atur posisi Meja M1 ke koordinat grid X:5, Y:8 pada SVG Floor Plan. | Koordinat tersimpan di DB; tampilan denah sinkron saat reload. | *Positive* |
| [ ] | **TC-DINE-02** | Scan QR Meja Publik | Buka URL `/dine/{token_meja_1}` dari browser HP (tanpa login). | Halaman menu restoran terbuka dengan identitas "Meja M1". | *Positive* |
| [ ] | **TC-DINE-03** | Scan QR Meja Tidak Aktif / Token Salah | Buka URL `/dine/invalid-uuid-token`. | Muncul pesan error 404 / "Meja tidak ditemukan atau tidak aktif". | *Negative* |
| [ ] | **TC-DINE-04** | Self-Order Submission (Bayar di Kasir) | Pelanggan pilih 2 Nasi Goreng + Catatan "Pedas", pilih bayar di kasir, submit. | Pesanan berstatus `submitted`; muncul notifikasi pesanan baru di dashboard kasir. | *Positive* |
| [ ] | **TC-DINE-05** | Polling Status Pesanan Pelanggan | Buka halaman `/dine-order/{accessToken}` saat kasir menerima pesanan. | Polling setiap 5 detik mengupdate UI dari "Menunggu" menjadi "Diterima" tanpa reload. | *Positive* |
| [ ] | **TC-DINE-06** | Kasir Terima (Accept) Pesanan Dine-In | Kasir klik "Terima Pesanan". | Status order menjadi `accepted`; stok bahan/produk **langsung terpotong**. | *Integrity* |
| [ ] | **TC-DINE-07** | Kasir Tolak (Reject) Pesanan Dine-In | Kasir klik "Tolak" dengan alasan "Bahan habis". | Status order menjadi `rejected`; stok **tidak terpotong**; status di HP user berubah ditolak. | *Negative* |
| [ ] | **TC-DINE-08** | Pesanan Serentak di Meja Sama | 2 pelanggan di meja yang sama submit pesanan berbeda bersamaan. | Kedua pesanan masuk terpisah dengan nomor order unik pada meja tersebut. | **Concurrency** |
| [ ] | **TC-DINE-09** | Self-Order Saat Dine-In Dimatikan | Akses `/dine/{token}` saat setting `dine_in_enabled = false`. | Menu ditutup dengan pesan "Layanan Dine-In sedang nonaktif". | *Negative* |

---

## 7. Modul 5: Retur Penjualan (Sales Returns)

| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-RET-01** | Retur Sebagian (Kondisi Bagus) | Faktur beli 5 Pcs @ Rp 20.000. Retur 2 Pcs karena salah beli. Barang bagus. | Pengembalian uang Rp 40.000; Stok barang di gudang bertambah +2 Pcs. | *Positive* |
| [ ] | **TC-RET-02** | Retur Barang Rusak (Damaged Stock) | Retur 1 Pcs barang rusak/cacat. Pilih kondisi "Damaged/Quarantine". | Uang dikembalikan; stok utama **tidak bertambah**; mutasi masuk ke stok karantina. | **Edge Case** |
| [ ] | **TC-RET-03** | Retur Melebihi Jumlah Pembelian | Faktur beli 3 Pcs. Kasir mencoba input retur 4 Pcs. | Ditolak dengan validasi "Jumlah retur melebihi jumlah pembelian". | **Boundary / Negative** |
| [ ] | **TC-RET-04** | Retur Transaksi yang Sudah Diretur | Faktur beli 3 Pcs. Retur #1 sudah mengembalikan 2 Pcs. Coba retur lagi 2 Pcs. | Sistem hanya mengizinkan maksimal 1 Pcs lagi untuk diretur. | **Edge Case** |
| [ ] | **TC-RET-05** | Retur Transaksi Piutang (Kredit) | Transaksi tempo (belum lunas) diretur sebagian. | Sisa tagihan piutang pelanggan otomatis berkurang sesuai nilai retur. | *Integrity* |
| [ ] | **TC-RET-06** | Cetak Bukti Nota Retur | Klik cetak nota retur di printer thermal 58mm/80mm. | Struk retur tercetak jelas memuat nomor retur, referensi invoice asli, dan alasan. | *Positive* |

---

## 8. Modul 6: Inventori, Multi-Gudang & Mutasi Stok

### 8.1. Multi-Gudang & Transfer Antar Gudang
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-WH-01** | Buat Transfer Antar Gudang | Buat transfer 50 Pcs dari Gudang Utama ke Gudang Toko. Status: `Draft`. | Belum ada stok yang berpindah; draft tersimpan rapi. | *Positive* |
| [ ] | **TC-WH-02** | Kirim Barang (Send Transfer) | Klik "Kirim" pada transfer draft. | Status: `in_transit`; stok Gudang Utama berkurang 50 Pcs; stok Toko belum bertambah. | *Positive* |
| [ ] | **TC-WH-03** | Terima Barang Sebagian (Partial Receive) | Gudang Toko hanya menerima 45 Pcs (5 Pcs rusak di perjalanan). | Stok Gudang Toko bertambah +45; tercatat selisih 5 Pcs di log transfer & mutasi. | **Edge Case** |
| [ ] | **TC-WH-04** | Batalkan Transfer yang Sedang In-Transit | Admin klik "Cancel Transfer" saat status `in_transit`. | Status `cancelled`; stok 50 Pcs otomatis dikembalikan ke Gudang Utama. | **Integrity** |
| [ ] | **TC-WH-05** | Transfer Stok Melebihi Saldo Gudang Asal | Gudang Utama hanya punya 10 Pcs, coba kirim 20 Pcs. | Ditolak dengan pesan "Stok gudang asal tidak mencukupi". | *Negative* |

### 8.2. Log Mutasi Stok (Stock Mutation Audit Trail)
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-MUT-01** | Verifikasi Rantai Mutasi Lengkap | Eksekusi: Penerimaan PO (+100) -> Penjualan POS (-20) -> Retur (+2) -> Transfer (-10). | Log mutasi di `/stock-mutations` mencatat semua urutan secara kronologis dengan saldo awal & akhir presisi. | *Integrity* |
| [ ] | **TC-MUT-02** | Filter Log Mutasi | Filter mutasi berdasarkan Produk, Gudang, Tipe (Sale, PO, Return, Opname), dan Tanggal. | Hasil tabel terfilter akurat tanpa record hantu (*ghost records*). | *Positive* |

---

## 9. Modul 7: Stock Opname (Penyesuaian Fisik)

| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-OPN-01** | Buka Sesi Stock Opname | Buat opname untuk Gudang Utama & Kategori "Minuman". Klik `Populate Items`. | Daftar seluruh produk minuman beserta stok sistem saat itu ter-load ke tabel. | *Positive* |
| [ ] | **TC-OPN-02** | Input Hitungan Fisik (Selisih +/-) | Produk A: Sistem 10, Fisik 8 (Selisih -2). Produk B: Sistem 5, Fisik 7 (Selisih +2). | Sistem otomatis menghitung selisih unit dan selisih nominal (Rp). | *Positive* |
| [ ] | **TC-OPN-03** | Finalisasi Opname (Finalize) | Klik Finalisasi Opname dengan permission `stock-opnames-finalize`. | Sesi terkunci (`finalized`); stok master diubah menjadi 8 dan 7; terbit mutasi tipe `Opname Adjustment`. | *Integrity* |
| [ ] | **TC-OPN-04** | Transaksi Terjadi Saat Opname Berlangsung | Ada penjualan POS saat sesi opname belum di-finalize. | Sistem mencatat snapshot waktu perhitungan fisik atau memberi konfirmasi rekonsiliasi. | **Edge Case** |
| [ ] | **TC-OPN-05** | Edit Opname yang Sudah Final | Coba update item atau populate ulang pada opname yang sudah `finalized`. | Request diblokir (403/422); data historis terkunci permanen. | *Security* |

---

## 10. Modul 8: Rantai Pembelian (Purchasing, GR & Retur Supplier)

### 10.1. Purchase Order (PO) & Goods Receiving (GR)
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-PUR-01** | Buat & Terbitkan Purchase Order | Buat PO ke Supplier PT ABC untuk 100 Pcs @ Rp 50.000 + PPN 11%. Klik "Place Order". | Status PO: `placed`; nomor dokumen otomatis terbit (PO/YYYYMM/XXXX); stok belum bertambah. | *Positive* |
| [ ] | **TC-PUR-02** | Penerimaan Barang Bertahap (Partial GR) | Supplier mengirim 40 Pcs pertama. Buat Goods Receiving linked ke PO. | Stok gudang bertambah +40; status PO: `partially_received`; sisa PO tersisa 60 Pcs. | *Positive* |
| [ ] | **TC-PUR-03** | Over-Receiving (Menerima Melebihi PO) | Staff coba input penerimaan 70 Pcs pada sisa PO yang hanya 60 Pcs. | Sistem menolak / membatasi sesuai aturan toleransi over-receiving. | **Boundary / Edge** |
| [ ] | **TC-PUR-04** | Otomatisasi Terbit Hutang (Payables) dari GR | Penerimaan 40 Pcs @ Rp 50.000 (Total Rp 2.000.000) dengan TOP 30 Hari. | Otomatis terbuat invoice hutang di modul **Payables** jatuh tempo H+30. | *Integrity* |
| [ ] | **TC-PUR-05** | Cetak & Share PO Link Publik | Akses share link publik `/share/purchase-orders/{docNumber}` tanpa login. | Halaman web & PDF PO resmi dapat diakses publik tanpa login dashboard. | *Positive* |

### 10.2. Retur Pembelian ke Supplier (Supplier Returns)
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-SUPRET-01** | Retur Barang ke Supplier | Buat retur 10 Pcs dari GR sebelumnya karena cacat. Klik "Complete". | Stok gudang terpotong -10 Pcs; saldo hutang ke supplier otomatis berkurang. | *Positive* |
| [ ] | **TC-SUPRET-02** | Retur Melebihi Stok Gudang Saat Ini | Coba retur 50 Pcs padahal sisa stok di gudang hanya 30 Pcs (sebagian sudah terjual). | Ditolak dengan notifikasi stok fisik tidak mencukupi untuk diretur ke supplier. | **Edge Case** |

---

## 11. Modul 9: Manajemen Keuangan (Hutang & Piutang Usaha)

### 11.1. Piutang Usaha (Receivables / Nota Barang)
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-REC-01** | Catat Pembayaran Cicilan Piutang | Customer berhutang Rp 1.000.000. Bayar cicilan #1 Rp 400.000. | Saldo piutang tersisa Rp 600.000; status tetap `partial`; kas masuk bertambah. | *Positive* |
| [ ] | **TC-REC-02** | Pelunasan Piutang | Bayar sisa cicilan #2 Rp 600.000. | Saldo piutang Rp 0; status berubah menjadi `paid`. | *Positive* |
| [ ] | **TC-REC-03** | Pembayaran Melebihi Sisa Piutang | Input pembayaran Rp 700.000 pada sisa piutang Rp 600.000. | Ditolak dengan validasi "Nominal bayar tidak boleh melebihi sisa tagihan". | **Boundary** |
| [ ] | **TC-REC-04** | Analisis Umur Piutang (Aging Buckets) | Cek halaman `/receivables/aging` untuk faktur umur 15 hari, 40 hari, 75 hari, dan 120 hari. | Tampil akurat di bucket 0-30 Hari, 31-60 Hari, 61-90 Hari, dan >90 Hari. | *Positive* |
| [ ] | **TC-REC-05** | Customer Portal Self-Payment | Customer buka invoice di portal `/portal/transactions/{invoice}`, bayar via QRIS/Snap. | Setelah webhook sukses, approval payment tercatat dan saldo piutang terupdate. | *Integration* |
| [ ] | **TC-REC-06** | Approval Pembayaran Piutang Transfer | Kasir input konfirmasi transfer dengan slip. Admin klik `Reject` di `/receivables/payments/{id}/reject`. | Pembayaran dibatalkan; saldo piutang kembali ke nilai sebelum submit slip. | *Negative* |

### 11.2. Hutang Usaha (Payables ke Supplier)
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-PAY-01** | Bayar Hutang Supplier dari Rekening | Bayar hutang supplier Rp 5.000.000 menggunakan Rekening Bank BCA. | Saldo hutang berkurang; histori pembayaran bank account terkait tercatat. | *Positive* |
| [ ] | **TC-PAY-02** | Hapus Riwayat Pembayaran Hutang (Rollback) | Hapus salah satu cicilan hutang yang salah input. | Saldo hutang supplier otomatis kembali bertambah (*reversal*). | **Integrity** |
| [ ] | **TC-PAY-03** | Cetak Rekening Koran Supplier (Supplier Statement) | Generate PDF Rekening Koran Supplier untuk periode 3 bulan terakhir. | Tampil mutasi hutang, pembayaran, dan retur supplier dengan saldo berjalan akurat. | *Positive* |

---

## 12. Modul 10: Skema Harga, Diskon, Voucher & Loyalty

| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-LOY-01** | Akumulasi Poin Member per Transaksi | Setting: Belanja Rp 10.000 dapat 1 Poin. Member belanja Rp 105.000. | Member memperoleh 10 Poin baru; saldo poin terakumulasi di akun member. | *Positive* |
| [ ] | **TC-LOY-02** | Naik Tier Otomatis (Bronze -> Silver -> Gold) | Akumulasi belanja member mencapai batas threshold Tier Gold (misal Rp 10.000.000). | Tier member otomatis naik ke Gold; multiplier poin berubah sesuai aturan Tier Gold. | *Positive* |
| [ ] | **TC-LOY-03** | Redeem Poin Jadi Diskon di Kasir | Kasir redeem 50 Poin (Nilai 1 Poin = Rp 1.000 -> Diskon Rp 50.000). | Grand total berkurang Rp 50.000; saldo poin member berkurang 50. | *Positive* |
| [ ] | **TC-LOY-04** | Redeem Poin Melebihi Saldo Poin | Member hanya punya 30 Poin, coba redeem 50 Poin. | Ditolak dengan notifikasi "Saldo poin tidak mencukupi". | *Negative* |
| [ ] | **TC-PRICELIST-01**| Multi-Price List (Daftar Harga Khusus) | Hubungkan Customer A ke Price List "Reseller". Tambahkan produk ke cart di POS. | Harga produk otomatis menggunakan tarif "Reseller", bukan tarif retail umum. | *Positive* |
| [ ] | **TC-PRICELIST-02**| Bulk Update Harga Price List | Upload CSV perubahan harga untuk 500 SKU pada Price List Reseller. | Semua harga terupdate dalam satu transaksi database atomic; tidak ada data parsial. | *Performance* |

---

## 13. Modul 11: CRM, Segmentasi & WhatsApp Gateway

| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-CRM-01** | Segmentasi Otomatis (RFM Rules) | Buat segment: Pelanggan tidak belanja > 30 hari. Klik sync/recalculate. | Semua pelanggan yang sesuai kriteria otomatis masuk ke daftar member segmen. | *Positive* |
| [ ] | **TC-CRM-02** | Template Broadcast Pesan Dinamis | Buat template: `Halo {customer_name}, Anda punya {loyalty_points} poin di {store_name}`. | Saat dikirim, placeholder variabel ter-replace dengan data riil pelanggan. | *Positive* |
| [ ] | **TC-WA-01** | Pairing QR WhatsApp Gateway | Buka Settings > WhatsApp, klik Start, scan QR code via aplikasi WhatsApp HP. | Status berubah menjadi `Connected`; nomor HP gateway & status koneksi tampil. | *Integration* |
| [ ] | **TC-WA-02** | Kirim Struk Transaksi Otomatis via WA | Selesaikan transaksi customer dengan nomor WA terdaftar. Klik Share WhatsApp. | Pesan struk + link PDF invoice terkirim ke nomor WA customer dalam hitungan detik. | *Integration* |
| [ ] | **TC-WA-03** | Penanganan Layanan WA Down / Disconnect | Layanan Node.js WA service mati (port 3001 down). Lakukan transaksi di kasir. | Kasir tetap bisa checkout tanpa blocking/crash (graceful degradation; log error di backend). | **Resilience / Edge** |
| [ ] | **TC-WA-04** | Nomor HP Tidak Valid (Karakter Aneh) | Kirim broadcast ke nomor `0812-abc-!@#` atau nomor tanpa format internasional `+62`. | Sistem melakukan sanitasi format otomatis menjadi `62812...` atau mencatat log `Skipped`. | **Boundary** |

---

## 14. Modul 12: Laporan Keuangan, BI Insights & Cetak ESC/POS

### 14.1. Laporan Finansial & Margin
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-REP-01** | Laporan Penjualan (Sales Report) Filter | Filter laporan per Kasir, Gudang, Metode Bayar, dan Range Tanggal (1 Jan - 31 Jan). | Menampilkan total Omzet Kotor, Diskon, PPN, Omzet Bersih, dan HPP/COGS secara presisi. | *Positive* |
| [ ] | **TC-REP-02** | Laporan Laba Rugi (Profit & Loss) | Bandingkan Omzet Bersih dikurangi Total HPP dan Biaya Operasional / Retur. | Angka Laba Kotor dan Laba Bersih sesuai dengan seluruh transaksi yang terekam. | *Integrity* |
| [ ] | **TC-REP-03** | Rekonsiliasi Retur di Laporan | Transaksi Rp 100.000 diretur Rp 30.000. Cek laporan penjualan. | Net Sales mencatat Rp 70.000; retur tercatat terpisah sebagai pengurang. | *Integrity* |
| [ ] | **TC-REP-04** | Advanced BI Insights & Heatmap Jam Ramai | Buka halaman `/reports/insights`. | Grafik produk terlaris, visualisasi jam sibuk kasir, dan matriks loyalitas tampil responsif. | *Positive* |

### 14.2. Cetak Struk ESC/POS Thermal & PDF
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-PRN-01** | Cetak Struk Thermal 58mm vs 80mm | Cetak transaksi dengan setting lebar kertas 58mm, lalu ganti ke 80mm. | Layout teks, tabel item, dan grand total otomatis menyesuaikan (*text wrap* rapi). | *Hardware* |
| [ ] | **TC-PRN-02** | Buka Laci Kas Otomatis (Cash Drawer Kick) | Cetak struk tunai dengan opsi `open_cash_drawer = true`. | Perintah ESC/POS (`\x1B\x70\x00...`) terkirim dan laci uang fisik otomatis terbuka. | *Hardware* |
| [ ] | **TC-PRN-03** | Generate Dokumen PDF Surat Jalan (Shipping) | Buka `/documents/transactions/{invoice}/pdf/shipping`. | PDF Surat Jalan ter-render rapi (alamat pengirim, penerima, qty barang, kolom tanda tangan). | *Positive* |

---

## 15. Modul 13: Import/Export & Pengaturan Sistem

| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [X] | **TC-IMP-01** | Download Template Import Excel & CSV | Download template produk di `/import/template/products`. | File spreadsheet valid ter-download dengan header kolom lengkap. | *Positive* |
| [ ] | **TC-IMP-02** | Import 1.000 Produk Sekaligus | Upload file Excel berisi 1.000 produk dengan beberapa kategori baru. | Semua produk masuk ke DB; kategori baru auto-create jika belum ada; tidak timeout. | *Performance* |
| [X] | **TC-IMP-03** | Import Data Duplikat / SKU Kembar | Upload file dengan barcode / SKU yang sudah ada di database. | Sistem menampilkan error list baris yang gagal dengan keterangan "SKU sudah digunakan". | **Negative / Edge** |
| [ ] | **TC-IMP-04** | Export Data Pelanggan & Transaksi | Export 10.000 transaksi ke format Excel & CSV dengan filter tahun berjalan. | File ter-download sempurna tanpa memori overflow (*chunked streaming export*). | *Positive* |
| [ ] | **TC-SET-01** | Update Pengaturan Pajak (PPN Dinamis) | Ubah tarif PPN dari 11% menjadi 12% dan toggle "Harga Termasuk Pajak (Inclusive)". | Transaksi POS baru langsung menghitung PPN 12% sesuai mode inklusif/eksklusif. | *Positive* |
| [ ] | **TC-SET-02** | Ganti Bahasa (Localization ID / EN) | Ubah bahasa di dropdown header dari Bahasa Indonesia ke English. | Seluruh label navigasi, tombol, dan pesan validasi beralih ke Bahasa Inggris. | *Positive* |

---

## 16. Modul 14: REST API Sanctum & Payment Webhooks

| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-API-01** | Login API Mobile Kasir via Sanctum | POST `/api/v1/auth/login` dengan kredensial kasir. | Return HTTP 200 dengan `bearer_token` dan object user permissions. | *Positive* |
| [ ] | **TC-API-02** | Akses Endpoint Master Data Tanpa Token | GET `/api/v1/products` tanpa header `Authorization`. | Return HTTP 401 Unauthorized (`Unauthenticated.`). | *Security* |
| [ ] | **TC-API-03** | Webhook Midtrans - Valid Signature | POST `/webhooks/midtrans` dengan status `settlement` & signature key valid. | Return 200 OK; status transaksi POS terkait otomatis berubah menjadi `Paid`. | *Integration* |
| [ ] | **TC-API-04** | Webhook Midtrans - Fake Signature Key | POST `/webhooks/midtrans` dengan signature key palsu. | Return 403 / 400 Bad Request; status pembayaran tidak berubah. | **Security / Edge** |
| [ ] | **TC-API-05** | Webhook Idempotency (Notifikasi Ganda) | Kirim webhook sukses yang sama 3 kali berturut-turut dari gateway. | Sistem hanya memproses 1x; tidak memotong stok ganda atau mencatat pembayaran dobel. | **Race / Edge** |

---

## 17. Modul 15: Skenario Edge Case Ekstrem Lintas Sistem (Cross-Cutting Chaos Testing)

### 17.1. Offline Mode & Sinkronisasi Jaringan
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-CHAOS-01** | Putus Koneksi Saat Checkout (Network Drop Midway) | Buka POS, isi keranjang, matikan koneksi internet, lalu tekan "Bayar". | POS beralih ke IndexedDB Offline Mode, struk offline terbit dengan nomor UUID invoice sementara. | *Offline / Resilience* |
| [ ] | **TC-CHAOS-02** | Sinkronisasi Massal Pasca Reconnect | Lakukan 20 transaksi offline. Nyalakan internet kembali. Klik "Sync Offline Transactions" (`/transactions/sync-offline`). | Seluruh 20 transaksi ter-upload, nomor invoice resmi di-assign, stok master di server terpotong, audit log tersinkron tanpa ada duplikasi invoice ID. | *Integrity* |
| [ ] | **TC-CHAOS-03** | Konflik Stok Saat Sinkronisasi Offline | Kasir A (offline) menjual 2 unit Barang X (stok awal 2). Kasir B (online) juga menjual 2 unit Barang X. Saat Kasir A online dan melakukan sync. | Sistem mendeteksi konflik stok negatif; mencatat flag warning penyesuaian di dashboard admin tanpa membatalkan transaksi yang sudah terjadi di fisik. | **Edge Case** |

### 17.2. Konkurensi & Race Condition
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-CHAOS-04** | Rebutan Stok Terakhir (Flash Sale Simulation) | Sisa stok Produk Z = 1 Pcs. Kasir 1 dan Kasir 2 menekan tombol "Bayar" secara bersamaan (< 10ms diff). | Database transaction locking (`lockForUpdate`) memastikan hanya 1 kasir yang berhasil; kasir kedua menerima notifikasi "Stok telah habis". | **Race Condition** |
| [ ] | **TC-CHAOS-05** | Double Checkout Rapid Clicks | Kasir melakukan spam click tombol "Checkout" sebanyak 10 kali dalam 1 detik. | Frontend mendisable tombol instan; backend memiliki token idempotency sehingga hanya 1 transaksi tersimpan. | **Concurrency** |

### 17.3. Presisi Desimal, Pembulatan Pajak & Keuangan
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-CHAOS-06** | Pembulatan Pajak Nominal Koma (Floating Point Inaccuracy) | Beli 3 item @ Rp 33.333 dengan PPN 11% (Total = Rp 99.999 + PPN Rp 10.999,89). | Pembulatan konsisten (misal *round half up* ke Rp 11.000); total tagihan Rp 110.000 tanpa perbedaan 1 rupiah antara detail item dan grand total. | **Boundary / Math** |
| [ ] | **TC-CHAOS-07** | Diskon 100% (Barang Gratis / Tester) | Terapkan diskon manual 100% pada total belanja Rp 250.000. | Grand total = Rp 0; metode bayar otomatis "Free/Complimentary"; stok tetap terpotong; tidak muncul error kembalian negatif. | **Edge Case** |

### 17.4. Manipulasi Input & Keamanan (SQLi, XSS, Special Chars)
| Status | Test ID | Fitur / Skenario | Langkah Pengujian & Data Uji | Expected Result | Tipe |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **TC-CHAOS-08** | Input Karakter Khusus & Unicode | Buat nama produk, nama pelanggan, atau catatan pesanan dengan karakter: `' OR '1'='1`, `<script>alert(1)</script>`, emoji `🔥🎉🍕`, dan karakter Mandarin/Arab. | Data tersimpan aman tanpa SQL Error; render di layar dan di PDF/print thermal tidak memicu XSS dan tidak memecah layout. | **Security** |

---

## 18. Checklist Eksekusi & Kriteria Kelulusan Rilis (QA Sign-Off)

### 18.1. Lembar Checksheet Eksekusi
| Modul Pengujian | Total Test Cases | Passed (✅) | Failed (❌) | Blocked (⚠️) | Pass Rate (%) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| 1. Autentikasi & RBAC | 10 |  |  |  |  |
| 2. Sesi Kasir & Shift | 6 |  |  |  |  |
| 3. Transaksi POS & Cart | 23 |  |  |  |  |
| 4. Dine-In & QR Table | 9 |  |  |  |  |
| 5. Retur Penjualan | 6 |  |  |  |  |
| 6. Multi-Gudang & Mutasi Stok | 7 |  |  |  |  |
| 7. Stock Opname | 5 |  |  |  |  |
| 8. Purchasing & PO | 7 |  |  |  |  |
| 9. Hutang & Piutang | 9 |  |  |  |  |
| 10. Promo, Diskon & Loyalty | 6 |  |  |  |  |
| 11. CRM & WhatsApp Gateway | 6 |  |  |  |  |
| 12. Laporan & Thermal Print | 7 |  |  |  |  |
| 13. Import/Export & Settings | 6 |  |  |  |  |
| 14. REST API & Webhooks | 5 |  |  |  |  |
| 15. Chaos & Cross-Cutting Edges | 8 |  |  |  |  |
| **TOTAL** | **120** |  |  |  |  |

### 18.2. Kriteria Kelulusan Rilis (Sign-Off Criteria)
Aplikasi dinyatakan **siap untuk rilis produksi (Ready for Production)** apabila:
1. **100% Test Case Severity P0 (Critical) & P1 (Major) berstatus PASSED.**
2. **Tidak ada selisih stok (*stock drift*)** antara tabel produk/gudang dan tabel mutasi stok.
3. **Seluruh webhook gateway pembayaran (Midtrans, Xendit, QRISly)** lulus uji idempotency dan verifikasi signature.
4. **Offline synchronization** berhasil merekonsiliasi 100% data tanpa kehilangan data (*zero data loss*).
5. **Cetak thermal 58mm & 80mm** telah diverifikasi pada perangkat printer fisik (ESC/POS).
