<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Services\Ocr\OcrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ProductOcrController extends Controller
{
    public function __construct(
        private readonly OcrService $ocrService
    ) {}

    /**
     * Memindai foto kemasan/label single product.
     */
    public function scanSingle(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'nullable|file|mimes:jpeg,jpg,png,webp|max:10240',
            'image_base64' => 'nullable|string',
        ]);

        $image = $request->file('image') ?: $request->input('image_base64');

        if (! $image) {
            return response()->json([
                'success' => false,
                'message' => 'Foto atau gambar produk harus diunggah.',
            ], 422);
        }

        try {
            $result = $this->ocrService->scanSingleProduct($image);

            return response()->json($result);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'code' => 'API_KEY_MISSING',
            ], 400);
        } catch (\Throwable $e) {
            Log::error('OCR scan single error: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Gagal memproses gambar OCR: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Memindai foto nota / faktur belanja multi-item.
     */
    public function scanInvoice(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'nullable|file|mimes:jpeg,jpg,png,webp,pdf|max:15360',
            'image_base64' => 'nullable|string',
        ]);

        $image = $request->file('image') ?: $request->input('image_base64');

        if (! $image) {
            return response()->json([
                'success' => false,
                'message' => 'Foto faktur/nota harus diunggah.',
            ], 422);
        }

        try {
            $result = $this->ocrService->scanInvoice($image);

            return response()->json($result);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'code' => 'API_KEY_MISSING',
            ], 400);
        } catch (\Throwable $e) {
            Log::error('OCR scan invoice error: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Gagal memproses faktur OCR: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Batch store produk hasil konfirmasi scan faktur.
     */
    public function batchStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.title' => 'required|string|max:255',
            'items.*.barcode' => 'nullable|string|max:100',
            'items.*.sku' => 'nullable|string|max:100',
            'items.*.category_id' => 'nullable|integer',
            'items.*.buy_price' => 'required|numeric|min:0',
            'items.*.sell_price' => 'required|numeric|min:0',
            'items.*.qty' => 'required|integer|min:1',
            'items.*.unit' => 'nullable|string|max:50',
            'items.*.action' => 'nullable|string|in:create_new,update_stock,ignore',
            'items.*.existing_product_id' => 'nullable|integer|exists:products,id',
        ]);

        try {
            $result = $this->ocrService->batchStoreInvoiceProducts(
                $validated['items'],
                $request->user()?->id
            );

            return response()->json($result, 201);
        } catch (\Throwable $e) {
            Log::error('OCR batch store error: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Gagal menyimpan batch produk: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Test koneksi ke AI Vision driver.
     */
    public function testConnection(Request $request): JsonResponse
    {
        try {
            $provider = $request->input('provider');

            if ($provider) {
                $apiKey = $request->input('api_key');
                $model = $request->input('model');
                $baseUrl = $request->input('base_url');

                $driver = match ($provider) {
                    'openai' => new \App\Services\Ocr\Drivers\OpenAiVisionDriver($apiKey, $model),
                    'openrouter', 'custom' => new \App\Services\Ocr\Drivers\OpenRouterVisionDriver($apiKey, $model, $baseUrl),
                    'mock', 'testing' => new \App\Services\Ocr\Drivers\MockVisionDriver(),
                    default => new \App\Services\Ocr\Drivers\GeminiVisionDriver($apiKey, $model),
                };

                $result = $driver->testConnection();
            } else {
                $result = $this->ocrService->getDriver()->testConnection();
            }

            return response()->json($result, ($result['success'] ?? false) ? 200 : 400);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal menguji koneksi: '.$e->getMessage(),
            ], 500);
        }
    }

}
