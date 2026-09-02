<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\GoodsReceiving;
use App\Models\PurchaseOrder;
use App\Services\GoodsReceivingService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class GoodsReceivingController extends Controller
{
    public function __construct(
        private readonly GoodsReceivingService $goodsReceivingService
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $filters = [
            'search' => $request->input('search'),
            'purchase_order_id' => $request->input('purchase_order_id'),
        ];

        $query = GoodsReceiving::with([
            'purchaseOrder:id,document_number,status,warehouse_id',
            'supplier:id,name',
            'receiver:id,name',
        ])->orderByDesc('received_at');

        if ($user && ! $user->isHQ()) {
            $query->whereHas('purchaseOrder', fn ($q) => $q->where('warehouse_id', $user->warehouse_id));
        }

        $query->when($filters['search'], fn ($q, $s) => $q->where('document_number', 'like', "%{$s}%"))
            ->when($filters['purchase_order_id'], fn ($q, $id) => $q->where('purchase_order_id', $id));

        $receivings = $query->paginate($this->perPage())->withQueryString();

        return Inertia::render('Dashboard/GoodsReceivings/Index', [
            'receivings' => $receivings,
            'filters' => $filters,
        ]);
    }

    public function create(Request $request)
    {
        $user = $request->user();
        $purchaseOrderId = $request->input('purchase_order_id');

        $query = PurchaseOrder::with([
            'supplier:id,name',
            'items.product:id,title,sku',
            'items.unit:id,code,name,symbol',
        ])->whereIn('status', ['ordered', 'partial_received'])
            ->orderByDesc('created_at');

        if ($user && ! $user->isHQ()) {
            $query->where('warehouse_id', $user->warehouse_id);
        }

        if ($purchaseOrderId) {
            $query->where('id', $purchaseOrderId);
        }

        $orders = $query->get();

        return Inertia::render('Dashboard/GoodsReceivings/Create', [
            'orders' => $orders,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'purchase_order_id' => ['required', 'exists:purchase_orders,id'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.purchase_order_item_id' => ['required', 'exists:purchase_order_items,id'],
            'items.*.qty_received' => ['required', 'integer', 'min:1'],
            'items.*.notes' => ['nullable', 'string', 'max:500'],
        ]);

        $order = PurchaseOrder::with('items')->findOrFail($data['purchase_order_id']);

        if ($user && ! $user->isHQ() && $order->warehouse_id && (int) $order->warehouse_id !== (int) $user->warehouse_id) {
            abort(403, 'Anda tidak memiliki akses ke Purchase Order cabang ini.');
        }

        if (is_null($order->warehouse_id)) {
            return back()->with('error', 'Purchase order ini tidak memiliki gudang tujuan. Silakan edit PO terlebih dahulu untuk menentukan gudang.');
        }

        foreach ($data['items'] as $item) {
            $poItem = $order->items->firstWhere('id', $item['purchase_order_item_id']);
            if (! $poItem) {
                return back()->with('error', 'Item tidak ditemukan di PO.');
            }
            $outstanding = $poItem->qty_ordered - $poItem->qty_received;
            if ($item['qty_received'] > $outstanding) {
                return back()->with('error', "Qty diterima melebihi sisa item {$poItem->product_id}.");
            }
        }

        $receiving = $this->goodsReceivingService->receive(
            order: $order,
            items: $data['items'],
            notes: $data['notes'] ?? null,
            userId: $user->id,
        );

        return redirect()
            ->route('goods-receivings.show', $receiving)
            ->with('success', 'Penerimaan barang berhasil dicatat.');
    }

    public function show(Request $request, GoodsReceiving $goodsReceiving)
    {
        $goodsReceiving->load([
            'purchaseOrder:id,document_number,status,warehouse_id',
            'supplier:id,name',
            'items.product:id,title,sku',
            'items.unit:id,code,name,symbol',
            'items.purchaseOrderItem:id,unit_price,unit_id,conversion_factor',
            'items.purchaseOrderItem.unit:id,code,name,symbol',
            'receiver:id,name',
        ]);

        $user = $request->user();
        if ($user && ! $user->isHQ() && $goodsReceiving->purchaseOrder && (int) $goodsReceiving->purchaseOrder->warehouse_id !== (int) $user->warehouse_id) {
            abort(403, 'Anda tidak memiliki akses ke Penerimaan Barang cabang ini.');
        }

        return Inertia::render('Dashboard/GoodsReceivings/Show', [
            'receiving' => $goodsReceiving,
        ]);
    }
}
