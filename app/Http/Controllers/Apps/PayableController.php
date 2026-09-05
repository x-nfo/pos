<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\Payable;
use App\Models\PayablePayment;
use App\Models\Supplier;
use App\Models\Warehouse;
use App\Services\AuditLogService;
use App\Services\DocumentNumberService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class PayableController extends Controller
{
    public function __construct(
        private readonly DocumentNumberService $documentNumberService,
        private readonly AuditLogService $auditLogService
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $scopedWarehouseId = ! $user->isHQ() ? $user->warehouse_id : $request->input('warehouse_id');

        $filters = [
            'status' => $request->input('status'),
            'supplier' => $request->input('supplier'),
            'invoice' => $request->input('invoice'),
            'due_from' => $request->input('due_from'),
            'due_to' => $request->input('due_to'),
            'warehouse_id' => $scopedWarehouseId,
        ];

        $query = Payable::with([
            'supplier:id,name',
            'warehouse:id,code,name',
            'purchaseOrder.warehouse:id,code,name',
        ])
            ->withSum('payments as total_paid', 'amount')
            ->orderByDesc('created_at');

        if ($scopedWarehouseId) {
            $query->where(function ($q) use ($scopedWarehouseId) {
                $q->where('warehouse_id', $scopedWarehouseId)
                    ->orWhereHas('purchaseOrder', fn ($po) => $po->where('warehouse_id', $scopedWarehouseId));
            });
        }

        $query->when($filters['status'], function ($q, $status) {
            $q->where('status', $status);
        })->when($filters['supplier'], function ($q, $supplier) {
            $q->where('supplier_id', $supplier);
        })->when($filters['invoice'], function ($q, $invoice) {
            $q->where(function ($sub) use ($invoice) {
                $sub->where('document_number', 'like', '%'.$invoice.'%')
                    ->orWhere('vendor_invoice_number', 'like', '%'.$invoice.'%');
            });
        })->when($filters['due_from'], function ($q, $date) {
            $q->whereDate('due_date', '>=', $date);
        })->when($filters['due_to'], function ($q, $date) {
            $q->whereDate('due_date', '<=', $date);
        });

        $payables = $query->paginate($this->perPage())->withQueryString();
        $payables->getCollection()->transform(function ($item) {
            if ($item->status !== 'paid' && $item->due_date && now()->gt($item->due_date)) {
                $item->status = 'overdue';
            }

            return $item;
        });

        $suppliers = Supplier::orderBy('name')->get(['id', 'name']);
        $warehouses = $user->isHQ()
            ? Warehouse::orderBy('name')->get(['id', 'code', 'name'])
            : [];

        return Inertia::render('Dashboard/Payables/Index', [
            'payables' => $payables,
            'filters' => $filters,
            'suppliers' => $suppliers,
            'warehouses' => $warehouses,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'warehouse_id' => ['nullable', 'exists:warehouses,id'],
            'document_number' => ['nullable', 'string', 'max:100'],
            'vendor_invoice_number' => ['nullable', 'string', 'max:100'],
            'total' => ['required', 'numeric', 'min:1'],
            'due_date' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
        ]);

        $user = $request->user();
        $warehouseId = ! $user->isHQ() ? $user->warehouse_id : ($data['warehouse_id'] ?? null);
        $data['warehouse_id'] = $warehouseId;

        if (empty($data['document_number'])) {
            $data['document_number'] = $this->documentNumberService->generatePayableDocumentNumber($warehouseId);
        }
        $data['status'] = 'unpaid';
        $data['paid'] = 0;

        Payable::create($data);

        return redirect()
            ->route('payables.index')
            ->with('success', 'Hutang supplier berhasil dibuat.');
    }

    public function show(Request $request, Payable $payable)
    {
        $this->authorizeWarehouseAccess($payable, $request->user());

        $payable->load([
            'supplier:id,name,phone,email,address',
            'warehouse:id,code,name,address,phone,type',
            'purchaseOrder:id,document_number,status,warehouse_id',
            'purchaseOrder.warehouse:id,code,name,address,phone,type',
            'payments' => function ($query) {
                $query->orderByDesc('paid_at')->with(['bankAccount:id,bank_name,account_number,account_name,logo', 'user:id,name']);
            },
        ]);
        $payable->payments->each(function ($payment) use ($payable) {
            $payment->setRelation('payable', $payable);
        });
        $bankAccounts = BankAccount::active()->ordered()->get(['id', 'bank_name', 'account_number', 'account_name', 'logo']);

        return Inertia::render('Dashboard/Payables/Show', [
            'payable' => $payable,
            'bankAccounts' => $bankAccounts,
        ]);
    }

    public function supplierStatement(Request $request)
    {
        $request->validate([
            'supplier_id' => ['required', 'exists:suppliers,id'],
        ]);

        $user = $request->user();
        $scopedWarehouseId = ! $user->isHQ() ? $user->warehouse_id : $request->input('warehouse_id');

        $supplier = Supplier::findOrFail($request->input('supplier_id'));

        $query = Payable::where('supplier_id', $supplier->id)
            ->withSum('payments as total_paid', 'amount')
            ->orderBy('due_date');

        if ($scopedWarehouseId) {
            $query->where(function ($q) use ($scopedWarehouseId) {
                $q->where('warehouse_id', $scopedWarehouseId)
                    ->orWhereHas('purchaseOrder', fn ($po) => $po->where('warehouse_id', $scopedWarehouseId));
            });
        }

        $payables = $query->get();

        $payables->transform(function ($item) {
            if ($item->status !== 'paid' && $item->due_date && now()->gt($item->due_date)) {
                $item->status = 'overdue';
            }
            $daysOverdue = $item->status === 'overdue' && $item->due_date
                ? (int) abs(now()->diffInDays($item->due_date))
                : 0;

            $item->aging_bucket = match (true) {
                $item->status === 'paid' => 'paid',
                $daysOverdue <= 0 => 'current',
                $daysOverdue <= 30 => '0-30',
                $daysOverdue <= 60 => '31-60',
                $daysOverdue <= 90 => '61-90',
                default => '90+',
            };

            return $item;
        });

        $agingSummary = $payables->groupBy('aging_bucket')->map(function ($group, $bucket) {
            return [
                'bucket' => $bucket,
                'count' => $group->count(),
                'total' => (float) $group->sum('total'),
                'paid' => (float) $group->sum(fn ($p) => (float) ($p->total_paid ?? $p->paid ?? 0)),
                'remaining' => (float) $group->sum(fn ($p) => max(0, (float) $p->total - (float) ($p->total_paid ?? $p->paid ?? 0))),
            ];
        })->values();

        return response()->json([
            'supplier' => $supplier,
            'payables' => $payables,
            'aging_summary' => $agingSummary,
            'total_outstanding' => (float) $payables->where('status', '!=', 'paid')->sum(fn ($p) => max(0, (float) $p->total - (float) ($p->total_paid ?? $p->paid ?? 0))),
        ]);
    }

    public function pay(Request $request, Payable $payable)
    {
        $this->authorizeWarehouseAccess($payable, $request->user());

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'paid_at' => ['required', 'date'],
            'method' => ['required', 'string', 'max:30'],
            'bank_account_id' => ['nullable', 'exists:bank_accounts,id'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $remaining = $payable->remaining;
        if ($validated['amount'] > $remaining) {
            return back()->with('error', 'Nominal melebihi sisa hutang.');
        }

        try {
            DB::transaction(function () use ($validated, $payable, $request) {
                $lockedPayable = Payable::where('id', $payable->id)->lockForUpdate()->firstOrFail();
                $currentRemaining = $lockedPayable->remaining;

                if ($validated['amount'] > $currentRemaining) {
                    throw new \RuntimeException('Nominal melebihi sisa hutang terkini.');
                }

                PayablePayment::create([
                    'payable_id' => $lockedPayable->id,
                    'paid_at' => $validated['paid_at'],
                    'amount' => $validated['amount'],
                    'method' => $validated['method'],
                    'bank_account_id' => $validated['bank_account_id'] ?? null,
                    'note' => $validated['note'] ?? null,
                    'user_id' => $request->user()->id,
                ]);

                $lockedPayable->paid = (float) ($lockedPayable->paid ?? 0) + (float) $validated['amount'];
                $newRemaining = max(0, (float) ($lockedPayable->total ?? 0) - (float) ($lockedPayable->paid ?? 0));
                $lockedPayable->status = $newRemaining <= 0 ? 'paid' : 'partial';
                if ($lockedPayable->status !== 'paid' && $lockedPayable->due_date && now()->gt($lockedPayable->due_date)) {
                    $lockedPayable->status = 'overdue';
                }
                $lockedPayable->save();
            });
        } catch (\RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return redirect()
            ->route('payables.show', $payable)
            ->with('success', 'Pembayaran hutang berhasil dicatat.');
    }

    public function destroyPayment(Request $request, Payable $payable, PayablePayment $payment)
    {
        $this->authorizeWarehouseAccess($payable, $request->user());

        if ($payment->payable_id !== $payable->id) {
            abort(404);
        }

        $request->validate([
            'password' => ['required', 'string'],
        ]);

        if (! Hash::check($request->input('password'), $request->user()->password)) {
            return back()->with('error', 'Password yang Anda masukkan salah.');
        }

        DB::transaction(function () use ($payable, $payment) {
            $lockedPayable = Payable::where('id', $payable->id)->lockForUpdate()->firstOrFail();
            $paymentAmount = (float) $payment->amount;

            $this->auditLogService->log(
                event: 'payable.payment_deleted',
                module: 'payable',
                auditable: $lockedPayable,
                description: 'Pembayaran hutang '.$lockedPayable->document_number.' senilai Rp '.number_format($paymentAmount, 0, ',', '.').' dihapus/dibatalkan.',
                before: [
                    'payment_id' => $payment->id,
                    'amount' => $paymentAmount,
                    'paid_at' => $payment->paid_at?->toDateString(),
                    'method' => $payment->method,
                    'payable_paid_before' => $lockedPayable->paid,
                ],
                after: [
                    'payable_paid_after' => max(0, (float) ($lockedPayable->paid ?? 0) - $paymentAmount),
                ],
                meta: ['payable_payment_id' => $payment->id],
            );

            $lockedPayable->paid = max(0, (float) ($lockedPayable->paid ?? 0) - $paymentAmount);
            $newRemaining = max(0, (float) ($lockedPayable->total ?? 0) - (float) ($lockedPayable->paid ?? 0));
            $lockedPayable->status = $newRemaining <= 0 ? 'paid' : ($lockedPayable->paid > 0 ? 'partial' : 'unpaid');
            if ($lockedPayable->status !== 'paid' && $lockedPayable->due_date && now()->gt($lockedPayable->due_date)) {
                $lockedPayable->status = 'overdue';
            }
            $lockedPayable->save();

            $payment->delete();
        });

        return redirect()
            ->route('payables.show', $payable)
            ->with('success', 'Pembayaran hutang berhasil dihapus dan saldo dipulihkan.');
    }

    private function authorizeWarehouseAccess(Payable $payable, $user): void
    {
        if (! $user || $user->isHQ()) {
            return;
        }

        $payableWarehouseId = $payable->warehouse_id ?? $payable->purchaseOrder?->warehouse_id;

        if ($payableWarehouseId && (int) $payableWarehouseId !== (int) $user->warehouse_id) {
            abort(403, 'Anda tidak memiliki akses ke data hutang cabang lain.');
        }
    }
}
