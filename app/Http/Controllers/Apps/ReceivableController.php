<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\Receivable;
use App\Models\ReceivablePayment;
use App\Models\Setting;
use App\Models\Warehouse;
use App\Services\ReceivableService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ReceivableController extends Controller
{
    public function __construct(
        private readonly ReceivableService $receivableService
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $isLockedBranch = $user && ! $user->isHQ();
        $warehouseId = $isLockedBranch
            ? $user->warehouse_id
            : ($request->input('warehouse_id') ? (int) $request->input('warehouse_id') : null);

        $filters = [
            'status' => $request->input('status'),
            'customer' => $request->input('customer'),
            'invoice' => $request->input('invoice'),
            'due_from' => $request->input('due_from'),
            'due_to' => $request->input('due_to'),
            'warehouse_id' => $warehouseId,
        ];

        $query = Receivable::with(['customer:id,name', 'transaction.warehouse:id,code,name'])
            ->withSum(['payments as total_paid' => fn ($q) => $q->where('status', 'approved')], 'amount')
            ->withCount(['payments as pending_payments_count' => fn ($q) => $q->where('status', 'pending')])
            ->orderByDesc('created_at');

        if ($warehouseId) {
            $query->whereHas('transaction', fn ($t) => $t->where('warehouse_id', $warehouseId));
        }

        $query->when($filters['status'], function ($q, $status) {
            $q->where('status', $status);
        })->when($filters['customer'], function ($q, $customer) {
            $q->where('customer_id', $customer);
        })->when($filters['invoice'], function ($q, $invoice) {
            $q->where('invoice', 'like', '%'.$invoice.'%');
        })->when($filters['due_from'], function ($q, $date) {
            $q->whereDate('due_date', '>=', $date);
        })->when($filters['due_to'], function ($q, $date) {
            $q->whereDate('due_date', '<=', $date);
        });

        $receivables = $query->paginate($this->perPage())->withQueryString();
        $receivables->getCollection()->transform(function ($item) {
            if ($item->status !== 'paid' && $item->due_date && now()->gt($item->due_date)) {
                $item->status = 'overdue';
            }

            return $item;
        });

        $warehouses = $isLockedBranch
            ? Warehouse::where('id', $user->warehouse_id)->get(['id', 'code', 'name'])
            : Warehouse::active()->orderBy('sort_order')->orderBy('code')->get(['id', 'code', 'name']);

        return Inertia::render('Dashboard/Receivables/Index', [
            'receivables' => $receivables,
            'filters' => $filters,
            'warehouses' => $warehouses,
            'is_locked_branch' => $isLockedBranch,
        ]);
    }

    public function show(Receivable $receivable)
    {
        $receivable->load([
            'customer:id,name,no_telp',
            'transaction',
            'payments' => function ($query) {
                $query->orderByDesc('paid_at')->with([
                    'bankAccount:id,bank_name,account_number,account_name,logo',
                    'user:id,name',
                    'approver:id,name',
                ]);
            },
            'campaignLogs' => function ($query) {
                $query->orderByDesc('created_at')->with('campaign:id,name,type');
            },
        ]);

        $bankAccounts = BankAccount::active()->ordered()->get(['id', 'bank_name', 'account_number', 'account_name', 'logo']);
        $approvalThreshold = (float) Setting::get('receivable_approval_threshold', 1000000);

        $storeName = Setting::get('store_name', config('app.name', 'Point of Sales'));
        $isOverdue = $receivable->due_date && now()->startOfDay()->gt($receivable->due_date);
        $template = $isOverdue
            ? Setting::get('wa_template_overdue', 'Halo {{customer_name}}, tagihan {{invoice}} Rp {{remaining}} telah lewat jatuh tempo ({{due_date}}). Mohon segera diselesaikan. Terima kasih.')
            : Setting::get('wa_template_due_soon', 'Halo {{customer_name}}, tagihan {{invoice}} Rp {{remaining}} jatuh tempo pada {{due_date}}. Mohon lakukan pembayaran. Terima kasih.');
        $reason = $isOverdue ? 'overdue' : 'jatuh tempo';

        $customerName = $receivable->customer?->name ?? 'Pelanggan';
        $remaining = number_format($receivable->remaining, 0, ',', '.');
        $total = number_format($receivable->total, 0, ',', '.');
        $dueDate = optional($receivable->due_date)?->format('d/m/Y') ?? '-';

        $defaultReminderMessage = str_replace(
            ['{{customer_name}}', '{{name}}', '{{invoice}}', '{{remaining}}', '{{total}}', '{{due_date}}', '{{store_name}}', '{{reason}}'],
            [$customerName, $customerName, $receivable->invoice, $remaining, $total, $dueDate, $storeName, $reason],
            $template
        );

        return Inertia::render('Dashboard/Receivables/Show', [
            'receivable' => $receivable,
            'bankAccounts' => $bankAccounts,
            'approvalThreshold' => $approvalThreshold,
            'defaultReminderMessage' => $defaultReminderMessage,
            'isOverdue' => (bool) $isOverdue,
        ]);
    }

    public function pay(Request $request, Receivable $receivable)
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'paid_at' => ['required', 'date'],
            'method' => ['required', 'string', 'max:30'],
            'bank_account_id' => ['nullable', 'exists:bank_accounts,id'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $remaining = $receivable->remaining;
        if ($validated['amount'] > $remaining) {
            return back()->with('error', 'Nominal melebihi sisa piutang.');
        }

        $threshold = (float) Setting::get('receivable_approval_threshold', 1000000);
        $needsApproval = ($validated['method'] !== 'cash') || ($validated['amount'] >= $threshold);

        DB::transaction(function () use ($validated, $receivable, $request, $needsApproval) {
            if ($needsApproval) {
                ReceivablePayment::create([
                    'receivable_id' => $receivable->id,
                    'paid_at' => $validated['paid_at'],
                    'amount' => $validated['amount'],
                    'method' => $validated['method'],
                    'bank_account_id' => $validated['bank_account_id'] ?? null,
                    'note' => $validated['note'] ?? null,
                    'user_id' => $request->user()->id,
                    'status' => 'pending',
                ]);
            } else {
                ReceivablePayment::create([
                    'receivable_id' => $receivable->id,
                    'paid_at' => $validated['paid_at'],
                    'amount' => $validated['amount'],
                    'method' => $validated['method'],
                    'bank_account_id' => $validated['bank_account_id'] ?? null,
                    'note' => $validated['note'] ?? null,
                    'user_id' => $request->user()->id,
                    'status' => 'approved',
                    'approved_by' => $request->user()->id,
                    'approved_at' => now(),
                ]);

                $receivable->paid = ($receivable->paid ?? 0) + $validated['amount'];
                $remaining = max(0, ($receivable->total ?? 0) - ($receivable->paid ?? 0));
                $receivable->status = $remaining <= 0 ? 'paid' : 'partial';
                if ($receivable->status !== 'paid' && $receivable->due_date && now()->gt($receivable->due_date)) {
                    $receivable->status = 'overdue';
                }
                $receivable->save();

                if ($receivable->transaction) {
                    $receivable->transaction->update([
                        'payment_status' => $receivable->status === 'paid' ? 'paid' : 'unpaid',
                    ]);
                }
            }
        });

        $message = $needsApproval
            ? 'Pembayaran piutang berhasil dicatat dan menunggu persetujuan (Approval) Supervisor/Manager.'
            : 'Pembayaran piutang berhasil dicatat.';

        return redirect()
            ->route('receivables.show', $receivable)
            ->with('success', $message);
    }

    public function aging()
    {
        $summary = $this->receivableService->getAgingSummary();
        $topCustomers = $this->receivableService->getTopCustomersByReceivable(10);
        $collectionRate = $this->receivableService->getCollectionRate();

        return response()->json([
            'aging_summary' => $summary,
            'top_customers' => $topCustomers,
            'collection_rate' => $collectionRate,
        ]);
    }

    public function customerStatement(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'exists:customers,id'],
        ]);

        $data = $this->receivableService->getCustomerStatement($validated['customer_id']);

        return response()->json($data);
    }

    public function updateCollectionNotes(Request $request, Receivable $receivable)
    {
        $validated = $request->validate([
            'collection_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $receivable->update(['collection_notes' => $validated['collection_notes'] ?? null]);

        return back()->with('success', 'Catatan penagihan berhasil disimpan.');
    }
}
