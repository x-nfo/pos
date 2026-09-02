<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreStockOpnameItemRequest;
use App\Http\Requests\StoreStockOpnameRequest;
use App\Http\Requests\UpdateStockOpnameItemRequest;
use App\Http\Requests\UpdateStockOpnameRequest;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Models\Warehouse;
use App\Services\AuditLogService;
use App\Services\StockMutationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class StockOpnameController extends Controller
{
    public function __construct(
        private readonly StockMutationService $stockMutationService,
        private readonly AuditLogService $auditLogService
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $warehouseId = $user && ! $user->isHQ() ? $user->warehouse_id : $request->input('warehouse_id');

        $filters = [
            'search' => $request->input('search'),
            'status' => $request->input('status'),
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
            'warehouse_id' => $warehouseId,
        ];

        $stockOpnames = StockOpname::query()
            ->with(['creator:id,name', 'finalizer:id,name', 'warehouse:id,code,name'])
            ->when($filters['search'], function ($query, $search) {
                $query->where(function ($builder) use ($search) {
                    $builder
                        ->where('code', 'like', '%'.$search.'%')
                        ->orWhere('notes', 'like', '%'.$search.'%');
                });
            })
            ->when($filters['status'], fn ($query, $status) => $query->where('status', $status))
            ->when($filters['date_from'], fn ($query, $date) => $query->whereDate('created_at', '>=', $date))
            ->when($filters['date_to'], fn ($query, $date) => $query->whereDate('created_at', '<=', $date))
            ->when($filters['warehouse_id'], fn ($query, $whId) => $query->where('warehouse_id', $whId))
            ->withCount('items')
            ->latest()
            ->paginate($this->perPage())->withQueryString();

        $warehouses = $user && ! $user->isHQ()
            ? Warehouse::where('id', $user->warehouse_id)->get(['id', 'code', 'name'])
            : Warehouse::active()->orderBy('code')->get(['id', 'code', 'name']);

        return Inertia::render('Dashboard/StockOpnames/Index', [
            'stockOpnames' => $stockOpnames,
            'filters' => $filters,
            'warehouses' => $warehouses,
        ]);
    }

    public function create(): Response
    {
        $user = auth()->user();
        $warehouses = $user && ! $user->isHQ()
            ? Warehouse::where('id', $user->warehouse_id)->get(['id', 'code', 'name'])
            : Warehouse::active()->orderBy('sort_order')->orderBy('code')->get(['id', 'code', 'name']);

        return Inertia::render('Dashboard/StockOpnames/Create', [
            'warehouses' => $warehouses,
        ]);
    }

    public function store(StoreStockOpnameRequest $request): RedirectResponse
    {
        $user = $request->user();
        $warehouseId = $user && ! $user->isHQ() ? $user->warehouse_id : $request->validated('warehouse_id');

        $stockOpname = StockOpname::create([
            'code' => $this->generateCode(),
            'warehouse_id' => $warehouseId,
            'notes' => $request->validated('notes'),
            'status' => 'draft',
            'created_by' => $user?->id,
        ]);

        return to_route('stock-opnames.show', $stockOpname);
    }

    public function show(Request $request, StockOpname $stockOpname): Response
    {
        $this->authorizeWarehouseAccess($request, $stockOpname);

        $stockOpname->load([
            'creator:id,name',
            'finalizer:id,name',
            'items.product.category:id,name',
            'items.product.units',
        ]);

        $productFilters = [
            'search' => $request->input('product_search', ''),
        ];

        $selectedProductIds = $stockOpname->items->pluck('product_id');

        $availableProducts = blank($productFilters['search'])
            ? collect()
            : Product::query()
                ->with('category:id,name')
                ->where(function ($builder) use ($productFilters) {
                    $builder
                        ->where('title', 'like', '%'.$productFilters['search'].'%')
                        ->orWhere('barcode', 'like', '%'.$productFilters['search'].'%')
                        ->orWhere('sku', 'like', '%'.$productFilters['search'].'%');
                })
                ->whereNotIn('id', $selectedProductIds)
                ->orderBy('title')
                ->limit(20)
                ->get()
                ->map(function ($product) use ($stockOpname) {
                    $pivotStock = 0;
                    if ($stockOpname->warehouse_id) {
                        $wh = $product->warehouses()->where('warehouse_id', $stockOpname->warehouse_id)->first();
                        $pivotStock = $wh !== null ? (int) $wh->pivot->stock : (int) ($product->stock ?? 0);
                    } else {
                        $pivotStock = (int) $product->stockTotal();
                    }

                    return [
                        ...$product->toArray(),
                        'warehouse_stock' => $pivotStock,
                    ];
                });

        return Inertia::render('Dashboard/StockOpnames/Show', [
            'stockOpname' => $stockOpname,
            'availableProducts' => $availableProducts,
            'productFilters' => $productFilters,
            'categories' => Category::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function update(UpdateStockOpnameRequest $request, StockOpname $stockOpname): RedirectResponse
    {
        $this->authorizeWarehouseAccess($request, $stockOpname);
        $this->ensureDraft($stockOpname);

        $stockOpname->update($request->validated());

        return back()->with('success', 'Catatan stock opname berhasil diperbarui.');
    }

    public function populateItems(Request $request, StockOpname $stockOpname): RedirectResponse
    {
        $this->authorizeWarehouseAccess($request, $stockOpname);
        $this->ensureDraft($stockOpname);

        $categoryId = $request->input('category_id');

        $query = Product::query()
            ->when($categoryId, fn ($q, $catId) => $q->where('category_id', $catId));

        $products = $query->get();
        $existingProductIds = $stockOpname->items()->pluck('product_id')->flip();

        $addedCount = 0;

        DB::transaction(function () use ($products, $stockOpname, $existingProductIds, &$addedCount) {
            foreach ($products as $product) {
                if (isset($existingProductIds[$product->id])) {
                    continue;
                }

                $systemStock = 0;
                if ($stockOpname->warehouse_id) {
                    $wh = $product->warehouses()->where('warehouse_id', $stockOpname->warehouse_id)->first();
                    if ($wh !== null) {
                        $systemStock = (int) $wh->pivot->stock;
                    } else {
                        $systemStock = (int) ($product->stock ?? 0);
                        $product->warehouses()->syncWithoutDetaching([
                            $stockOpname->warehouse_id => ['stock' => $systemStock],
                        ]);
                    }
                } else {
                    $systemStock = (int) $product->stockTotal();
                }

                $stockOpname->items()->create([
                    'product_id' => $product->id,
                    'system_stock' => $systemStock,
                ]);

                $addedCount++;
            }
        });

        return back()->with('success', "{$addedCount} produk berhasil ditambahkan ke sesi stock opname.");
    }

    public function storeItem(StoreStockOpnameItemRequest $request, StockOpname $stockOpname): RedirectResponse
    {
        $this->authorizeWarehouseAccess($request, $stockOpname);
        $this->ensureDraft($stockOpname);

        $product = Product::findOrFail($request->validated('product_id'));

        if ($stockOpname->items()->where('product_id', $product->id)->exists()) {
            throw ValidationException::withMessages([
                'product_id' => 'Produk sudah ada di sesi stock opname ini.',
            ]);
        }

        $systemStock = 0;
        if ($stockOpname->warehouse_id) {
            $wh = $product->warehouses()->where('warehouse_id', $stockOpname->warehouse_id)->first();
            if ($wh !== null) {
                $systemStock = (int) $wh->pivot->stock;
            } else {
                $systemStock = (int) ($product->stock ?? 0);
                $product->warehouses()->syncWithoutDetaching([
                    $stockOpname->warehouse_id => ['stock' => $systemStock],
                ]);
            }
        } else {
            $systemStock = (int) $product->stockTotal();
        }

        $stockOpname->items()->create([
            'product_id' => $product->id,
            'system_stock' => $systemStock,
        ]);

        return back()->with('success', 'Produk berhasil ditambahkan ke stock opname.');
    }

    public function updateItem(
        UpdateStockOpnameItemRequest $request,
        StockOpname $stockOpname,
        StockOpnameItem $item
    ): RedirectResponse {
        $this->authorizeWarehouseAccess($request, $stockOpname);
        $this->ensureDraft($stockOpname);
        $this->ensureItemBelongsToOpname($stockOpname, $item);

        $validated = $request->validated();
        $physicalStock = $validated['physical_stock'] ?? null;
        $difference = $physicalStock !== null
            ? $physicalStock - $item->system_stock
            : null;

        $adjustmentReason = $validated['adjustment_reason'] ?? null;

        if ($difference !== null && $difference !== 0 && blank($adjustmentReason)) {
            throw ValidationException::withMessages([
                'adjustment_reason' => 'Alasan adjustment wajib diisi jika ada selisih stok.',
            ]);
        }

        if ($difference === 0) {
            $adjustmentReason = null;
        }

        $item->update([
            'physical_stock' => $physicalStock,
            'difference' => $difference,
            'adjustment_reason' => $adjustmentReason,
        ]);

        return back()->with('success', 'Item stock opname berhasil diperbarui.');
    }

    public function finalize(Request $request, StockOpname $stockOpname): RedirectResponse
    {
        $this->authorizeWarehouseAccess($request, $stockOpname);
        $this->ensureDraft($stockOpname);

        $stockOpname->load('items.product');
        $beforeStatus = $stockOpname->status;

        foreach ($stockOpname->items as $item) {
            if ($item->difference !== null && $item->difference !== 0 && blank($item->adjustment_reason)) {
                throw ValidationException::withMessages([
                    'finalize' => 'Masih ada item selisih yang belum memiliki alasan adjustment.',
                ]);
            }
        }

        DB::transaction(function () use ($request, $stockOpname) {
            foreach ($stockOpname->items as $item) {
                if ($item->physical_stock === null) {
                    continue;
                }

                $product = $item->product()->lockForUpdate()->first();

                if (! $product) {
                    continue;
                }

                $stockBefore = (int) $product->stock;
                $stockAfter = (int) $item->physical_stock;

                $product->update([
                    'stock' => $stockAfter,
                ]);

                // Update pivot stock for warehouse
                if ($stockOpname->warehouse_id) {
                    ProductWarehouse::updateOrCreate(
                        [
                            'product_id' => $product->id,
                            'warehouse_id' => $stockOpname->warehouse_id,
                        ],
                        ['stock' => $stockAfter]
                    );
                }

                $this->stockMutationService->recordStockOpnameAdjustment(
                    product: $product,
                    stockOpname: $stockOpname,
                    stockBefore: $stockBefore,
                    stockAfter: $stockAfter,
                    reason: $item->adjustment_reason,
                    userId: $request->user()?->id,
                );
            }

            $stockOpname->update([
                'status' => 'finalized',
                'finalized_by' => $request->user()?->id,
                'finalized_at' => now(),
            ]);
        });

        $stockOpname->refresh();
        $stockOpname->load('items.product');

        $this->auditLogService->log(
            event: 'stock.opname.finalized',
            module: 'stock',
            auditable: $stockOpname,
            description: 'Stock opname difinalisasi.',
            before: ['status' => $beforeStatus],
            after: ['status' => $stockOpname->status],
            meta: [
                'code' => $stockOpname->code,
                'notes' => $stockOpname->notes,
                'items' => $stockOpname->items->map(fn (StockOpnameItem $item) => [
                    'product_id' => $item->product_id,
                    'product_title' => $item->product?->title,
                    'stock_before' => (int) $item->system_stock,
                    'stock_after' => $item->physical_stock !== null ? (int) $item->physical_stock : null,
                    'difference' => $item->difference !== null ? (int) $item->difference : null,
                    'reason' => $item->adjustment_reason,
                    'reference' => $stockOpname->code,
                ])->values()->all(),
            ],
        );

        return back()->with('success', 'Stock opname berhasil difinalisasi.');
    }

    private function ensureDraft(StockOpname $stockOpname): void
    {
        if (! $stockOpname->isDraft()) {
            throw ValidationException::withMessages([
                'stock_opname' => 'Sesi stock opname yang sudah final tidak dapat diubah.',
            ]);
        }
    }

    private function ensureItemBelongsToOpname(StockOpname $stockOpname, StockOpnameItem $item): void
    {
        if ($item->stock_opname_id !== $stockOpname->id) {
            abort(404);
        }
    }

    private function authorizeWarehouseAccess(Request $request, StockOpname $stockOpname): void
    {
        $user = $request->user();
        if ($user && ! $user->isHQ() && $stockOpname->warehouse_id && (int) $stockOpname->warehouse_id !== (int) $user->warehouse_id) {
            abort(403, 'Anda tidak memiliki akses ke Stock Opname cabang ini.');
        }
    }

    private function generateCode(): string
    {
        do {
            $code = 'SO-'.now()->format('YmdHis').'-'.Str::upper(Str::random(4));
        } while (StockOpname::where('code', $code)->exists());

        return $code;
    }
}
