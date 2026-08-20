<?php

namespace App\Services\Ocr;

use App\Models\Category;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Warehouse;
use App\Services\AuditLogService;
use App\Services\Ocr\Contracts\OcrVisionDriverInterface;
use App\Services\Ocr\Drivers\GeminiVisionDriver;
use App\Services\Ocr\Drivers\MockVisionDriver;
use App\Services\Ocr\Drivers\OpenAiVisionDriver;
use App\Services\Ocr\Drivers\OpenRouterVisionDriver;
use App\Services\ProductCatalogService;
use App\Services\StockMutationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class OcrService
{
    private ?OcrVisionDriverInterface $driver = null;

    public function __construct(
        private readonly ProductCatalogService $catalogService,
        private readonly StockMutationService $stockMutationService,
        private readonly AuditLogService $auditLogService
    ) {}

    /**
     * Set driver secara manual (berguna untuk testing).
     */
    public function setDriver(OcrVisionDriverInterface $driver): self
    {
        $this->driver = $driver;

        return $this;
    }

    /**
     * Dapatkan instance driver aktif.
     */
    public function getDriver(): OcrVisionDriverInterface
    {
        if ($this->driver !== null) {
            return $this->driver;
        }

        $provider = Setting::get('ocr_provider', config('services.ocr.provider', 'gemini'));

        return match ($provider) {
            'openai' => new OpenAiVisionDriver,
            'openrouter', 'custom' => new OpenRouterVisionDriver,
            'mock', 'testing' => new MockVisionDriver,
            default => new GeminiVisionDriver,
        };
    }


    /**
     * Memindai single product dari kemasan/label produk dan mencocokkan dengan katalog toko.
     */
    public function scanSingleProduct(UploadedFile|string $image): array
    {
        $driver = $this->getDriver();
        $extracted = $driver->extractSingleProduct($image);

        $barcode = $extracted['barcode'] ?? null;
        $title = $extracted['title'] ?? '';
        $sku = $extracted['sku'] ?? null;

        // 1. Coba cari produk yang ada di database toko secara cerdas (Multi-Tier Match)
        $existingProduct = $this->findExistingProductInStore($barcode, $title, $sku);

        // 2. Jika belum ada di toko atau perlu pengayaan, cari di katalog referensi nasional 32k+
        $catalogMatch = null;
        if ($barcode) {
            $catalogMatch = $this->catalogService->lookupByBarcode($barcode);
        }

        if (! $catalogMatch && ! empty($title)) {
            $searchRef = $this->catalogService->search($title, 1);
            if (! empty($searchRef)) {
                $catalogMatch = $searchRef[0];
            }
        }

        // 3. Jika ditemukan di katalog referensi, periksa kembali apakah ada di database toko via data katalog
        if (! $existingProduct && $catalogMatch) {
            $existingProduct = $this->findExistingProductInStore(
                $catalogMatch['barcode'] ?? null,
                $catalogMatch['title'] ?? null,
                $catalogMatch['sku'] ?? null
            );
        }

        // 4. Cocokkan kategori dengan kategori toko yang tersedia
        $matchedCategoryId = $existingProduct?->category_id;
        $categoryNameToMatch = $extracted['category_suggestion'] ?? ($catalogMatch['category_name'] ?? null);

        if (! $matchedCategoryId && $categoryNameToMatch) {
            $category = Category::where('name', 'like', '%'.$categoryNameToMatch.'%')
                ->orWhereRaw('? LIKE CONCAT("%", name, "%")', [$categoryNameToMatch])
                ->first();
            $matchedCategoryId = $category?->id;
        }

        if (! $matchedCategoryId) {
            $firstCat = Category::first();
            $matchedCategoryId = $firstCat?->id;
        }

        // 5. Perkaya data jika ditemukan di katalog referensi / existing product
        $finalBarcode = $existingProduct?->barcode
            ?: ($barcode ?: ($catalogMatch['barcode'] ?? null));

        $finalTitle = $existingProduct?->title
            ?: (! empty($catalogMatch['title']) && strlen($catalogMatch['title']) > strlen($title)
                ? $catalogMatch['title']
                : $title);

        $buyPrice = $existingProduct?->buy_price
            ?: ($extracted['buy_price'] > 0
                ? $extracted['buy_price']
                : ($catalogMatch['buy_price'] ?? 0));

        $sellPrice = $existingProduct?->sell_price
            ?: ($extracted['sell_price'] > 0
                ? $extracted['sell_price']
                : ($catalogMatch['sell_price'] ?? 0));

        if ($sellPrice <= 0 && $buyPrice > 0) {
            $defaultMargin = (float) Setting::get('ocr_default_margin_percentage', 20.0);
            $sellPrice = (int) round($buyPrice * (1 + ($defaultMargin / 100)));
        }

        return [
            'success' => true,
            'data' => [
                'id' => $existingProduct?->id,
                'title' => $finalTitle,
                'barcode' => $finalBarcode,
                'sku' => $existingProduct?->sku ?: ($extracted['sku'] ?: ($catalogMatch['sku'] ?? null)),
                'buy_price' => (int) $buyPrice,
                'sell_price' => (int) $sellPrice,
                'stock' => $existingProduct?->stock ?? 10,
                'unit' => $extracted['unit'] ?: ($catalogMatch['unit'] ?? 'PCS'),
                'category_id' => $matchedCategoryId,
                'category_suggestion' => $categoryNameToMatch,
                'description' => $extracted['description'] ?: ($catalogMatch['title'] ?? $finalTitle),
                'confidence' => $extracted['confidence'] ?? 0.9,
                'is_existing' => (bool) $existingProduct,
                'existing_product' => $existingProduct ? [
                    'id' => $existingProduct->id,
                    'title' => $existingProduct->title,
                    'barcode' => $existingProduct->barcode,
                    'sku' => $existingProduct->sku,
                    'image' => $existingProduct->image,
                    'stock' => $existingProduct->stock,
                    'buy_price' => $existingProduct->buy_price,
                    'sell_price' => $existingProduct->sell_price,
                    'category_id' => $existingProduct->category_id,
                    'description' => $existingProduct->description,
                ] : null,
                'from_catalog' => (bool) $catalogMatch,
            ],
        ];
    }

    /**
     * Memindai faktur / nota pembelian multi-item.
     */
    public function scanInvoice(UploadedFile|string $image): array
    {
        $driver = $this->getDriver();
        $extracted = $driver->extractInvoiceItems($image);

        $categories = Category::all();
        $enrichedItems = [];

        foreach ($extracted['items'] as $item) {
            $barcode = $item['barcode'] ?? null;
            $title = $item['title'] ?? '';
            $sku = $item['sku'] ?? null;

            // Cek apakah produk sudah ada di database toko secara cerdas
            $existingProduct = $this->findExistingProductInStore($barcode, $title, $sku);

            // Cari kategori yang cocok
            $matchedCategoryId = $existingProduct?->category_id;
            if (! $matchedCategoryId && ! empty($item['category_suggestion'])) {
                $cat = $categories->first(function ($c) use ($item) {
                    return str_contains(strtolower($c->name), strtolower($item['category_suggestion']))
                        || str_contains(strtolower($item['category_suggestion']), strtolower($c->name));
                });
                $matchedCategoryId = $cat?->id;
            }

            if (! $matchedCategoryId && $categories->isNotEmpty()) {
                $matchedCategoryId = $categories->first()->id;
            }

            $enrichedItems[] = [
                'title' => $existingProduct?->title ?: $title,
                'barcode' => $existingProduct?->barcode ?: $barcode,
                'sku' => $existingProduct?->sku ?: ($sku ?: null),
                'qty' => $item['qty'],
                'buy_price' => (int) $item['buy_price'],
                'sell_price' => (int) ($existingProduct?->sell_price ?: $item['sell_price']),
                'unit' => $item['unit'] ?? 'PCS',
                'subtotal' => (int) $item['subtotal'],
                'category_id' => $matchedCategoryId,
                'category_name' => $item['category_suggestion'] ?? null,
                'is_existing' => (bool) $existingProduct,
                'existing_product_id' => $existingProduct?->id,
                'existing_stock' => $existingProduct?->stock ?? 0,
                'action' => $existingProduct ? 'update_stock' : 'create_new',
            ];
        }

        return [
            'success' => true,
            'invoice_number' => $extracted['invoice_number'] ?? null,
            'supplier_name' => $extracted['supplier_name'] ?? null,
            'invoice_date' => $extracted['invoice_date'] ?? now()->toDateString(),
            'total_amount' => $extracted['total_amount'] ?? 0,
            'total_items_count' => count($enrichedItems),
            'items' => $enrichedItems,
        ];
    }

    /**
     * Mencari produk yang cocok di database toko menggunakan multi-tier matching:
     * 1. Exact Barcode & Zero-stripped barcode
     * 2. SKU matching
     * 3. Exact Title matching (case-insensitive)
     * 4. Multi-token keyword matching (e.g. "Chitato", "Sapi", "Panggang", "68g")
     * 5. Fuzzy similarity percentage (>65%)
     */
    public function findExistingProductInStore(?string $barcode, ?string $title, ?string $sku = null): ?Product
    {
        // 1. Cek Barcode jika ada
        if (! empty($barcode)) {
            $cleanBarcode = preg_replace('/[^A-Za-z0-9]/', '', $barcode);
            $trimmedBarcode = ltrim($cleanBarcode, '0');

            $product = Product::where('barcode', $barcode)
                ->orWhere('barcode', $cleanBarcode)
                ->when($trimmedBarcode !== '', function ($q) use ($trimmedBarcode) {
                    $q->orWhere('barcode', $trimmedBarcode)
                        ->orWhere('barcode', '0'.$trimmedBarcode);
                })
                ->first();

            if ($product) {
                return $product;
            }
        }

        // 2. Cek SKU jika ada
        if (! empty($sku)) {
            $product = Product::where('sku', $sku)->first();
            if ($product) {
                return $product;
            }
        }

        if (empty($title)) {
            return null;
        }

        $cleanTitle = trim($title);

        // 3. Exact match title (case-insensitive)
        $product = Product::whereRaw('LOWER(TRIM(title)) = ?', [strtolower($cleanTitle)])->first();
        if ($product) {
            return $product;
        }

        // 4. Substring LIKE title
        $product = Product::where('title', 'like', '%'.$cleanTitle.'%')
            ->orWhereRaw('? LIKE CONCAT("%", title, "%")', [$cleanTitle])
            ->first();
        if ($product) {
            return $product;
        }

        // 5. Token-based Keyword Matching (e.g. "Indomie", "Goreng", "85g")
        $words = preg_split('/[\s,\-_.\/]+/', strtolower($cleanTitle));
        $stopwords = ['dan', 'isi', 'rasa', 'kemasan', 'bungkus', 'botol', 'pack', 'pcs', 'box', 'netto', 'gram', 'liter', 'with', 'the', 'dan', 'atau'];
        $keywords = array_values(array_filter($words, fn ($w) => strlen($w) >= 3 && ! in_array($w, $stopwords)));

        if (! empty($keywords)) {
            // Coba query dengan semua kata kunci penting
            $query = Product::query();
            foreach ($keywords as $kw) {
                $query->where('title', 'like', '%'.$kw.'%');
            }
            $product = $query->first();
            if ($product) {
                return $product;
            }

            // Jika kata kunci >= 2, coba kombinasi 2 kata pertama
            if (count($keywords) >= 2) {
                $product = Product::where('title', 'like', '%'.$keywords[0].'%')
                    ->where('title', 'like', '%'.$keywords[1].'%')
                    ->first();
                if ($product) {
                    return $product;
                }
            }

            // 6. Similarity Scoring dari kandidat produk toko
            $candidates = Product::where('title', 'like', '%'.$keywords[0].'%')
                ->limit(25)
                ->get();

            $bestMatch = null;
            $bestScore = 0;

            foreach ($candidates as $cand) {
                similar_text(strtolower($cand->title), strtolower($cleanTitle), $percent);
                if ($percent > $bestScore && $percent >= 65.0) {
                    $bestScore = $percent;
                    $bestMatch = $cand;
                }
            }

            if ($bestMatch) {
                return $bestMatch;
            }
        }

        return null;
    }


    /**
     * Simpan batch produk hasil scan faktur ke database toko.
     *
     * @param  array  $items  Daftar item yang sudah dikonfirmasi oleh pengguna
     */
    public function batchStoreInvoiceProducts(array $items, ?int $userId = null): array
    {
        $defaultWarehouse = Warehouse::active()->first();
        $defaultWarehouseId = $defaultWarehouse?->id;

        $createdCount = 0;
        $updatedCount = 0;
        $errors = [];

        DB::beginTransaction();

        try {
            foreach ($items as $index => $item) {
                $title = trim($item['title'] ?? '');
                if (empty($title)) {
                    continue;
                }

                $barcode = ! empty($item['barcode'])
                    ? trim($item['barcode'])
                    : ('AUTO-'.strtoupper(Str::random(10)));

                $sku = ! empty($item['sku'])
                    ? trim($item['sku'])
                    : ('PRD-'.strtoupper(Str::random(6)));

                $categoryId = ! empty($item['category_id']) ? (int) $item['category_id'] : Category::first()?->id;
                $buyPrice = max(0, (int) ($item['buy_price'] ?? 0));
                $sellPrice = max($buyPrice, (int) ($item['sell_price'] ?? $buyPrice));
                $qty = max(0, (int) ($item['qty'] ?? 1));
                $action = $item['action'] ?? 'create_new';

                // Cek existing by ID atau Barcode
                $existingProduct = null;
                if (! empty($item['existing_product_id'])) {
                    $existingProduct = Product::find($item['existing_product_id']);
                } elseif (! empty($item['barcode'])) {
                    $existingProduct = Product::where('barcode', $item['barcode'])->first();
                }

                if ($existingProduct && $action === 'update_stock') {
                    // Update stok produk yang sudah ada
                    $before = $this->productAuditPayload($existingProduct);
                    $newStock = $existingProduct->stock + $qty;

                    $existingProduct->update([
                        'stock' => $newStock,
                        'buy_price' => $buyPrice > 0 ? $buyPrice : $existingProduct->buy_price,
                        'sell_price' => $sellPrice > 0 ? $sellPrice : $existingProduct->sell_price,
                    ]);

                    if ($defaultWarehouseId) {
                        $wh = $existingProduct->warehouses()->where('warehouse_id', $defaultWarehouseId)->first();
                        $currentWhStock = $wh?->pivot->stock ?? 0;
                        $existingProduct->warehouses()->syncWithoutDetaching([
                            $defaultWarehouseId => ['stock' => $currentWhStock + $qty],
                        ]);
                    }

                    $this->auditLogService->log(
                        event: 'product.stock_updated_via_ocr',
                        module: 'products',
                        auditable: $existingProduct,
                        description: "Stok produk ditambahkan sebanyak {$qty} via OCR Faktur.",
                        before: $before,
                        after: $this->productAuditPayload($existingProduct->fresh())
                    );

                    $updatedCount++;
                } else {
                    // Jika barcode sudah dipakai produk lain dan mau buat baru, generate barcode unik
                    if (Product::where('barcode', $barcode)->exists()) {
                        $barcode = $barcode.'-'.rand(100, 999);
                    }

                    if (Product::where('sku', $sku)->exists()) {
                        $sku = 'PRD-'.strtoupper(Str::random(6));
                    }

                    $product = Product::create([
                        'image' => '',
                        'barcode' => $barcode,
                        'sku' => $sku,
                        'title' => $title,
                        'description' => $title,
                        'category_id' => $categoryId,
                        'buy_price' => $buyPrice,
                        'sell_price' => $sellPrice,
                        'stock' => $qty,
                        'min_stock' => 0,
                        'max_stock' => 0,
                    ]);

                    if ($defaultWarehouseId) {
                        $product->warehouses()->attach($defaultWarehouseId, ['stock' => $qty]);
                    }

                    $this->stockMutationService->recordInitialStock($product, $userId);

                    $this->auditLogService->log(
                        event: 'product.created_via_ocr',
                        module: 'products',
                        auditable: $product,
                        description: 'Produk baru dibuat dari scan OCR Faktur.',
                        after: $this->productAuditPayload($product->fresh())
                    );

                    $createdCount++;
                }
            }

            DB::commit();

            return [
                'success' => true,
                'created_count' => $createdCount,
                'updated_count' => $updatedCount,
                'total_processed' => $createdCount + $updatedCount,
                'message' => "Berhasil memproses {$createdCount} produk baru dan memperbarui {$updatedCount} produk.",
            ];
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Batch store OCR error: '.$e->getMessage());

            throw $e;
        }
    }

    private function productAuditPayload(Product $product): array
    {
        return $this->auditLogService->only($product->toArray(), [
            'title',
            'barcode',
            'sku',
            'buy_price',
            'sell_price',
            'stock',
            'category_id',
        ]);
    }
}
