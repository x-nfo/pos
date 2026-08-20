<?php

namespace App\Services\Ocr\Drivers;

use App\Models\Setting;
use App\Services\Ocr\Contracts\OcrVisionDriverInterface;
use App\Services\Ocr\ProductOcrDataSanitizer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OpenRouterVisionDriver implements OcrVisionDriverInterface
{
    private string $apiKey;

    private string $model;

    private string $baseUrl;

    public function __construct(?string $apiKey = null, ?string $model = null, ?string $baseUrl = null)
    {
        $this->apiKey = $apiKey
            ?: (string) Setting::get('ocr_openrouter_api_key', config('services.ocr.openrouter.api_key', ''));

        $this->model = $model
            ?: (string) Setting::get('ocr_openrouter_model', config('services.ocr.openrouter.model', 'openai/gpt-4o-mini'));

        $configuredBaseUrl = $baseUrl
            ?: (string) Setting::get('ocr_openrouter_base_url', config('services.ocr.openrouter.base_url', 'https://openrouter.ai/api/v1/chat/completions'));

        $this->baseUrl = ! empty($configuredBaseUrl) ? $configuredBaseUrl : 'https://openrouter.ai/api/v1/chat/completions';
    }

    /**
     * Ekstraksi single product dari kemasan/label produk.
     */
    public function extractSingleProduct(UploadedFile|string $image, array $options = []): array
    {
        $this->ensureApiKeyConfigured();

        $imageDataUri = $this->prepareImageDataUri($image);

        $prompt = <<<PROMPT
Anda adalah asisten AI Vision OCR untuk Point of Sales (POS) minimarket dan ritel di Indonesia.
Analisis foto produk / kemasan ini dan ekstrak informasinya.

Identifikasi:
1. title: Nama lengkap produk dengan merek, varian rasa/tipe, dan ukuran netto/gramatur (Contoh: "Kopi Kapal Api Special Mix 10x24g", "Indomie Goreng 85g", "Aqua Air Mineral 600ml").
2. barcode: Barcode angka (EAN-13, UPC) jika angka barcode terbaca di kemasan. Jika tidak ada, berikan null.
3. sku: Kode SKU jika tertera di label rak/kemasan. Jika tidak ada, berikan null.
4. buy_price: Harga beli / modal jika tertera. Jika tidak ada, berikan 0.
5. sell_price: Harga jual / HET jika ada. Jika tidak ada, berikan 0.
6. unit: Satuan produk (PCS, BOTOL, PACK, RENCENG, DUS, BUNGKUS, KG, GRAM). Default ke "PCS".
7. category_suggestion: Rekomendasi kategori yang cocok (misal: "Makanan & Minuman", "Sembako", "Perawatan Diri", "Kebutuhan Rumah Tangga").
8. description: Deskripsi singkat produk.
9. confidence: Tingkat keyakinan deteksi dari 0.0 sampai 1.0.

Kembalikan HANYA JSON murni yang valid sesuai struktur:
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

        $rawResponse = $this->callChatApi($prompt, $imageDataUri);
        $data = $this->parseJsonResponse($rawResponse);

        return ProductOcrDataSanitizer::sanitizeSingleProduct($data);
    }

    /**
     * Ekstraksi nota/faktur pembelian (tabel multi-item).
     */
    public function extractInvoiceItems(UploadedFile|string $image, array $options = []): array
    {
        $this->ensureApiKeyConfigured();

        $imageDataUri = $this->prepareImageDataUri($image);

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
   - barcode: Barcode jika tertulis di nota.
   - sku: Kode barang / PLU jika ada.
   - qty: Kuantitas barang (angka).
   - unit: Satuan barang (PCS, DUS, SLOP, PACK, BTL, KG, dll).
   - buy_price: Harga beli / harga satuan (angka).
   - sell_price: Perkiraan harga jual (bisa 0 jika tidak ada).
   - subtotal: Total harga untuk baris item tersebut (qty * buy_price).
   - category_suggestion: Rekomendasi kategori produk.

Kembalikan HANYA JSON murni yang valid sesuai struktur:
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

        $rawResponse = $this->callChatApi($prompt, $imageDataUri);
        $data = $this->parseJsonResponse($rawResponse);

        return ProductOcrDataSanitizer::sanitizeInvoice($data);
    }

    /**
     * Uji koneksi ke API OpenRouter / OpenAI Compatible.
     */
    public function testConnection(): array
    {
        $this->ensureApiKeyConfigured();

        try {
            $req = Http::withToken($this->apiKey)
                ->timeout(15)
                ->withHeaders([
                    'HTTP-Referer' => config('app.url', 'http://localhost'),
                    'X-Title' => config('app.name', 'Point of Sales POS'),
                ]);

            $response = $req->post($this->baseUrl, [
                'model' => $this->model,
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => 'Jawab dengan 1 kata: "OK" jika koneksi API AI berhasil.',
                    ],
                ],
                'max_tokens' => 10,
            ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message' => "Koneksi ke AI Provider ({$this->model}) berhasil terhubung!",
                    'model' => $this->model,
                ];
            }

            $errorData = $response->json();
            $errorMessage = $errorData['error']['message'] ?? ($errorData['message'] ?? $response->body());

            return [
                'success' => false,
                'message' => "Gagal terhubung: {$errorMessage}",
                'status_code' => $response->status(),
            ];
        } catch (\Throwable $e) {
            Log::error('OpenRouter / Custom AI Test Connection error: '.$e->getMessage());

            return [
                'success' => false,
                'message' => 'Kesalahan koneksi: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Memastikan API Key sudah dikonfigurasi.
     */
    private function ensureApiKeyConfigured(): void
    {
        if (empty($this->apiKey)) {
            throw new \InvalidArgumentException('API Key belum dikonfigurasi. Silakan isi di Pengaturan > OCR & AI Vision.');
        }
    }

    /**
     * Panggil OpenRouter / OpenAI-Compatible Chat Completions API.
     */
    private function callChatApi(string $prompt, string $imageDataUri): string
    {
        $payload = [
            'model' => $this->model,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'text',
                            'text' => $prompt,
                        ],
                        [
                            'type' => 'image_url',
                            'image_url' => [
                                'url' => $imageDataUri,
                            ],
                        ],
                    ],
                ],
            ],
            'response_format' => [
                'type' => 'json_object',
            ],
            'temperature' => 0.1,
        ];

        try {
            $req = Http::withToken($this->apiKey)
                ->timeout(45)
                ->withHeaders([
                    'HTTP-Referer' => config('app.url', 'http://localhost'),
                    'X-Title' => config('app.name', 'Point of Sales POS'),
                ]);

            $response = $req->post($this->baseUrl, $payload);

            if (! $response->successful()) {
                $errorData = $response->json();
                $errorMessage = $errorData['error']['message'] ?? ($errorData['message'] ?? 'HTTP Error '.$response->status());
                Log::error("Custom AI Vision API Error ({$response->status()}): {$response->body()}");

                throw new \RuntimeException("Gagal memproses gambar dengan AI: {$errorMessage}");
            }

            $result = $response->json();
            $text = $result['choices'][0]['message']['content'] ?? '';

            if (empty($text)) {
                throw new \RuntimeException('Tidak ada respon teks dari AI API.');
            }

            return $text;
        } catch (\Throwable $e) {
            Log::error('Custom AI call error: '.$e->getMessage());
            throw $e;
        }
    }

    /**
     * Parsing JSON dari respon AI.
     */
    private function parseJsonResponse(string $raw): array
    {
        $clean = trim($raw);

        if (str_starts_with($clean, '```')) {
            $clean = preg_replace('/^```(?:json)?\s*/i', '', $clean);
            $clean = preg_replace('/\s*```$/', '', $clean);
            $clean = trim($clean);
        }

        $decoded = json_decode($clean, true);

        if (json_last_error() !== JSON_ERROR_NONE || ! is_array($decoded)) {
            Log::warning('Gagal decode JSON dari AI, raw: '.$raw);

            return [];
        }

        return $decoded;
    }

    /**
     * Konversi UploadedFile atau file path/base64 menjadi Data URI string.
     */
    private function prepareImageDataUri(UploadedFile|string $image): string
    {
        if (is_string($image) && str_starts_with($image, 'data:image/')) {
            return $image;
        }

        if ($image instanceof UploadedFile) {
            $mimeType = $image->getMimeType() ?: 'image/jpeg';
            $base64 = base64_encode(file_get_contents($image->getRealPath()));

            return "data:{$mimeType};base64,{$base64}";
        }

        if (is_string($image) && file_exists($image)) {
            $mimeType = mime_content_type($image) ?: 'image/jpeg';
            $base64 = base64_encode(file_get_contents($image));

            return "data:{$mimeType};base64,{$base64}";
        }

        // Fallback anggap raw base64 string
        return 'data:image/jpeg;base64,'.$image;
    }
}
