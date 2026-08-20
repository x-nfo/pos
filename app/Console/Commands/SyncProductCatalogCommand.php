<?php

namespace App\Console\Commands;

use App\Services\ProductCatalogService;
use Illuminate\Console\Command;

class SyncProductCatalogCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'catalog:sync-google-sheet {--url= : URL CSV ekspor Google Sheet}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sinkronisasi master data referensi katalog produk Indonesia dari Google Sheets';

    /**
     * Execute the console command.
     */
    public function handle(ProductCatalogService $service): int
    {
        $url = $this->option('url') ?: config('services.catalog.google_sheet_csv_url');

        if (! $url) {
            $this->error('URL Google Sheet belum dikonfigurasi. Harap isi GOOGLE_SHEET_CATALOG_URL di file .env');
            return Command::FAILURE;
        }

        $this->info("Menghubungi Google Sheet...");
        $this->line("URL: {$url}");

        try {
            $startTime = microtime(true);
            $lastCount = 0;

            $result = $service->syncFromGoogleSheet($url, function (int $processed) use (&$lastCount) {
                if ($processed - $lastCount >= 2000) {
                    $this->line("Sedang memproses... {$processed} produk diimpor.");
                    $lastCount = $processed;
                }
            });

            $duration = round(microtime(true) - $startTime, 2);

            $this->newLine();
            $this->info("✓ Sukses! {$result['total_imported']} produk referensi berhasil disinkronkan dalam {$duration} detik.");

            return Command::SUCCESS;
        } catch (\Throwable $e) {
            $this->error("Gagal sinkronisasi: " . $e->getMessage());
            return Command::FAILURE;
        }
    }
}
