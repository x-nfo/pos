# Panduan Deployment Point of Sales (Production)

Kembali ke indeks dokumentasi: `docs/README.md`

Panduan ini berisi langkah-langkah *best practice* untuk men-deploy aplikasi Point of Sales di environment Production, termasuk setup background worker (Queue) dan service WhatsApp.

## 1. Persiapan Server
Pastikan server memiliki:
- PHP 8.3+ (dengan ekstensi `bcmath`, `ctype`, `fileinfo`, `json`, `mbstring`, `openssl`, `pdo`, `tokenizer`, `xml`, `gd`, `zip`, dsb.)
- Composer
- Node.js 18+ & NPM (untuk build assets dan node service)
- MySQL / MariaDB
- PM2 (dapat diinstall via `npm install -g pm2`)

## 2. Tarik Kode & Install Dependencies
Masuk ke folder project di server dan jalankan perintah:

```bash
git pull origin main

# Install PHP dependencies (tanpa dev package)
composer install --optimize-autoloader --no-dev

# Install NPM dependencies
npm install
```

## 3. Konfigurasi Environment (`.env`)
Salin file konfigurasi jika belum ada:
```bash
cp .env.example .env
```
Edit file `.env` dan pastikan bagian krusial berikut diubah untuk production:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://kasir.domainanda.com  # Wajib berupa URL publik untuk Webhook Midtrans/Xendit

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=pos_db
DB_USERNAME=pos_user
DB_PASSWORD=secret

# Queue & Cache (Wajib diisi database atau redis untuk background worker)
QUEUE_CONNECTION=database
CACHE_DRIVER=file
SESSION_DRIVER=database

# URL Service WhatsApp Lokal
WA_SERVICE_URL=http://localhost:3001
```

*Jalankan `php artisan key:generate` jika aplikasi ini baru di-deploy pertama kali.*

## 4. Migrasi & Build Frontend
Jalankan migrasi database (termasuk tabel antrean/jobs):

```bash
# Force migration for production
php artisan migrate --force

# Symlink folder storage agar gambar produk muncul
php artisan storage:link

# Compile assets React/Tailwind
npm run build
```

## 5. Optimasi Cache Laravel
Agar Laravel berjalan jauh lebih cepat di production, jalankan perintah _caching_ berikut:

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
```

*(Catatan: Jika sewaktu-waktu Anda mengubah file `.env`, Anda **wajib** menjalankan `php artisan config:clear` dan mengulangi perintah `config:cache` di atas).*

## 6. Konfigurasi Background Worker (PM2)
Aplikasi ini memiliki tugas berat di latar belakang seperti pengiriman pengingat WhatsApp. Jangan biarkan *cron* menangani tugas berat ini secara sinkronos. Kita akan menggunakan PM2.

### A. Worker Antrean Khusus WhatsApp (Queue)
Aplikasi utama (`www-data`) disarankan untuk menangani antrean `default` secara bawaan agar tugas cepat tidak terhambat. Untuk PM2, jalankan *worker* yang **dikhususkan** memantau antrean `whatsapp` (karena proses pengiriman WA sengaja diberi jeda waktu agar anti-blokir):
```bash
pm2 start "php artisan queue:work --queue=whatsapp --sleep=3 --tries=3 --max-time=3600" --name "laravel-worker-wa"
```

### B. Service Gateway WhatsApp
Aplikasi ini membutuhkan *Node.js service* terpisah untuk WhatsApp Web JS:
```bash
cd whatsapp-service
npm install

# Kembali ke folder utama atau jalankan langsung dengan path
cd ..
# Gunakan memory limit untuk menghindari kebocoran memori (memory leak) dari Chromium
pm2 start whatsapp-service/server.js --name "wa-service" --max-memory-restart 500M
```

Simpan konfigurasi PM2 agar otomatis *restart* saat server *reboot*:
```bash
pm2 save
pm2 startup
```

## 7. Konfigurasi Scheduler (Cron Job)
Untuk fitur "Kirim Penagihan Otomatis" (CRM Automation), Anda harus menjalankan *scheduler* Laravel setiap menit di dalam server (via `crontab -e`):

```cron
* * * * * cd /path/to/point-of-sales && php artisan schedule:run >> /dev/null 2>&1
```

*(Cron ini bertugas memicu `crm:generate-reminders` setiap jam 09:15 pagi hari).*

## 8. Cek Folder Permissions
Pastikan web server (Nginx/Apache) memiliki hak akses baca-tulis ke folder `storage` dan `bootstrap/cache`:

```bash
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache
```

## Troubleshooting Cepat
1. **Lupa password admin?** Reset di database atau `php artisan tinker`.
2. **Pesan WhatsApp gagal kirim?** Cek log PM2 dengan `pm2 logs wa-service` atau `pm2 logs laravel-worker-wa`.
3. **Pesan Tagihan/Overdue Menumpuk?** Pastikan *laravel-worker-wa* PM2 berjalan. Cek isi antrean di tabel `jobs` pada database.
