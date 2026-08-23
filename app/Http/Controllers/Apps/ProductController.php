<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use App\Models\Warehouse;
use App\Services\AuditLogService;
use App\Services\StockMutationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
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
        $products = Product::when($request->search, function ($products, $search) {
            $products = $products->where('title', 'like', '%'.$search.'%');
        })->with('category')->latest()->paginate($this->perPage())->withQueryString();

        $warehouses = Warehouse::active()->orderBy('code')->get(['id', 'code', 'name']);

        return Inertia::render('Dashboard/Products/Index', [
            'products' => $products,
            'warehouses' => $warehouses,
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

        // return inertia
        return Inertia::render('Dashboard/Products/Create', [
            'categories' => $categories,
            'units' => $units,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @return Response
     */
    public function store(Request $request)
    {
        /**
         * validate
         */
        $request->validate([
            'barcode' => 'required|unique:products,barcode',
            'sku' => 'required|unique:products,sku',
            'title' => 'required',
            'description' => 'required',
            'category_id' => 'required',
            'buy_price' => 'required',
            'sell_price' => 'required',
            'stock' => 'required|integer|min:0',
            'min_stock' => 'nullable|integer|min:0',
            'max_stock' => 'nullable|integer|min:0',
            'units' => 'nullable|array',
            'units.*.unit_id' => 'required_with:units|exists:units,id',
            'units.*.is_base' => 'nullable|boolean',
            'units.*.conversion_factor' => 'nullable|numeric|min:0.0001',
            'units.*.buy_price' => 'nullable|numeric|min:0',
            'units.*.sell_price' => 'nullable|numeric|min:0',
            'units.*.barcode' => 'nullable|string|max:100',
            'units.*.sku_suffix' => 'nullable|string|max:20',
        ]);
        $imageName = '';
        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $image->storeAs('public/products', $image->hashName());
            $imageName = $image->hashName();
        }

        // create product
        $product = Product::create([
            'image' => $imageName,
            'barcode' => $request->barcode,
            'sku' => $request->sku,
            'title' => $request->title,
            'description' => $request->description,
            'category_id' => $request->category_id,
            'buy_price' => $request->buy_price,
            'sell_price' => $request->sell_price,
            'stock' => $request->stock,
            'min_stock' => $request->min_stock ?? 0,
            'max_stock' => $request->max_stock ?? 0,
        ]);

        if ($request->has('units')) {
            $this->syncProductUnits($product, $request->input('units'));
        }

        $this->stockMutationService->recordInitialStock($product, $request->user()?->id);
        $this->auditLogService->log(
            event: 'product.created',
            module: 'products',
            auditable: $product,
            description: 'Produk baru dibuat.',
            after: $this->productAuditPayload($product->fresh())
        );

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

        $this->stockMutationService->recordInitialStock($product, $request->user()?->id);
        $this->auditLogService->log(
            event: 'product.created',
            module: 'products',
            auditable: $product,
            description: 'Produk dibuat cepat dari POS.',
            after: $this->productAuditPayload($product->fresh())
        );

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
    public function update(Request $request, Product $product)
    {
        $before = $this->productAuditPayload($product);

        /**
         * validate
         */
        $request->validate([
            'barcode' => 'required|unique:products,barcode,'.$product->id,
            'sku' => 'required|unique:products,sku,'.$product->id,
            'title' => 'required',
            'description' => 'required',
            'category_id' => 'required',
            'buy_price' => 'required',
            'sell_price' => 'required',
            'min_stock' => 'nullable|integer|min:0',
            'max_stock' => 'nullable|integer|min:0',
            'units' => 'nullable|array',
            'units.*.unit_id' => 'required_with:units|exists:units,id',
            'units.*.is_base' => 'nullable|boolean',
            'units.*.conversion_factor' => 'nullable|numeric|min:0.0001',
            'units.*.buy_price' => 'nullable|numeric|min:0',
            'units.*.sell_price' => 'nullable|numeric|min:0',
            'units.*.barcode' => 'nullable|string|max:100',
            'units.*.sku_suffix' => 'nullable|string|max:20',
        ]);

        // check image update
        if ($request->file('image')) {

            // remove old image
            Storage::disk('local')->delete('public/products/'.basename($product->image));

            // upload new image
            $image = $request->file('image');
            $image->storeAs('public/products', $image->hashName());

            // update product with new image
            $product->update([
                'image' => $image->hashName(),
                'barcode' => $request->barcode,
                'sku' => $request->sku,
                'title' => $request->title,
                'description' => $request->description,
                'category_id' => $request->category_id,
                'buy_price' => $request->buy_price,
                'sell_price' => $request->sell_price,
                'min_stock' => $request->min_stock ?? 0,
                'max_stock' => $request->max_stock ?? 0,
            ]);

            if ($request->has('units')) {
                $this->syncProductUnits($product, $request->input('units'));
            }

            $this->logProductUpdate($product, $before);

            return to_route('products.index');
        }

        // update product without image
        $product->update([
            'barcode' => $request->barcode,
            'sku' => $request->sku,
            'title' => $request->title,
            'description' => $request->description,
            'category_id' => $request->category_id,
            'buy_price' => $request->buy_price,
            'sell_price' => $request->sell_price,
            'min_stock' => $request->min_stock ?? 0,
            'max_stock' => $request->max_stock ?? 0,
        ]);

        if ($request->has('units')) {
            $this->syncProductUnits($product, $request->input('units'));
        }

        $this->logProductUpdate($product, $before);

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
            $buyPrice = isset($u['buy_price']) && $u['buy_price'] !== '' && $u['buy_price'] !== null
                ? (int) $u['buy_price']
                : (int) $product->buy_price;
            $sellPrice = isset($u['sell_price']) && $u['sell_price'] !== '' && $u['sell_price'] !== null
                ? (int) $u['sell_price']
                : (int) $product->sell_price;

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
        $before = $this->productAuditPayload($product);

        // remove image
        Storage::disk('local')->delete('public/products/'.basename($product->image));

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
        return back();
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
