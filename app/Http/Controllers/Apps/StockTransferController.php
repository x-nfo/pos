<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockTransfer;
use App\Models\Warehouse;
use App\Services\StockTransferService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class StockTransferController extends Controller
{
    public function __construct(
        private readonly StockTransferService $stockTransferService
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $query = StockTransfer::with([
            'sourceWarehouse:id,code,name',
            'destinationWarehouse:id,code,name',
            'creator:id,name',
        ])->withCount('items');

        if ($user && ! $user->isHQ()) {
            $query->where(function ($q) use ($user) {
                $q->where('source_warehouse_id', $user->warehouse_id)
                    ->orWhere('destination_warehouse_id', $user->warehouse_id);
            });
        }

        $transfers = $query->latest()
            ->paginate($this->perPage())
            ->withQueryString();

        return Inertia::render('Dashboard/StockTransfers/Index', [
            'transfers' => $transfers,
        ]);
    }

    public function create(): Response
    {
        $warehouses = Warehouse::active()->orderBy('sort_order')->orderBy('code')->get(['id', 'code', 'name']);
        $products = Product::with(['warehouses:id,code,name'])->orderBy('title')->get(['id', 'title', 'sku', 'stock']);

        return Inertia::render('Dashboard/StockTransfers/Create', [
            'warehouses' => $warehouses,
            'products' => $products,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'source_warehouse_id' => ['required', 'exists:warehouses,id'],
            'destination_warehouse_id' => ['required', 'exists:warehouses,id', 'different:source_warehouse_id'],
            'document_number' => ['nullable', 'string', 'max:30'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
        ]);

        $user = $request->user();
        if ($user && ! $user->isHQ()) {
            $whId = (int) $user->warehouse_id;
            if ((int) $data['source_warehouse_id'] !== $whId && (int) $data['destination_warehouse_id'] !== $whId) {
                throw ValidationException::withMessages([
                    'source_warehouse_id' => 'Transfer stok harus melibatkan cabang penugasan Anda sebagai asal atau tujuan.',
                ]);
            }
        }

        $transfer = $this->stockTransferService->createDraft($data, $data['items'], $user->id);

        return redirect()
            ->route('stock-transfers.show', $transfer)
            ->with('success', 'Transfer stok berhasil dibuat.');
    }

    public function show(Request $request, StockTransfer $stockTransfer): Response
    {
        $this->authorizeTransferAccess($request, $stockTransfer);

        $stockTransfer->load([
            'sourceWarehouse:id,code,name',
            'destinationWarehouse:id,code,name',
            'items.product:id,title,sku',
            'creator:id,name',
        ]);

        return Inertia::render('Dashboard/StockTransfers/Show', [
            'transfer' => $stockTransfer,
        ]);
    }

    public function send(Request $request, StockTransfer $stockTransfer): RedirectResponse
    {
        $this->authorizeTransferAccess($request, $stockTransfer);
        $this->stockTransferService->send($stockTransfer, $request->user()->id);

        return back()->with('success', 'Transfer stok berhasil dikirim.');
    }

    public function receive(Request $request, StockTransfer $stockTransfer): RedirectResponse
    {
        $this->authorizeTransferAccess($request, $stockTransfer);

        $validated = $request->validate([
            'items' => ['nullable', 'array'],
            'items.*.id' => ['required_with:items', 'integer'],
            'items.*.received_qty' => ['nullable', 'integer', 'min:0'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ]);

        $this->stockTransferService->receive($stockTransfer, $request->user()->id, $validated['items'] ?? []);

        return back()->with('success', 'Transfer stok berhasil diterima.');
    }

    public function cancel(Request $request, StockTransfer $stockTransfer): RedirectResponse
    {
        $this->authorizeTransferAccess($request, $stockTransfer);
        $this->stockTransferService->cancel($stockTransfer, $request->user()->id);

        return back()->with('success', 'Transfer stok dibatalkan.');
    }

    private function authorizeTransferAccess(Request $request, StockTransfer $stockTransfer): void
    {
        $user = $request->user();
        if ($user && ! $user->isHQ()) {
            $whId = (int) $user->warehouse_id;
            if ((int) $stockTransfer->source_warehouse_id !== $whId && (int) $stockTransfer->destination_warehouse_id !== $whId) {
                abort(403, 'Anda tidak memiliki akses ke transfer stok cabang ini.');
            }
        }
    }
}
