<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\GoodsReceiving;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\SupplierReturn;
use App\Services\SupplierReturnService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SupplierReturnController extends Controller
{
    public function __construct(
        private readonly SupplierReturnService $supplierReturnService
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $filters = [
            'status' => $request->input('status'),
            'supplier' => $request->input('supplier'),
            'search' => $request->input('search'),
        ];

        $query = SupplierReturn::with([
            'supplier:id,name',
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

        $returns = $query->paginate($this->perPage())->withQueryString();
        $suppliers = Supplier::orderBy('name')->get(['id', 'name']);

        return Inertia::render('Dashboard/SupplierReturns/Index', [
            'returns' => $returns,
            'filters' => $filters,
            'suppliers' => $suppliers,
        ]);
    }

    public function create(Request $request)
    {
        $user = $request->user();
        $suppliers = Supplier::orderBy('name')->get(['id', 'name']);

        $goodsReceivings = collect();
        if ($request->input('supplier_id')) {
            $grQuery = GoodsReceiving::with([
                'supplier:id,name',
                'items.product:id,title,sku',
                'items.purchaseOrderItem:id,unit_price',
            ])->where('supplier_id', $request->input('supplier_id'))
                ->whereHas('purchaseOrder', fn ($q) => $q->whereIn('status', ['ordered', 'partial_received', 'completed']))
                ->orderByDesc('received_at');

            if ($user && ! $user->isHQ()) {
                $grQuery->where('warehouse_id', $user->warehouse_id);
            }

            $goodsReceivings = $grQuery->get();
        }

        $products = Product::orderBy('title')->get(['id', 'title', 'sku', 'buy_price', 'stock']);

        return Inertia::render('Dashboard/SupplierReturns/Create', [
            'suppliers' => $suppliers,
            'goodsReceivings' => $goodsReceivings,
            'products' => $products,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'warehouse_id' => ['nullable', 'exists:warehouses,id'],
            'goods_receiving_id' => ['nullable', 'exists:goods_receivings,id'],
            'payable_id' => ['nullable', 'exists:payables,id'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.qty_returned' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.reason' => ['nullable', 'string', 'max:100'],
            'items.*.notes' => ['nullable', 'string', 'max:500'],
        ]);

        if ($user && ! $user->isHQ()) {
            $data['warehouse_id'] = $user->warehouse_id;
        }

        $return = $this->supplierReturnService->createReturn(
            $data,
            $data['items'],
            $user->id,
        );

        return redirect()
            ->route('supplier-returns.show', $return)
            ->with('success', 'Retur supplier berhasil dibuat.');
    }

    public function show(Request $request, SupplierReturn $supplierReturn)
    {
        $this->authorizeWarehouseAccess($request, $supplierReturn);

        $supplierReturn->load([
            'supplier:id,name,phone,email,address',
            'warehouse:id,code,name',
            'goodsReceiving:id,document_number',
            'payable:id,total,paid,status,document_number',
            'items.product:id,title,sku',
            'items.goodsReceivingItem',
            'creator:id,name',
        ]);

        return Inertia::render('Dashboard/SupplierReturns/Show', [
            'return' => $supplierReturn,
        ]);
    }

    public function complete(Request $request, SupplierReturn $supplierReturn)
    {
        $this->authorizeWarehouseAccess($request, $supplierReturn);

        if ($supplierReturn->status !== 'draft') {
            return back()->with('error', 'Hanya retur dengan status draft yang bisa diselesaikan.');
        }

        $this->supplierReturnService->complete($supplierReturn);

        return redirect()
            ->route('supplier-returns.show', $supplierReturn)
            ->with('success', 'Retur supplier berhasil diselesaikan.');
    }

    public function cancel(Request $request, SupplierReturn $supplierReturn)
    {
        $this->authorizeWarehouseAccess($request, $supplierReturn);

        if (! in_array($supplierReturn->status, ['draft'])) {
            return back()->with('error', 'Retur tidak dapat dibatalkan.');
        }

        $this->supplierReturnService->cancel($supplierReturn);

        return redirect()
            ->route('supplier-returns.index')
            ->with('success', 'Retur supplier dibatalkan.');
    }

    private function authorizeWarehouseAccess(Request $request, SupplierReturn $supplierReturn): void
    {
        $user = $request->user();
        if ($user && ! $user->isHQ() && $supplierReturn->warehouse_id && (int) $supplierReturn->warehouse_id !== (int) $user->warehouse_id) {
            abort(403, 'Anda tidak memiliki akses ke Retur Supplier cabang ini.');
        }
    }
}
