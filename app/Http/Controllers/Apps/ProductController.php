<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProductRequest;
use App\Http\Requests\UpdateProductRequest;
use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use App\Models\Warehouse;
use App\Services\AuditLogService;
use App\Services\StockMutationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;

class ProductController extends Controller
{
    public function __construct(
        private readonly StockMutationService $stockMutationService,
        private readonly AuditLogService $auditLogService
    ) {}

    /**
     * Display a listing of the resource.
     *
     * @return Response
     */
    public function index(Request $request)
    {
        $filters = [
            'search' => $request->input('search'),
            'warehouse_id' => $request->input('warehouse_id'),
        ];

        $warehouseId = $filters['warehouse_id'] ? (int) $filters['warehouse_id'] : null;

        $products = Product::query()
            ->when($filters['search'], function ($q, $search) {
                $q->where(function ($sub) use ($search) {
                    $sub->where('title', 'like', '%'.$search.'%')
                        ->orWhere('barcode', 'like', '%'.$search.'%')
                        ->orWhere('sku', 'like', '%'.$search.'%');
                });
            })
            ->when($warehouseId, function ($q) use ($warehouseId) {
                $q->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $warehouseId));
            })
            ->with(['category:id,name', 'warehouses:id,code,name,type', 'units'])
            ->latest()
            ->paginate($this->perPage())
            ->withQueryString();

        $warehouses = Warehouse::active()->orderBy('sort_order')->orderBy('code')->get(['id', 'code', 'name', 'type']);

        $products->through(function (Product $product) use ($warehouseId, $warehouses) {
            $warehouseStocks = $warehouses->map(function ($w) use ($product) {
                $whPivot = $product->warehouses->firstWhere('id', $w->id);

                return [
                    'id' => $w->id,
                    'code' => $w->code,
                    'name' => $w->name,
                    'type' => $w->type,
                    'stock' => (int) ($whPivot?->pivot->stock ?? 0),
                ];
            });

            $totalStock = (int) $warehouseStocks->sum('stock');
            if ($totalStock === 0 && ! $product->warehouses->isNotEmpty()) {
                $totalStock = (int) $product->stock;
            }

            $currentStock = $warehouseId
                ? (int) ($product->warehouses->firstWhere('id', $warehouseId)?->pivot->stock ?? 0)
                : $totalStock;

            return [
                ...$product->toArray(),
                'stock' => $currentStock,
                'total_stock' => $totalStock,
                'warehouse_stocks' => $warehouseStocks->values()->toArray(),
            ];
        });

        return Inertia::render('Dashboard/Products/Index', [
            'products' => $products,
            'warehouses' => $warehouses,
            'filters' => $filters,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return Response
     */
    public function create()
    {
        // get categories
        $categories = Category::all();
        $units = Unit::orderBy('name')->get(['id', 'code', 'name', 'symbol']);
        $warehouses = Warehouse::active()->orderBy('sort_order')->orderBy('code')->get(['id', 'code', 'name', 'type']);

        // return inertia
        return Inertia::render('Dashboard/Products/Create', [
            'categories' => $categories,
            'units' => $units,
            'warehouses' => $warehouses,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @return Response
     */
    public function store(StoreProductRequest $request)
    {
        $product = DB::transaction(function () use ($request) {
            $imageName = '';
            if ($request->hasFile('image')) {
                $image = $request->file('image');
                $image->storeAs('public/products', $image->hashName());
                $imageName = $image->hashName();
            }

            $warehouseStocksInput = $request->input('warehouse_stocks', []);
            $calculatedTotalStock = 0;
            $normalizedWarehouseStocks = [];

            if (is_array($warehouseStocksInput) && count($warehouseStocksInput) > 0) {
                foreach ($warehouseStocksInput as $key => $val) {
                    if (is_array($val) && isset($val['warehouse_id'])) {
                        $wId = (int) $val['warehouse_id'];
                        $qty = max(0, (int) ($val['stock'] ?? 0));
                    } else {
                        $wId = (int) $key;
                        $qty = max(0, (int) $val);
                    }
                    if ($wId > 0) {
                        $normalizedWarehouseStocks[$wId] = $qty;
                        $calculatedTotalStock += $qty;
                    }
                }
            }

            $finalStock = count($normalizedWarehouseStocks) > 0
                ? $calculatedTotalStock
                : (int) ($request->input('stock') ?? 0);

            // create product
            $product = Product::create([
                'image' => $imageName,
                'barcode' => $request->barcode,
                'sku' => $request->sku,
                'title' => $request->title,
                'description' => $request->description ?? '',
                'category_id' => $request->category_id,
                'buy_price' => $request->buy_price,
                'sell_price' => $request->sell_price,
                'stock' => $finalStock,
                'min_stock' => $request->min_stock ?? 0,
                'max_stock' => $request->max_stock ?? 0,
            ]);

            if ($request->has('units')) {
                $this->syncProductUnits($product, $request->input('units'));
            }

            $allActiveWarehouses = Warehouse::active()->orderBy('sort_order')->orderBy('code')->get();

            if (count($normalizedWarehouseStocks) > 0) {
                $syncPayload = [];
                foreach ($allActiveWarehouses as $w) {
                    $qty = $normalizedWarehouseStocks[$w->id] ?? 0;
                    $syncPayload[$w->id] = ['stock' => $qty];
                }
                $product->warehouses()->sync($syncPayload);

                foreach ($normalizedWarehouseStocks as $wId => $qty) {
                    if ($qty > 0) {
                        $this->stockMutationService->recordInitialStock(
                            product: $product,
                            userId: $request->user()?->id,
                            warehouseId: $wId,
                            qty: $qty
                        );
                    }
                }
            } else {
                $defaultWarehouse = $allActiveWarehouses->first();
                if ($defaultWarehouse) {
                    $syncPayload = [];
                    foreach ($allActiveWarehouses as $w) {
                        $syncPayload[$w->id] = ['stock' => $w->id === $defaultWarehouse->id ? $finalStock : 0];
                    }
                    $product->warehouses()->sync($syncPayload);
                }

                if ($finalStock > 0) {
                    $this->stockMutationService->recordInitialStock(
                        product: $product,
                        userId: $request->user()?->id,
                        warehouseId: $defaultWarehouse?->id,
                        qty: $finalStock
                    );
                }
            }

            $this->auditLogService->log(
                event: 'product.created',
                module: 'products',
                auditable: $product,
                description: 'Produk baru dibuat.',
                after: $this->productAuditPayload($product->fresh())
            );

            return $product;
        });

        // redirect
        return to_route('products.index');
    }

    /**
     * Quick store a product from POS (e.g. from Reference Catalog).
     */
    public function quickStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'barcode' => 'required|string|max:100|unique:products,barcode',
            'sku' => 'nullable|string|max:100|unique:products,sku',
            'title' => 'required|string|max:255',
            'category_id' => 'required|exists:categories,id',
            'buy_price' => 'required|numeric|min:0',
            'sell_price' => 'required|numeric|min:0',
            'stock' => 'required|integer|min:0',
            'min_stock' => 'nullable|integer|min:0',
            'max_stock' => 'nullable|integer|min:0',
            'description' => 'nullable|string',
            'image' => 'nullable|string',
        ]);

        $product = DB::transaction(function () use ($validated, $request) {
            $sku = ! empty($validated['sku'])
                ? $validated['sku']
                : ('PRD-'.strtoupper(Str::random(6)));

            $image = ! empty($validated['image']) ? $validated['image'] : '';

            $product = Product::create([
                'image' => $image,
                'barcode' => $validated['barcode'],
                'sku' => $sku,
                'title' => $validated['title'],
                'description' => $validated['description'] ?? $validated['title'],
                'category_id' => (int) $validated['category_id'],
                'buy_price' => (int) $validated['buy_price'],
                'sell_price' => (int) $validated['sell_price'],
                'stock' => (int) $validated['stock'],
                'min_stock' => (int) ($validated['min_stock'] ?? 0),
                'max_stock' => (int) ($validated['max_stock'] ?? 0),
            ]);

            $defaultWarehouse = Warehouse::active()->orderBy('code')->first();
            if ($defaultWarehouse && (int) $validated['stock'] > 0) {
                $product->warehouses()->syncWithoutDetaching([
                    $defaultWarehouse->id => ['stock' => (int) $validated['stock']],
                ]);
            }

            $this->stockMutationService->recordInitialStock(
                $product,
                $request->user()?->id,
                $defaultWarehouse?->id
            );

            $this->auditLogService->log(
                event: 'product.created',
                module: 'products',
                auditable: $product,
                description: 'Produk dibuat cepat dari POS.',
                after: $this->productAuditPayload($product->fresh())
            );

            return $product;
        });

        $product->load('category');

        return response()->json([
            'success' => true,
            'message' => 'Produk berhasil ditambahkan.',
            'data' => $product,
        ], 201);
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return Response
     */
    public function edit(Product $product)
    {
        // get categories
        $categories = Category::all();
        $units = Unit::orderBy('name')->get(['id', 'code', 'name', 'symbol']);

        return Inertia::render('Dashboard/Products/Edit', [
            'product' => $product->load('units'),
            'categories' => $categories,
            'units' => $units,
        ]);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  int  $id
     * @return Response
     */
    public function update(UpdateProductRequest $request, Product $product)
    {
        $before = $this->productAuditPayload($product);

        DB::transaction(function () use ($request, $product, $before) {
            // check image update
            if ($request->file('image')) {
                // remove old image
                if ($product->image) {
                    Storage::disk('local')->delete('public/products/'.basename($product->image));
                }

                // upload new image
                $image = $request->file('image');
                $image->storeAs('public/products', $image->hashName());

                // update product with new image
                $product->update([
                    'image' => $image->hashName(),
                    'barcode' => $request->barcode,
                    'sku' => $request->sku,
                    'title' => $request->title,
                    'description' => $request->description ?? '',
                    'category_id' => $request->category_id,
                    'buy_price' => $request->buy_price,
                    'sell_price' => $request->sell_price,
                    'min_stock' => $request->min_stock ?? 0,
                    'max_stock' => $request->max_stock ?? 0,
                ]);
            } else {
                // update product without image
                $product->update([
                    'barcode' => $request->barcode,
                    'sku' => $request->sku,
                    'title' => $request->title,
                    'description' => $request->description ?? '',
                    'category_id' => $request->category_id,
                    'buy_price' => $request->buy_price,
                    'sell_price' => $request->sell_price,
                    'min_stock' => $request->min_stock ?? 0,
                    'max_stock' => $request->max_stock ?? 0,
                ]);
            }

            if ($request->has('units')) {
                $this->syncProductUnits($product, $request->input('units'));
            }

            $this->logProductUpdate($product, $before);
        });

        // redirect
        return to_route('products.index');
    }

    private function syncProductUnits(Product $product, ?array $units): void
    {
        if ($units === null) {
            return;
        }

        $syncData = [];
        $hasBase = false;

        foreach ($units as $u) {
            if (empty($u['unit_id'])) {
                continue;
            }

            $unitId = (int) $u['unit_id'];
            $isBase = ! empty($u['is_base']);
            if ($isBase) {
                $hasBase = true;
            }

            $conversionFactor = $isBase ? 1.0000 : (float) ($u['conversion_factor'] ?? 1);

            if ($isBase) {
                $buyPrice = (int) $product->buy_price;
                $sellPrice = (int) $product->sell_price;
            } else {
                $buyPrice = isset($u['buy_price']) && $u['buy_price'] !== '' && $u['buy_price'] !== null
                    ? (int) $u['buy_price']
                    : (int) $product->buy_price;
                $sellPrice = isset($u['sell_price']) && $u['sell_price'] !== '' && $u['sell_price'] !== null
                    ? (int) $u['sell_price']
                    : (int) $product->sell_price;
            }

            $syncData[$unitId] = [
                'is_base' => $isBase,
                'conversion_factor' => $conversionFactor,
                'buy_price' => $buyPrice,
                'sell_price' => $sellPrice,
                'barcode' => ! empty($u['barcode']) ? $u['barcode'] : null,
                'sku_suffix' => ! empty($u['sku_suffix']) ? $u['sku_suffix'] : null,
            ];
        }

        if (! empty($syncData) && ! $hasBase) {
            $firstKey = array_key_first($syncData);
            $syncData[$firstKey]['is_base'] = true;
            $syncData[$firstKey]['conversion_factor'] = 1.0000;
        }

        $product->units()->sync($syncData);
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return Response
     */
    public function destroy($id)
    {
        // find by ID
        $product = Product::findOrFail($id);

        if ($product->hasHistoricalRelations()) {
            return back()->with('error', 'Produk tidak dapat dihapus karena sudah memiliki riwayat transaksi atau sisa stok.');
        }

        $before = $this->productAuditPayload($product);

        // remove image
        if ($product->image) {
            Storage::disk('local')->delete('public/products/'.basename($product->image));
        }

        // clean initial stock mutation
        $product->stockMutations()->delete();

        // delete
        $product->delete();

        $this->auditLogService->log(
            event: 'product.deleted',
            module: 'products',
            auditable: $product,
            description: 'Produk dihapus.',
            before: $before
        );

        // redirect
        return back()->with('success', 'Produk berhasil dihapus.');
    }

    private function logProductUpdate(Product $product, array $before): void
    {
        $after = $this->productAuditPayload($product->fresh());

        $this->auditLogService->log(
            event: 'product.updated',
            module: 'products',
            auditable: $product,
            description: 'Data produk diperbarui.',
            before: $before,
            after: $after
        );

        if (
            (int) $before['buy_price'] !== (int) $after['buy_price']
            || (int) $before['sell_price'] !== (int) $after['sell_price']
        ) {
            $this->auditLogService->log(
                event: 'product.price_updated',
                module: 'products',
                auditable: $product,
                description: 'Harga produk diperbarui.',
                before: [
                    'buy_price' => $before['buy_price'],
                    'sell_price' => $before['sell_price'],
                ],
                after: [
                    'buy_price' => $after['buy_price'],
                    'sell_price' => $after['sell_price'],
                ]
            );
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
            'min_stock',
            'max_stock',
            'category_id',
        ]);
    }
}
