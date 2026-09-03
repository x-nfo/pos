<?php

namespace App\Http\Controllers;

use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Profit;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\Warehouse;
use App\Services\CashierShiftService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index(Request $request, CashierShiftService $cashierShiftService)
    {
        $user = auth()->user();
        $scopedWarehouseId = $user && ! $user->isHQ()
            ? $user->warehouse_id
            : $request->input('warehouse_id');

        if ($user && ! $user->isHQ()) {
            $warehouses = Warehouse::where('id', $user->warehouse_id)->get(['id', 'code', 'name']);
        } else {
            $warehouses = Warehouse::active()->orderBy('code')->get(['id', 'code', 'name']);
        }

        $totalCategories = Category::count();
        $totalProducts = Product::count();
        $totalTransactions = Transaction::when($scopedWarehouseId, fn ($q) => $q->where('warehouse_id', $scopedWarehouseId))->count();
        $totalCustomers = Customer::count();
        $totalRevenue = Transaction::when($scopedWarehouseId, fn ($q) => $q->where('warehouse_id', $scopedWarehouseId))->sum('grand_total');
        $totalProfit = Profit::when($scopedWarehouseId, fn ($q) => $q->whereHas('transaction', fn ($t) => $t->where('warehouse_id', $scopedWarehouseId)))->sum('total');
        $averageOrder = Transaction::when($scopedWarehouseId, fn ($q) => $q->where('warehouse_id', $scopedWarehouseId))->avg('grand_total') ?? 0;
        $todayTransactions = Transaction::when($scopedWarehouseId, fn ($q) => $q->where('warehouse_id', $scopedWarehouseId))->whereDate('created_at', Carbon::today())->count();

        // New: Today's Sales and Profit
        $todaySales = Transaction::when($scopedWarehouseId, fn ($q) => $q->where('warehouse_id', $scopedWarehouseId))->whereDate('created_at', Carbon::today())->sum('grand_total');
        $todayProfit = Profit::when($scopedWarehouseId, fn ($q) => $q->whereHas('transaction', fn ($t) => $t->where('warehouse_id', $scopedWarehouseId)))->whereDate('created_at', Carbon::today())->sum('total');

        // New: Monthly Target (from settings)
        $monthlyTarget = Setting::where('key', 'monthly_sales_target')->first()?->value ?? 0;
        $currentMonthSales = Transaction::when($scopedWarehouseId, fn ($q) => $q->where('warehouse_id', $scopedWarehouseId))
            ->whereMonth('created_at', Carbon::now()->month)
            ->whereYear('created_at', Carbon::now()->year)
            ->sum('grand_total');

        $revenueTrend = Transaction::when($scopedWarehouseId, fn ($q) => $q->where('warehouse_id', $scopedWarehouseId))
            ->selectRaw('DATE(created_at) as date, SUM(grand_total) as total')
            ->groupBy('date')
            ->orderBy('date', 'desc')
            ->take(12)
            ->get()
            ->map(function ($row) {
                return [
                    'date' => $row->date,
                    'label' => Carbon::parse($row->date)->format('d M'),
                    'total' => (int) $row->total,
                ];
            })
            ->reverse()
            ->values();

        $topProducts = TransactionDetail::when($scopedWarehouseId, fn ($q) => $q->whereHas('transaction', fn ($t) => $t->where('warehouse_id', $scopedWarehouseId)))
            ->select('product_id', DB::raw('SUM(qty) as qty'), DB::raw('SUM(price) as total'))
            ->with('product:id,title,sku')
            ->groupBy('product_id')
            ->orderByDesc('qty')
            ->take(3)
            ->get()
            ->map(function ($detail) {
                return [
                    'name' => $detail->product?->title ?? 'Produk terhapus',
                    'sku' => $detail->product?->sku ?? '-',
                    'qty' => (int) $detail->qty,
                    'total' => (int) $detail->total,
                ];
            });

        // New: Low Stock Products
        if ($scopedWarehouseId) {
            $lowStockProducts = Product::whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $scopedWarehouseId)->where('product_warehouse.stock', '<', 10))
                ->with(['warehouses' => fn ($w) => $w->where('product_warehouse.warehouse_id', $scopedWarehouseId)])
                ->take(5)
                ->get()
                ->map(function ($product) use ($scopedWarehouseId) {
                    return [
                        'name' => $product->title,
                        'stock' => (int) ($product->warehouses->firstWhere('id', $scopedWarehouseId)?->pivot->stock ?? 0),
                        'image' => $product->image,
                    ];
                });
        } else {
            $lowStockProducts = Product::where('stock', '<', 10)
                ->orderBy('stock', 'asc')
                ->take(5)
                ->get()
                ->map(function ($product) {
                    return [
                        'name' => $product->title,
                        'stock' => (int) $product->stock,
                        'image' => $product->image,
                    ];
                });
        }

        // New: Slow Moving Products (no sales in 30 days)
        $thirtyDaysAgo = Carbon::now()->subDays(30);
        $recentlySoldProductIds = TransactionDetail::when($scopedWarehouseId, fn ($q) => $q->whereHas('transaction', fn ($t) => $t->where('warehouse_id', $scopedWarehouseId)))
            ->where('created_at', '>=', $thirtyDaysAgo)
            ->distinct()
            ->pluck('product_id');

        $slowMovingProducts = Product::whereNotIn('id', $recentlySoldProductIds)
            ->where('stock', '>', 0)
            ->take(5)
            ->get()
            ->map(function ($product) {
                return [
                    'name' => $product->title,
                    'stock' => (int) $product->stock,
                    'image' => $product->image,
                ];
            });

        $recentTransactions = Transaction::when($scopedWarehouseId, fn ($q) => $q->where('warehouse_id', $scopedWarehouseId))
            ->with('cashier:id,name', 'customer:id,name')
            ->latest()
            ->take(5)
            ->get()
            ->map(function ($transaction) {
                return [
                    'invoice' => $transaction->invoice,
                    'date' => Carbon::parse($transaction->created_at)->format('d M Y'),
                    'customer' => $transaction->customer?->name ?? '-',
                    'cashier' => $transaction->cashier?->name ?? '-',
                    'total' => (int) $transaction->grand_total,
                ];
            });

        $topCustomers = Transaction::when($scopedWarehouseId, fn ($q) => $q->where('warehouse_id', $scopedWarehouseId))
            ->select('customer_id', DB::raw('COUNT(*) as orders'), DB::raw('SUM(grand_total) as total'))
            ->with('customer:id,name')
            ->whereNotNull('customer_id')
            ->groupBy('customer_id')
            ->orderByDesc('total')
            ->take(5)
            ->get()
            ->map(function ($row) {
                return [
                    'name' => $row->customer?->name ?? 'Pelanggan',
                    'orders' => (int) $row->orders,
                    'total' => (int) $row->total,
                ];
            });

        $topLocations = Transaction::when($scopedWarehouseId, fn ($q) => $q->where('transactions.warehouse_id', $scopedWarehouseId))
            ->join('customers', 'transactions.customer_id', '=', 'customers.id')
            ->select('customers.village_name', DB::raw('COUNT(*) as orders'))
            ->whereNotNull('customers.village_name')
            ->groupBy('customers.village_name')
            ->orderByDesc('orders')
            ->take(5)
            ->get()
            ->map(function ($row) {
                return [
                    'name' => $row->village_name ?? 'Lainnya',
                    'orders' => (int) $row->orders,
                ];
            });

        $activeShifts = CashierShift::query()
            ->when($scopedWarehouseId, fn ($q) => $q->where('warehouse_id', $scopedWarehouseId))
            ->with('user:id,name')
            ->open()
            ->latest('opened_at')
            ->take(5)
            ->get()
            ->map(function (CashierShift $shift) use ($cashierShiftService) {
                $summary = $cashierShiftService->calculateSummary($shift);

                return [
                    'id' => $shift->id,
                    'opened_at' => optional($shift->opened_at)?->toISOString(),
                    'opening_cash' => (int) $shift->opening_cash,
                    'expected_cash' => $summary['expected_cash'],
                    'transactions_count' => $summary['transactions_count'],
                    'cash_sales_total' => $summary['cash_sales_total'],
                    'user' => [
                        'id' => $shift->user?->id,
                        'name' => $shift->user?->name,
                    ],
                ];
            })
            ->values();

        return Inertia::render('Dashboard/Index', [
            'totalCategories' => $totalCategories,
            'totalProducts' => $totalProducts,
            'totalTransactions' => $totalTransactions,
            'totalCustomers' => $totalCustomers,
            'revenueTrend' => $revenueTrend,
            'totalRevenue' => (int) $totalRevenue,
            'totalProfit' => (int) $totalProfit,
            'averageOrder' => (int) round($averageOrder),
            'todayTransactions' => (int) $todayTransactions,
            'todaySales' => (int) $todaySales,
            'todayProfit' => (int) $todayProfit,
            'monthlyTarget' => (int) $monthlyTarget,
            'currentMonthSales' => (int) $currentMonthSales,
            'topProducts' => $topProducts,
            'lowStockProducts' => $lowStockProducts,
            'slowMovingProducts' => $slowMovingProducts,
            'recentTransactions' => $recentTransactions,
            'topCustomers' => $topCustomers,
            'topLocations' => $topLocations,
            'activeShifts' => $activeShifts,
            'warehouses' => $warehouses,
            'selectedWarehouseId' => $scopedWarehouseId ? (int) $scopedWarehouseId : null,
            'isLockedBranch' => $user && ! $user->isHQ(),
        ]);
    }
}
