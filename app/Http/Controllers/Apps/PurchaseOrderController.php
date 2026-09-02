<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Setting;
use App\Models\Supplier;
use App\Models\Warehouse;
use App\Services\PurchaseOrderService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PurchaseOrderController extends Controller
{
    public function __construct(
        private readonly PurchaseOrderService $purchaseOrderService
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $filters = [
            'status' => $request->input('status'),
            'supplier' => $request->input('supplier'),
            'search' => $request->input('search'),
        ];

        $query = PurchaseOrder::with([
            'supplier:id,name',
            'items',
            'creator:id,name',
            'warehouse:id,code,name',
        ])->withCount('items as items_count')
            ->orderByDesc('created_at');

        if ($user && ! $user->isHQ()) {
            $query->where('warehouse_id', $user->warehouse_id);
        }

        $query->when($filters['status'], fn ($q, $s) => $q->where('status', $s))
            ->when($filters['supplier'], fn ($q, $s) => $q->where('supplier_id', $s))
            ->when($filters['search'], fn ($q, $s) => $q->where('document_number', 'like', "%{$s}%"));

        $orders = $query->paginate($this->perPage())->withQueryString();
        $suppliers = Supplier::orderBy('name')->get(['id', 'name']);

        return Inertia::render('Dashboard/PurchaseOrders/Index', [
            'orders' => $orders,
            'filters' => $filters,
            'suppliers' => $suppliers,
        ]);
    }

    public function create()
    {
        $user = auth()->user();
        $suppliers = Supplier::orderBy('name')->get(['id', 'name']);
        $categories = Category::orderBy('name')->get(['id', 'name']);
        $products = Product::with(['units', 'category:id,name'])
            ->orderBy('title')
            ->get(['id', 'category_id', 'title', 'sku', 'barcode', 'buy_price', 'sell_price', 'stock'])
            ->map(function ($product) {
                return [
                    'id' => $product->id,
                    'category_id' => $product->category_id,
                    'category_name' => $product->category?->name ?? 'Tanpa Kategori',
                    'title' => $product->title,
                    'sku' => $product->sku,
                    'barcode' => $product->barcode,
                    'buy_price' => $product->buy_price,
                    'sell_price' => $product->sell_price,
                    'stock' => $product->stock,
                    'units' => $product->units->map(fn ($u) => [
                        'id' => $u->id,
                        'code' => $u->code,
                        'name' => $u->name,
                        'symbol' => $u->symbol,
                        'is_base' => (bool) ($u->pivot->is_base ?? false),
                        'conversion_factor' => (float) ($u->pivot->conversion_factor ?? 1),
                        'buy_price' => (int) ($u->pivot->buy_price ?? $product->buy_price),
                        'sell_price' => (int) ($u->pivot->sell_price ?? $product->sell_price),
                        'barcode' => $u->pivot->barcode ?? null,
                    ])->values()->toArray(),
                ];
            });
        $warehouses = $user && ! $user->isHQ()
            ? Warehouse::where('id', $user->warehouse_id)->get(['id', 'code', 'name'])
            : Warehouse::active()->orderBy('sort_order')->orderBy('code')->get(['id', 'code', 'name']);

        return Inertia::render('Dashboard/PurchaseOrders/Create', [
            'suppliers' => $suppliers,
            'categories' => $categories,
            'products' => $products,
            'warehouses' => $warehouses,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'warehouse_id' => ['required', 'exists:warehouses,id'],
            'document_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.unit_id' => ['nullable', 'exists:units,id'],
            'items.*.conversion_factor' => ['nullable', 'numeric', 'min:0.0001'],
            'items.*.qty_ordered' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ]);

        if ($user && ! $user->isHQ()) {
            $data['warehouse_id'] = $user->warehouse_id;
        }

        $order = $this->purchaseOrderService->createOrder($data, $data['items'], $user->id);

        return redirect()
            ->route('purchase-orders.show', $order)
            ->with('success', 'Purchase order berhasil dibuat.');
    }

    public function show(Request $request, PurchaseOrder $purchaseOrder)
    {
        $this->authorizeWarehouseAccess($request, $purchaseOrder);

        $purchaseOrder->load([
            'supplier:id,name,phone,email,address',
            'warehouse:id,code,name',
            'items.product:id,title,sku,image',
            'items.unit:id,code,name,symbol',
            'goodsReceivings' => function ($q) {
                $q->with([
                    'items.product:id,title,sku',
                    'items.unit:id,code,name,symbol',
                ])->orderByDesc('received_at');
            },
            'creator:id,name',
            'payable:id,purchase_order_id,total,paid,status,document_number',
        ]);

        return Inertia::render('Dashboard/PurchaseOrders/Show', [
            'order' => $purchaseOrder,
        ]);
    }

    public function print(Request $request, PurchaseOrder $purchaseOrder)
    {
        $this->authorizeWarehouseAccess($request, $purchaseOrder);

        $purchaseOrder->load([
            'supplier:id,name,phone,email,address',
            'warehouse:id,code,name',
            'items.product:id,title,sku,barcode,image',
            'items.unit:id,code,name,symbol',
            'creator:id,name',
        ]);

        $defaultPaperSize = Setting::get('printer_paper_size', '58mm');

        return Inertia::render('Dashboard/PurchaseOrders/Print', [
            'order' => $purchaseOrder,
            'defaultPaperSize' => $defaultPaperSize,
        ]);
    }

    public function edit(Request $request, PurchaseOrder $purchaseOrder)
    {
        $this->authorizeWarehouseAccess($request, $purchaseOrder);

        if ($purchaseOrder->status !== 'draft') {
            return redirect()
                ->route('purchase-orders.show', $purchaseOrder)
                ->with('error', 'Hanya PO dengan status draft yang dapat diedit.');
        }

        $purchaseOrder->load([
            'supplier:id,name',
            'warehouse:id,code,name',
            'items.product:id,category_id,title,sku,barcode,buy_price,sell_price,stock',
            'items.product.category:id,name',
            'items.product.units',
            'items.unit:id,code,name,symbol',
        ]);

        $user = $request->user();
        $suppliers = Supplier::orderBy('name')->get(['id', 'name']);
        $categories = Category::orderBy('name')->get(['id', 'name']);
        $products = Product::with(['units', 'category:id,name'])
            ->orderBy('title')
            ->get(['id', 'category_id', 'title', 'sku', 'barcode', 'buy_price', 'sell_price', 'stock'])
            ->map(function ($product) {
                return [
                    'id' => $product->id,
                    'category_id' => $product->category_id,
                    'category_name' => $product->category?->name ?? 'Tanpa Kategori',
                    'title' => $product->title,
                    'sku' => $product->sku,
                    'barcode' => $product->barcode,
                    'buy_price' => $product->buy_price,
                    'sell_price' => $product->sell_price,
                    'stock' => $product->stock,
                    'units' => $product->units->map(fn ($u) => [
                        'id' => $u->id,
                        'code' => $u->code,
                        'name' => $u->name,
                        'symbol' => $u->symbol,
                        'is_base' => (bool) ($u->pivot->is_base ?? false),
                        'conversion_factor' => (float) ($u->pivot->conversion_factor ?? 1),
                        'buy_price' => (int) ($u->pivot->buy_price ?? $product->buy_price),
                        'sell_price' => (int) ($u->pivot->sell_price ?? $product->sell_price),
                        'barcode' => $u->pivot->barcode ?? null,
                    ])->values()->toArray(),
                ];
            });
        $warehouses = $user && ! $user->isHQ()
            ? Warehouse::where('id', $user->warehouse_id)->get(['id', 'code', 'name'])
            : Warehouse::active()->orderBy('sort_order')->orderBy('code')->get(['id', 'code', 'name']);

        return Inertia::render('Dashboard/PurchaseOrders/Edit', [
            'order' => $purchaseOrder,
            'suppliers' => $suppliers,
            'categories' => $categories,
            'products' => $products,
            'warehouses' => $warehouses,
        ]);
    }

    public function update(Request $request, PurchaseOrder $purchaseOrder)
    {
        $this->authorizeWarehouseAccess($request, $purchaseOrder);

        if ($purchaseOrder->status !== 'draft') {
            return redirect()
                ->route('purchase-orders.show', $purchaseOrder)
                ->with('error', 'Hanya PO dengan status draft yang dapat diperbarui.');
        }

        $user = $request->user();
        $data = $request->validate([
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'warehouse_id' => ['required', 'exists:warehouses,id'],
            'document_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.unit_id' => ['nullable', 'exists:units,id'],
            'items.*.conversion_factor' => ['nullable', 'numeric', 'min:0.0001'],
            'items.*.qty_ordered' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ]);

        if ($user && ! $user->isHQ()) {
            $data['warehouse_id'] = $user->warehouse_id;
        }

        $this->purchaseOrderService->updateOrder($purchaseOrder, $data, $data['items'], $user->id);

        return redirect()
            ->route('purchase-orders.show', $purchaseOrder)
            ->with('success', 'Purchase order berhasil diperbarui.');
    }

    public function placeOrder(Request $request, PurchaseOrder $purchaseOrder)
    {
        $this->authorizeWarehouseAccess($request, $purchaseOrder);

        if ($purchaseOrder->status !== 'draft') {
            return back()->with('error', 'Hanya PO dengan status draft yang bisa dipesan.');
        }

        $this->purchaseOrderService->placeOrder($purchaseOrder);

        return redirect()
            ->route('purchase-orders.show', $purchaseOrder)
            ->with('success', 'Purchase order berhasil dipesan.');
    }

    public function cancel(Request $request, PurchaseOrder $purchaseOrder)
    {
        $this->authorizeWarehouseAccess($request, $purchaseOrder);

        if (! in_array($purchaseOrder->status, ['draft', 'ordered', 'partial_received'])) {
            return back()->with('error', 'PO tidak dapat dibatalkan.');
        }

        $this->purchaseOrderService->cancelOrder($purchaseOrder);

        return redirect()
            ->route('purchase-orders.index')
            ->with('success', 'Purchase order dibatalkan.');
    }

    private function authorizeWarehouseAccess(Request $request, PurchaseOrder $purchaseOrder): void
    {
        $user = $request->user();
        if ($user && ! $user->isHQ() && $purchaseOrder->warehouse_id && (int) $purchaseOrder->warehouse_id !== (int) $user->warehouse_id) {
            abort(403, 'Anda tidak memiliki akses ke Purchase Order cabang ini.');
        }
    }
}
