# RBAC, Users, Roles

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Mengatur kontrol akses berbasis role dan permission untuk semua modul dashboard.

## Fitur Saat Ini

- user management
- role management
- permission list
- route protection dengan middleware permission
- permission map dibagikan ke frontend via Inertia

## Halaman dan Route

- `dashboard/users`
- `dashboard/roles`
- `dashboard/permissions`

## Permission Umum

Setiap modul memakai permission sendiri, contohnya:

- `transactions-access`
- `sales-returns-*`
- `stock-opnames-*`
- `cashier-shifts-*`
- `audit-logs-access`

## Alur Otorisasi

1. permission diseed di `PermissionSeeder`
2. role disusun di `RoleSeeder`
3. user default disusun di `UserSeeder`
4. route memakai middleware `permission:*`
5. frontend membaca map permission dari `HandleInertiaRequests`

## Catatan Super Admin

- user `super-admin` mendapat role `super-admin`
- backend memperlakukan role `super-admin` sebagai bypass permission yang konsisten untuk `can`, `canAny`, dan middleware Spatie
- seeder juga menyinkronkan permission ke user admin default
- cache permission Spatie harus di-reset saat seeding agar permission baru terbaca konsisten
- role lama `permission-access` dinormalisasi ke `permissions-access` saat seeding agar naming RBAC tidak ambigu

## Integrasi Frontend

Frontend membaca:

- `auth.permissions`
- `auth.super`

Ini dipakai untuk menampilkan atau menyembunyikan menu dan action tertentu.

Helper frontend utama:

- `resources/js/Utils/authorization.js`
- `resources/js/Utils/Permission.jsx`

## Batasan Saat Ini

- backend tetap menjadi sumber kebenaran utama
- frontend hanya untuk gating UI, bukan keamanan final

## Proteksi Step-Up Authentication (Password Confirmation)

Selain proteksi permission dasar, aksi-aksi bertaraf sensitif (*privileged actions*) diwajibkan melewati middleware `step_up` (`EnsureRecentPasswordConfirmation`):

- **Aksi Terproteksi**: Create/Update/Delete Role & User, Pengaturan Payment Gateway & Rekening Bank, Update Price List & Diskon, Force Close Shift Kasir, Pembatalan/Konfirmasi Pembayaran.
- **Session Timeout Window**: **15 Menit (900 detik)** secara default. Dapat diubah lewat environment variable `AUTH_PASSWORD_TIMEOUT`.
- **Mekanisme**:
  1. Waktu konfirmasi terakhir disimpan di session `auth.password_confirmed_at`.
  2. Frontend menerima timestamp `stepUpFreshUntil` via `HandleInertiaRequests.php`.
  3. Jika window 15 menit masih berlaku, aksi sensitif langsung diizinkan.
  4. Jika window telah habis/kedaluwarsa, API request mengembalikan response HTTP `423` (Locked/Challenge) atau mengarahkan ke halaman `/confirm-password`.
  5. Setiap tantangan konfirmasi dicatat di audit log (`security.privileged_action_challenged`).

## File Sentral

- `database/seeders/PermissionSeeder.php`
- `database/seeders/RoleSeeder.php`
- `database/seeders/UserSeeder.php`
- `app/Http/Middleware/EnsureRecentPasswordConfirmation.php`
- `app/Http/Middleware/HandleInertiaRequests.php`
- `resources/js/Utils/Menu.jsx`
