<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\CatalogOrder;
use App\Models\Warehouse;
use App\Services\CatalogOrderService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class CatalogOrderController extends Controller
{
    public function __construct(
        private readonly CatalogOrderService $catalogOrderService,
    ) {}

    public function index(Request $request): Response
    {
        $user = auth()->user();
        $scopedWarehouseId = $user->warehouse_id;

        $status = (string) $request->query('status', 'all');
        $search = (string) $request->query('q', '');
        $warehouseFilter = $request->query('warehouse_id', $scopedWarehouseId);

        $baseQuery = CatalogOrder::query()
            ->when($warehouseFilter, fn ($q) => $q->where('warehouse_id', $warehouseFilter));

        $metrics = [
            'submitted' => (clone $baseQuery)->where('status', CatalogOrder::STATUS_SUBMITTED)->count(),
            'processing' => (clone $baseQuery)->whereIn('status', [CatalogOrder::STATUS_CONFIRMED, CatalogOrder::STATUS_PROCESSING, CatalogOrder::STATUS_READY])->count(),
            'completed_today' => (clone $baseQuery)->where('status', CatalogOrder::STATUS_COMPLETED)->whereDate('completed_at', Carbon::today())->count(),
            'total' => (clone $baseQuery)->count(),
        ];

        $ordersQuery = (clone $baseQuery)
            ->with(['warehouse:id,code,name,phone', 'cashier:id,name', 'bankAccount:id,bank_name,account_number,account_name,logo', 'items.product:id,title,barcode,image', 'items.unit:id,name,code,symbol', 'transaction:id,invoice', 'customerVoucher:id,code,name,discount_type,discount_value'])
            ->when($status !== 'all', function ($q) use ($status) {
                if ($status === 'active') {
                    $q->whereIn('status', [
                        CatalogOrder::STATUS_SUBMITTED,
                        CatalogOrder::STATUS_CONFIRMED,
                        CatalogOrder::STATUS_PROCESSING,
                        CatalogOrder::STATUS_READY,
                    ]);
                } else {
                    $q->where('status', $status);
                }
            })
            ->when($search !== '', function ($q) use ($search) {
                $term = '%'.$search.'%';
                $q->where(function ($sub) use ($term) {
                    $sub->where('order_number', 'like', $term)
                        ->orWhere('customer_name', 'like', $term)
                        ->orWhere('customer_phone', 'like', $term)
                        ->orWhere('delivery_address', 'like', $term);
                });
            })
            ->orderByDesc('id');

        $orders = $ordersQuery->paginate(15)->withQueryString();

        $activePhoneCounts = CatalogOrder::query()
            ->whereIn('status', [
                CatalogOrder::STATUS_SUBMITTED,
                CatalogOrder::STATUS_CONFIRMED,
                CatalogOrder::STATUS_PROCESSING,
                CatalogOrder::STATUS_READY,
            ])
            ->whereNotNull('customer_phone')
            ->where('customer_phone', '!=', '')
            ->select('customer_phone', DB::raw('count(*) as active_count'))
            ->groupBy('customer_phone')
            ->having('active_count', '>', 1)
            ->pluck('active_count', 'customer_phone');

        $orders->getCollection()->transform(function ($order) use ($activePhoneCounts) {
            $order->other_active_orders_count = ! empty($order->customer_phone)
                ? max(0, ($activePhoneCounts[$order->customer_phone] ?? 1) - 1)
                : 0;

            return $order;
        });

        $warehouses = Warehouse::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'code', 'name']);

        return Inertia::render('Dashboard/CatalogOrders/Index', [
            'orders' => $orders,
            'metrics' => $metrics,
            'warehouses' => $warehouses,
            'filters' => [
                'status' => $status,
                'q' => $search,
                'warehouse_id' => $warehouseFilter,
            ],
        ]);
    }

    public function confirm(CatalogOrder $catalogOrder): RedirectResponse
    {
        try {
            $this->catalogOrderService->confirmOrder($catalogOrder, auth()->id());

            return back()->with('success', "Pesanan {$catalogOrder->order_number} berhasil dikonfirmasi dan stok telah dipotong.");
        } catch (\Throwable $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    public function updateStatus(Request $request, CatalogOrder $catalogOrder): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:processing,ready'],
        ], [
            'status.in' => 'Pesanan online hanya dapat diselesaikan melalui transaksi kasir POS.',
        ]);

        try {
            $this->catalogOrderService->updateStatus($catalogOrder, $validated['status'], null, auth()->id());

            $label = match ($validated['status']) {
                CatalogOrder::STATUS_PROCESSING => 'Sedang Disiapkan',
                CatalogOrder::STATUS_READY => $catalogOrder->delivery_method === 'delivery' ? 'Sedang Dikirim' : 'Siap Diambil',
                default => $validated['status'],
            };

            return back()->with('success', "Status pesanan {$catalogOrder->order_number} diubah menjadi {$label}.");
        } catch (\Throwable $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    public function cancel(Request $request, CatalogOrder $catalogOrder): RedirectResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ], [
            'reason.required' => 'Alasan pembatalan wajib diisi.',
        ]);

        try {
            $sanitizedReason = trim(strip_tags((string) $validated['reason']));
            $this->catalogOrderService->cancelOrder($catalogOrder, $sanitizedReason, auth()->id());

            return back()->with('success', "Pesanan {$catalogOrder->order_number} berhasil dibatalkan.");
        } catch (\Throwable $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    public function loadToPos(CatalogOrder $catalogOrder): RedirectResponse
    {
        try {
            $holdId = $this->catalogOrderService->loadToPosCart($catalogOrder, auth()->id());

            return redirect()->route('transactions.index', ['resume_hold' => $holdId])->with('success', "Pesanan {$catalogOrder->order_number} berhasil dimuat ke kasir POS!");
        } catch (\Throwable $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    /**
     * Stream payment proof securely for authenticated staff with RBAC check
     */
    public function paymentProof(CatalogOrder $catalogOrder): SymfonyResponse
    {
        $user = auth()->user();
        if ($user && $user->warehouse_id && (int) $catalogOrder->warehouse_id !== (int) $user->warehouse_id) {
            abort(403, 'Anda tidak memiliki akses ke pesanan cabang ini.');
        }

        if (! $catalogOrder->payment_proof) {
            abort(404, 'Bukti transfer belum diunggah untuk pesanan ini.');
        }

        $configuredDisk = config('filesystems.payment_proof_disk', 'local');
        $disk = null;

        if (Storage::disk($configuredDisk)->exists($catalogOrder->payment_proof)) {
            $disk = $configuredDisk;
        } elseif (Storage::disk('local')->exists($catalogOrder->payment_proof)) {
            $disk = 'local';
        } elseif (Storage::disk('public')->exists($catalogOrder->payment_proof)) {
            $disk = 'public';
        }

        if (! $disk) {
            abort(404, 'File bukti transfer tidak ditemukan di penyimpanan server.');
        }

        $mimeType = Storage::disk($disk)->mimeType($catalogOrder->payment_proof) ?: 'application/octet-stream';
        $extension = pathinfo($catalogOrder->payment_proof, PATHINFO_EXTENSION) ?: 'jpg';
        $filename = 'bukti-transfer-'.$catalogOrder->order_number.'.'.$extension;

        return Storage::disk($disk)->response($catalogOrder->payment_proof, $filename, [
            'Content-Type' => $mimeType,
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
            'Cache-Control' => 'private, no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
            'X-Robots-Tag' => 'noindex, nofollow',
        ]);
    }
}
