<?php

namespace App\Services\Ocr\Drivers;

use App\Models\Setting;
use App\Services\Ocr\Contracts\OcrVisionDriverInterface;
use App\Services\Ocr\ProductOcrDataSanitizer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeminiVisionDriver implements OcrVisionDriverInterface
{
    private string $apiKey;

    private string $model;

    private string $baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

    public function __construct(?string $apiKey = null, ?string $model = null)
    {
        $this->apiKey = $apiKey
            ?: (string) Setting::get('ocr_gemini_api_key', config('services.ocr.gemini.api_key', ''));

        $configuredModel = (string) Setting::get('ocr_gemini_model', config('services.ocr.gemini.model', 'gemini-flash-lite-latest'));
        if ($configuredModel === 'gemini-2.0-flash' || $configuredModel === 'gemini-1.5-flash-8b' || empty($configuredModel)) {
            $configuredModel = 'gemini-flash-lite-latest';
        }

        $this->model = $model ?: $configuredModel;
    }



    /**
     * Ekstraksi single product dari foto kemasan / label produk.
     */
    public function extractSingleProduct(UploadedFile|string $image, array $options = []): array
    {
        $this->ensureApiKeyConfigured();

        $imageData = $this->prepareImageData($image);

        $prompt = <<<PROMPT
Anda adalah asisten AI OCR untuk sistem Point of Sales (POS) ritel dan minimarket di Indonesia.
Analisis foto produk/label kemasan ini secara teliti dan ekstrak informasi produk.

Identifikasi:
1. title: Nama lengkap produk dengan merek, varian rasa/tipe, dan ukuran netto/gramatur (Contoh: "Kopi Kapal Api Special Mix 10x24g", "Indomie Goreng 85g", "Aqua Air Mineral 600ml").
2. barcode: Barcode (EAN-13, UPC, Code128) jika angka barcode terbaca di kemasan. Jika tidak ada atau buram, berikan null.
3. sku: Kode SKU atau kode barang jika tertera di label rak/kemasan. Jika tidak ada, berikan null.
4. buy_price: Harga beli / HPP (dalam angka tanpa titik/koma) jika tertera di label rak (contoh: harga grosir/modal). Jika tidak ada, berikan 0.
5. sell_price: Harga jual / HET / banderol eceran di kemasan/label rak jika ada. Jika tidak ada, berikan 0.
6. unit: Satuan produk (PCS, BOTOL, PACK, RENCENG, DUS, BUNGKUS, KG, GRAM). Default ke "PCS".
7. category_suggestion: Rekomendasi kategori yang cocok (misal: "Makanan & Minuman", "Sembako", "Perawatan Diri", "Kebutuhan Rumah Tangga", "Rokok", "Obat-obatan").
8. description: Deskripsi singkat produk, berat bersih, varian, atau informasi penting lainnya.
9. confidence: Tingkat keyakinan deteksi dari 0.0 sampai 1.0.

Kembalikan HANYA format JSON murni yang valid sesuai struktur:
{
  "title": "string",
  "barcode": "string|null",
  "sku": "string|null",
  "buy_price": 0,
  "sell_price": 0,
  "unit": "PCS",
  "category_suggestion": "string",
  "description": "string",
  "confidence": 0.95
}
PROMPT;

        $rawResponse = $this->callGeminiVision($prompt, $imageData);
        $data = $this->parseJsonResponse($rawResponse);

        return ProductOcrDataSanitizer::sanitizeSingleProduct($data);
    }

    /**
     * Ekstraksi multi-items dari foto invoice/faktur pembelian supplier.
     */
    public function extractInvoiceItems(UploadedFile|string $image, array $options = []): array
    {
        $this->ensureApiKeyConfigured();

        $imageData = $this->prepareImageData($image);

        $prompt = <<<PROMPT
Anda adalah asisten AI OCR akuntansi dan inventory untuk POS di Indonesia.
Analisis foto faktur / struk / nota pembelian supplier ini secara teliti. Ekstrak data transaksi dan seluruh daftar item produk.

Identifikasi:
1. invoice_number: Nomor faktur / No Nota / No Bon jika ada.
2. supplier_name: Nama toko supplier / distributor / grosir jika tertera di kop faktur.
3. invoice_date: Tanggal nota format YYYY-MM-DD jika ada.
4. total_amount: Total tagihan / total bayar akhir.
5. items: Daftar seluruh item barang dalam tabel atau list. Untuk tiap item:
   - title: Nama barang/deskripsi produk selengkap mungkin.
   - barcode: Barcode jika tertulis di nota (biasanya null untuk nota cetak thermal biasa).
   - sku: Kode barang / PLU jika ada.
   - qty: Kuantitas barang (angka).
   - unit: Satuan barang (PCS, DUS, SLOP, PACK, BTL, KG, dll).
   - buy_price: Harga beli / harga satuan (angka).
   - sell_price: Perkiraan harga jual (bisa 0 jika tidak ada).
   - subtotal: Total harga untuk baris item tersebut (qty * buy_price).
   - category_suggestion: Rekomendasi kategori produk.

Kembalikan HANYA format JSON murni yang valid sesuai struktur:
{
  "invoice_number": "string|null",
  "supplier_name": "string|null",
  "invoice_date": "YYYY-MM-DD",
  "total_amount": 0,
  "items": [
    {
      "title": "string",
      "barcode": null,
      "sku": null,
      "qty": 1,
      "unit": "PCS",
      "buy_price": 0,
      "sell_price": 0,
      "subtotal": 0,
      "category_suggestion": "string"
    }
  ]
}
PROMPT;

        $rawResponse = $this->callGeminiVision($prompt, $imageData);
        $data = $this->parseJsonResponse($rawResponse);

        return ProductOcrDataSanitizer::sanitizeInvoice($data);
    }

    /**
     * Memeriksa apakah koneksi API Key Gemini berfungsi normal.
     */
    public function testConnection(): array
    {
        $this->ensureApiKeyConfigured();

        $modelsToTry = array_unique([$this->model, 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.6-flash']);
        $lastError = '';

        foreach ($modelsToTry as $candidateModel) {
            $endpoint = "{$this->baseUrl}/{$candidateModel}:generateContent?key={$this->apiKey}";

            try {
                $response = Http::timeout(15)->post($endpoint, [
                    'contents' => [
                        [
                            'parts' => [
                                ['text' => 'Jawab dengan 1 kata: "OK" jika koneksi API Gemini berhasil.'],
                            ],
                        ],
                    ],
                    'generationConfig' => [
                        'temperature' => 0.1,
                        'maxOutputTokens' => 10,
                    ],
                ]);

                if ($response->successful()) {
                    return [
                        'success' => true,
                        'message' => "Koneksi ke Google Gemini AI ({$candidateModel}) berhasil terhubung!",
                        'model' => $candidateModel,
                    ];
                }

                $errorData = $response->json();
                $lastError = $errorData['error']['message'] ?? $response->body();
            } catch (\Throwable $e) {
                $lastError = $e->getMessage();
            }
        }

        return [
            'success' => false,
            'message' => "Gagal terhubung ke Gemini API: {$lastError}",
        ];
    }

    /**
     * Panggil API Gemini Vision multimodal dengan fallback cerdas jika kuota model habis.
     */
    private function callGeminiVision(string $prompt, array $imageData): string
    {
        $modelsToTry = array_unique([$this->model, 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.6-flash']);
        $lastException = null;


        $payload = [
            'contents' => [
                [
                    'parts' => [
                        ['text' => $prompt],
                        [
                            'inline_data' => [
                                'mime_type' => $imageData['mime_type'],
                                'data' => $imageData['base64'],
                            ],
                        ],
                    ],
                ],
            ],
            'generationConfig' => [
                'response_mime_type' => 'application/json',
                'temperature' => 0.1,
            ],
        ];

        foreach ($modelsToTry as $currentModel) {
            $endpoint = "{$this->baseUrl}/{$currentModel}:generateContent?key={$this->apiKey}";

            try {
                $response = Http::timeout(45)->post($endpoint, $payload);

                if ($response->successful()) {
                    $result = $response->json();
                    $text = $result['candidates'][0]['content']['parts'][0]['text'] ?? '';

                    if (! empty($text)) {
                        return $text;
                    }
                }

                $errorData = $response->json();
                $errorMessage = $errorData['error']['message'] ?? ('HTTP Error '.$response->status());
                Log::warning("Gemini model {$currentModel} returned error ({$response->status()}): {$errorMessage}. Trying fallback if available.");

                $lastException = new \RuntimeException("Gagal memproses gambar dengan Gemini AI ({$currentModel}): {$errorMessage}");

                // Jika error bukan karena kuota/model tidak ada, dan bukan 429/404, coba model berikutnya
                continue;
            } catch (\Throwable $e) {
                Log::error("Gemini model {$currentModel} call error: ".$e->getMessage());
                $lastException = $e;
            }
        }

        if ($lastException) {
            throw $lastException;
        }

        throw new \RuntimeException('Tidak ada respon teks yang dihasilkan dari Gemini AI.');
    }

    /**
     * Parsing JSON dari respon Gemini.
     */
    private function parseJsonResponse(string $raw): array
    {
        $clean = trim($raw);

        // Jika respons dibungkus markdown ```json ... ```
        if (str_starts_with($clean, '```')) {
            $clean = preg_replace('/^```(?:json)?\s*/i', '', $clean);
            $clean = preg_replace('/\s*```$/', '', $clean);
            $clean = trim($clean);
        }

        $decoded = json_decode($clean, true);

        if (json_last_error() !== JSON_ERROR_NONE || ! is_array($decoded)) {
            Log::warning('Gagal decode JSON dari Gemini, raw: '.$raw);

            return [];
        }

        return $decoded;
    }

    /**
     * Konversi UploadedFile atau file path/base64 menjadi array [mime_type, base64].
     */
    private function prepareImageData(UploadedFile|string $image): array
    {
        if ($image instanceof UploadedFile) {
            $mimeType = $image->getMimeType() ?: 'image/jpeg';
            $base64 = base64_encode(file_get_contents($image->getRealPath()));

            return [
                'mime_type' => $mimeType,
                'base64' => $base64,
            ];
        }

        // Jika string base64 dengan data URI scheme: data:image/png;base64,...
        if (preg_match('/^data:([^;]+);base64,(.+)$/', $image, $matches)) {
            return [
                'mime_type' => $matches[1],
                'base64' => $matches[2],
            ];
        }

        // Jika string file path
        if (file_exists($image)) {
            $mimeType = mime_content_type($image) ?: 'image/jpeg';
            $base64 = base64_encode(file_get_contents($image));

            return [
                'mime_type' => $mimeType,
                'base64' => $base64,
            ];
        }

        // Fallback anggap raw base64 string
        return [
            'mime_type' => 'image/jpeg',
            'base64' => $image,
        ];
    }

    private function ensureApiKeyConfigured(): void
    {
        if (empty($this->apiKey)) {
            throw new \InvalidArgumentException('Google Gemini API Key belum dikonfigurasi. Silakan isi API Key di menu Pengaturan > OCR & AI.');
        }
    }
}
