<?php

namespace App\Http\Middleware;

use App\Models\CashierShift;
use App\Models\DineOrder;
use App\Models\Payable;
use App\Models\Receivable;
use App\Models\Setting;
use App\Models\Transaction;
use App\Services\BrandingService;
use App\Services\CashierShiftService;
use App\Services\PayableAgingService;
use App\Services\ReceivableService;
use App\Services\WhatsAppService;
use App\Support\ProductionSecurityBaseline;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $lowStockNotifications = [];
        $receivableNotifications = [];
        $payableNotifications = [];
        $discountApprovalNotifications = [];
        $bankPaymentNotifications = [];
        $activeCashierShift = null;
        $securityWarnings = [];
        $stepUpFreshUntil = null;
        $payableAgingSummary = null;
        $receivableAgingSummary = null;
        $pendingApprovalCount = 0;
        $pendingBankPaymentCount = 0;
        $pendingDineOrdersCount = 0;

        if ($request->user()) {
            $user = $request->user();
            $user->loadMissing('warehouse:id,code,name');
            $userId = $user->id;
            $scopedWarehouseId = ! $user->isHQ() ? $user->warehouse_id : null;

            if ($user->can('transactions-confirm-payment')) {
                $pendingBankPaymentCount = Transaction::where('payment_method', 'bank_transfer')
                    ->where('payment_status', 'pending')
                    ->when($scopedWarehouseId, fn ($q) => $q->where('warehouse_id', $scopedWarehouseId))
                    ->count();

                $bankPaymentNotifications = Transaction::where('payment_method', 'bank_transfer')
                    ->where('payment_status', 'pending')
                    ->when($scopedWarehouseId, fn ($q) => $q->where('warehouse_id', $scopedWarehouseId))
                    ->with([
                        'cashier:id,name',
                        'customer:id,name',
                        'bankAccount:id,bank_name,account_name,account_number',
                    ])
                    ->orderByDesc('created_at')
                    ->limit(10)
                    ->get(['id', 'invoice', 'cashier_id', 'customer_id', 'bank_account_id', 'grand_total', 'created_at'])
                    ->map(function ($t) {
                        return [
                            'id' => $t->id,
                            'invoice' => $t->invoice,
                            'cashier' => $t->cashier?->name ?? 'Kasir',
                            'customer' => $t->customer?->name ?? 'Umum',
                            'bank_name' => $t->bankAccount?->bank_name ?? 'Bank',
                            'account_number' => $t->bankAccount?->account_number ?? '',
                            'account_name' => $t->bankAccount?->account_name ?? '',
                            'grand_total' => (int) $t->grand_total,
                            'time' => optional($t->created_at)->diffForHumans(),
                            'created_at' => $t->created_at?->toISOString(),
                        ];
                    })
                    ->toArray();
            }

            if ($user->can('discounts-approve')) {
                $pendingApprovalCount = Transaction::where('discount_approval_status', 'pending')
                    ->when($scopedWarehouseId, fn ($q) => $q->where('warehouse_id', $scopedWarehouseId))
                    ->count();

                $discountApprovalNotifications = Transaction::where('discount_approval_status', 'pending')
                    ->when($scopedWarehouseId, fn ($q) => $q->where('warehouse_id', $scopedWarehouseId))
                    ->with(['cashier:id,name', 'customer:id,name', 'bankAccount:id,bank_name,account_number'])
                    ->orderByDesc('created_at')
                    ->limit(10)
                    ->get(['id', 'invoice', 'cashier_id', 'customer_id', 'bank_account_id', 'payment_method', 'discount', 'grand_total', 'created_at'])
                    ->map(function ($t) {
                        return [
                            'id' => $t->id,
                            'invoice' => $t->invoice,
                            'cashier' => $t->cashier?->name ?? 'Kasir',
                            'customer' => $t->customer?->name ?? 'Umum',
                            'payment_method' => $t->payment_method,
                            'bank_name' => $t->bankAccount?->bank_name,
                            'account_number' => $t->bankAccount?->account_number,
                            'discount' => (int) $t->discount,
                            'grand_total' => (int) $t->grand_total,
                            'time' => optional($t->created_at)->diffForHumans(),
                            'created_at' => $t->created_at?->toISOString(),
                        ];
                    })
                    ->toArray();
            }

            if ($user->can('dine-orders-access')) {
                $pendingDineOrdersCount = DineOrder::pending()->count();
            }

            $lowStockNotifications = DB::table('product_warehouse')
                ->join('products', 'product_warehouse.product_id', '=', 'products.id')
                ->join('warehouses', 'product_warehouse.warehouse_id', '=', 'warehouses.id')
                ->where(function ($query) {
                    $query->where('products.min_stock', '>', 0)
                        ->whereColumn('product_warehouse.stock', '<=', 'products.min_stock')
                        ->orWhere('product_warehouse.stock', '<=', 0);
                })
                ->when($scopedWarehouseId, fn ($q) => $q->where('product_warehouse.warehouse_id', $scopedWarehouseId))
                ->whereNotExists(function ($query) use ($userId) {
                    $query->selectRaw('1')
                        ->from('product_notification_reads as pr')
                        ->whereColumn('pr.product_id', 'products.id')
                        ->where('pr.user_id', $userId)
                        ->whereColumn('pr.updated_at', '>=', 'product_warehouse.updated_at');
                })
                ->orderByDesc('product_warehouse.updated_at')
                ->limit(10)
                ->get([
                    'products.id',
                    'products.title',
                    'product_warehouse.stock',
                    'products.min_stock',
                    'product_warehouse.updated_at',
                    'warehouses.name as warehouse_name',
                ])
                ->map(function ($row) {
                    return [
                        'id' => $row->id,
                        'title' => $row->title,
                        'stock' => (int) $row->stock,
                        'min_stock' => (int) $row->min_stock,
                        'warehouse' => $row->warehouse_name,
                        'time' => Carbon::parse($row->updated_at)->diffForHumans(),
                    ];
                });

            if ($user->can('receivables-access')) {
                $receivableService = new ReceivableService;
                $receivableAgingSummary = $receivableService->getAgingSummary($scopedWarehouseId);

                $receivableNotifications = Receivable::whereNot('status', 'paid')
                    ->whereNotNull('due_date')
                    ->whereDate('due_date', '<=', now()->addDays(3))
                    ->when($scopedWarehouseId, function ($q) use ($scopedWarehouseId) {
                        $q->whereHas('transaction', fn ($t) => $t->where('warehouse_id', $scopedWarehouseId));
                    })
                    ->orderBy('due_date')
                    ->limit(5)
                    ->get(['id', 'invoice', 'customer_id', 'due_date', 'total', 'paid', 'status'])
                    ->map(function ($item) {
                        $remaining = max(0, ($item->total ?? 0) - ($item->paid ?? 0));

                        return [
                            'id' => $item->id,
                            'title' => "Piutang: {$item->invoice}",
                            'subtitle' => 'Sisa '.number_format($remaining, 0, ',', '.'),
                            'time' => optional($item->due_date)->diffForHumans(),
                            'status' => $item->status,
                            'aging_bucket' => $item->aging_bucket,
                        ];
                    });
            }

            if ($user->can('payables-access')) {
                $payableAgingService = new PayableAgingService;
                $payableAgingSummary = $payableAgingService->getAgingSummary();

                $payableNotifications = Payable::whereNot('status', 'paid')
                    ->whereNotNull('due_date')
                    ->whereDate('due_date', '<=', now()->addDays(3))
                    ->when($scopedWarehouseId, function ($q) use ($scopedWarehouseId) {
                        $q->whereHas('purchaseOrder', fn ($po) => $po->where('warehouse_id', $scopedWarehouseId));
                    })
                    ->orderBy('due_date')
                    ->limit(5)
                    ->get(['id', 'document_number', 'due_date', 'total', 'paid', 'status'])
                    ->map(function ($item) {
                        $remaining = max(0, ($item->total ?? 0) - ($item->paid ?? 0));

                        return [
                            'id' => $item->id,
                            'title' => "Hutang: {$item->document_number}",
                            'subtitle' => 'Sisa '.number_format($remaining, 0, ',', '.'),
                            'time' => optional($item->due_date)->diffForHumans(),
                            'status' => $item->status,
                            'aging_bucket' => $item->aging_bucket,
                        ];
                    });
            }

            $activeShift = CashierShift::query()
                ->with('user:id,name', 'warehouse:id,code,name')
                ->open()
                ->where('user_id', $userId)
                ->latest('opened_at')
                ->first();

            if ($activeShift) {
                $activeCashierShift = app(CashierShiftService::class)->summarizeForDisplay($activeShift);
            }

            $securityWarnings = ProductionSecurityBaseline::issues();

            $confirmedAt = (int) $request->session()->get('auth.password_confirmed_at', 0);
            if ($confirmedAt > 0) {
                $stepUpFreshUntil = now()
                    ->setTimestamp($confirmedAt + (int) config('auth.password_timeout', 900))
                    ->toISOString();
            }
        }

        $storeProfile = [
            'name' => 'Toko Anda',
            'logo' => null,
            'address' => '',
            'phone' => '',
            'email' => '',
            'website' => '',
            'city' => '',
        ];

        if (Schema::hasTable('settings')) {
            $logo = Setting::get('store_logo');
            if ($logo && ! str_starts_with($logo, 'http') && ! str_starts_with($logo, '/storage')) {
                $logo = asset('storage/'.ltrim($logo, '/'));
            }

            $storeProfile = [
                'name' => Setting::get('store_name', 'Toko Anda'),
                'logo' => $logo,
                'address' => Setting::get('store_address', ''),
                'phone' => Setting::get('store_phone', ''),
                'email' => Setting::get('store_email', ''),
                'website' => Setting::get('store_website', ''),
                'city' => Setting::get('store_city', ''),
            ];
        }

        $waReady = false;
        if (Schema::hasTable('settings') && Setting::getBool('wa_enabled', false) && ! empty(Setting::get('wa_service_url'))) {
            $waReady = Cache::remember('wa_connection_status', 30, function () {
                $status = app(WhatsAppService::class)->status();

                return $status['connected'] ?? false;
            });
        }

        $branding = app(BrandingService::class)->getBranding();

        return [
            ...parent::share($request),
            'branding' => $branding,
            'auth' => [
                'user' => $request->user(),
                'permissions' => $request->user() ? $request->user()->getPermissions() : [],
                'super' => $request->user() ? $request->user()->isSuperAdmin() : false,
                'is_hq' => $request->user() ? $request->user()->isHQ() : false,
                'warehouse' => $request->user()?->warehouse ? [
                    'id' => $request->user()->warehouse->id,
                    'code' => $request->user()->warehouse->code,
                    'name' => $request->user()->warehouse->name,
                ] : null,
            ],
            'locale' => [
                'current' => app()->getLocale(),
                'available' => ['id', 'en'],
                'names' => [
                    'id' => 'Indonesia',
                    'en' => 'English',
                ],
            ],
            'lowStockNotifications' => $lowStockNotifications,
            'receivableNotifications' => $receivableNotifications,
            'payableNotifications' => $payableNotifications,
            'discountApprovalNotifications' => $discountApprovalNotifications,
            'bankPaymentNotifications' => $bankPaymentNotifications,
            'pendingBankPaymentCount' => $pendingBankPaymentCount,
            'payableAgingSummary' => $payableAgingSummary,
            'receivableAgingSummary' => $receivableAgingSummary,
            'activeCashierShift' => $activeCashierShift,
            'storeProfile' => $storeProfile,
            'pendingApprovalCount' => $pendingApprovalCount,
            'pendingDineOrdersCount' => $pendingDineOrdersCount,
            'appVersion' => config('app.version'),
            'wa_ready' => $waReady,
            'security' => [
                'warnings' => $securityWarnings,
                'publicRegistrationEnabled' => config('security.auth.public_registration'),
                'stepUpFreshUntil' => $stepUpFreshUntil,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'warning' => fn () => $request->session()->get('warning'),
                'info' => fn () => $request->session()->get('info'),
            ],
        ];
    }
}
