<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Services\ProductCatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductCatalogController extends Controller
{
    public function __construct(
        private readonly ProductCatalogService $catalogService
    ) {}

    /**
     * Lookup produk dari katalog referensi berdasarkan barcode atau keyword.
     */
    public function lookup(Request $request): JsonResponse
    {
        $barcode = $request->query('barcode');
        $search = $request->query('search');

        if ($barcode) {
            $product = $this->catalogService->lookupByBarcode($barcode);

            if (! $product) {
                return response()->json([
                    'success' => false,
                    'message' => 'Produk tidak ditemukan di katalog referensi.',
                ], 404);
            }

            // Cari kecocokan category_id jika ada kategori toko yang serupa
            $matchedCategoryId = null;
            if (! empty($product['category_name'])) {
                $category = Category::where('name', 'like', '%'.$product['category_name'].'%')
                    ->orWhereRaw('? LIKE CONCAT("%", name, "%")', [$product['category_name']])
                    ->first();
                $matchedCategoryId = $category?->id;
            }

            $product['category_id'] = $matchedCategoryId;

            return response()->json([
                'success' => true,
                'data' => $product,
            ]);
        }

        if ($search) {
            $results = $this->catalogService->search($search, 15);

            return response()->json([
                'success' => true,
                'data' => $results,
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Parameter barcode atau search diperlukan.',
        ], 422);
    }
}
