<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\Warehouse;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class BankAccountController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    /**
     * Display listing of bank accounts
     */
    public function index()
    {
        $bankAccounts = BankAccount::with('warehouse:id,code,name')
            ->ordered()
            ->get();

        $warehouses = Warehouse::active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'code', 'name']);

        return Inertia::render('Dashboard/Settings/BankAccounts', [
            'bankAccounts' => $bankAccounts,
            'warehouses' => $warehouses,
        ]);
    }

    /**
     * Create form
     */
    public function create()
    {
        $warehouses = Warehouse::active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'code', 'name']);

        return Inertia::render('Dashboard/Settings/BankAccountForm', [
            'bankAccount' => null,
            'warehouses' => $warehouses,
        ]);
    }

    /**
     * Edit form
     */
    public function edit(BankAccount $bankAccount)
    {
        $bankAccount->load('warehouse:id,code,name');

        $warehouses = Warehouse::active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'code', 'name']);

        return Inertia::render('Dashboard/Settings/BankAccountForm', [
            'bankAccount' => $bankAccount,
            'warehouses' => $warehouses,
        ]);
    }

    /**
     * Store a new bank account
     */
    public function store(Request $request)
    {
        if (! $request->hasFile('logo')) {
            $request->request->remove('logo');
        }

        $validated = $request->validate([
            'warehouse_id' => 'nullable|integer|exists:warehouses,id',
            'bank_name' => 'required|string|max:100',
            'account_number' => 'required|string|max:50',
            'account_name' => 'required|string|max:100',
            'logo' => 'nullable|image|mimes:png,jpg,jpeg,svg,webp|max:2048',
            'is_active' => 'nullable|boolean',
        ]);

        if ($request->hasFile('logo')) {
            $validated['logo'] = $request->file('logo')->store('bank-logos', 'public');
        }

        $validated['is_active'] = $request->boolean('is_active');
        $validated['sort_order'] = BankAccount::max('sort_order') + 1;

        $bankAccount = BankAccount::create($validated);

        $this->auditLogService->log(
            event: 'bank_account.created',
            module: 'bank_accounts',
            auditable: $bankAccount,
            description: 'Rekening bank ditambahkan.',
            after: $this->bankAccountPayload($bankAccount)
        );

        return redirect()
            ->route('settings.bank-accounts.index')
            ->with('success', 'Rekening bank berhasil ditambahkan.');
    }

    /**
     * Update bank account
     */
    public function update(Request $request, BankAccount $bankAccount)
    {
        $before = $this->bankAccountPayload($bankAccount);

        if (! $request->hasFile('logo')) {
            $request->request->remove('logo');
        }

        $validated = $request->validate([
            'warehouse_id' => 'nullable|integer|exists:warehouses,id',
            'bank_name' => 'required|string|max:100',
            'account_number' => 'required|string|max:50',
            'account_name' => 'required|string|max:100',
            'logo' => 'nullable|image|mimes:png,jpg,jpeg,svg,webp|max:2048',
            'is_active' => 'nullable|boolean',
            'remove_logo' => 'nullable|boolean',
        ]);

        if ($request->boolean('remove_logo')) {
            if ($bankAccount->logo) {
                Storage::disk('public')->delete($bankAccount->logo);
            }
            $validated['logo'] = null;
        } elseif ($request->hasFile('logo')) {
            if ($bankAccount->logo) {
                Storage::disk('public')->delete($bankAccount->logo);
            }
            $validated['logo'] = $request->file('logo')->store('bank-logos', 'public');
        }

        $validated['is_active'] = $request->boolean('is_active');

        $bankAccount->update($validated);

        $this->auditLogService->log(
            event: 'bank_account.updated',
            module: 'bank_accounts',
            auditable: $bankAccount,
            description: 'Rekening bank diperbarui.',
            before: $before,
            after: $this->bankAccountPayload($bankAccount->fresh())
        );

        return redirect()
            ->route('settings.bank-accounts.index')
            ->with('success', 'Rekening bank berhasil diupdate.');
    }

    /**
     * Delete bank account
     */
    public function destroy(BankAccount $bankAccount)
    {
        $before = $this->bankAccountPayload($bankAccount);

        // Check if used in transactions or payments
        if ($bankAccount->transactions()->exists()
            || $bankAccount->receivablePayments()->exists()
            || $bankAccount->payablePayments()->exists()) {
            return redirect()
                ->route('settings.bank-accounts.index')
                ->with('error', 'Rekening bank tidak bisa dihapus karena sudah digunakan di transaksi atau riwayat pembayaran.');
        }

        // Delete logo
        if ($bankAccount->logo) {
            Storage::disk('public')->delete($bankAccount->logo);
        }

        $bankAccount->delete();

        $this->auditLogService->log(
            event: 'bank_account.deleted',
            module: 'bank_accounts',
            auditable: $bankAccount,
            description: 'Rekening bank dihapus.',
            before: $before
        );

        return redirect()
            ->route('settings.bank-accounts.index')
            ->with('success', 'Rekening bank berhasil dihapus.');
    }

    /**
     * Toggle active status
     */
    public function toggleActive(BankAccount $bankAccount)
    {
        $before = $this->bankAccountPayload($bankAccount);

        $bankAccount->update([
            'is_active' => ! $bankAccount->is_active,
        ]);

        $status = $bankAccount->is_active ? 'diaktifkan' : 'dinonaktifkan';

        $this->auditLogService->log(
            event: 'bank_account.toggled',
            module: 'bank_accounts',
            auditable: $bankAccount,
            description: "Status rekening bank {$status}.",
            before: $before,
            after: $this->bankAccountPayload($bankAccount->fresh())
        );

        return redirect()
            ->route('settings.bank-accounts.index')
            ->with('success', "Rekening {$bankAccount->bank_name} berhasil {$status}.");
    }

    /**
     * Update sort order
     */
    public function updateOrder(Request $request)
    {
        $validated = $request->validate([
            'order' => 'required|array',
            'order.*' => 'integer|exists:bank_accounts,id',
        ]);

        $beforeOrder = BankAccount::ordered()
            ->get(['id', 'bank_name', 'sort_order'])
            ->map(fn (BankAccount $account) => [
                'id' => $account->id,
                'bank_name' => $account->bank_name,
                'sort_order' => (int) $account->sort_order,
            ])
            ->all();

        foreach ($validated['order'] as $index => $id) {
            BankAccount::where('id', $id)->update(['sort_order' => $index]);
        }

        $afterOrder = BankAccount::ordered()
            ->get(['id', 'bank_name', 'sort_order'])
            ->map(fn (BankAccount $account) => [
                'id' => $account->id,
                'bank_name' => $account->bank_name,
                'sort_order' => (int) $account->sort_order,
            ])
            ->all();

        $this->auditLogService->log(
            event: 'bank_account.reordered',
            module: 'bank_accounts',
            auditable: ['target_label' => 'Bank Accounts'],
            description: 'Urutan rekening bank diperbarui.',
            before: ['order' => $beforeOrder],
            after: ['order' => $afterOrder]
        );

        return response()->json(['success' => true]);
    }

    private function bankAccountPayload(BankAccount $bankAccount): array
    {
        $bankAccount->loadMissing('warehouse:id,name');

        return [
            'warehouse_id' => $bankAccount->warehouse_id,
            'warehouse_name' => $bankAccount->warehouse?->name ?? 'Semua Cabang',
            'bank_name' => $bankAccount->bank_name,
            'account_number_masked' => $this->auditLogService->maskAccountNumber($bankAccount->account_number),
            'account_name' => $bankAccount->account_name,
            'is_active' => (bool) $bankAccount->is_active,
            'sort_order' => (int) $bankAccount->sort_order,
        ];
    }
}
