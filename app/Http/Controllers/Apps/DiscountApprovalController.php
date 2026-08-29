<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\DiscountApprovalLog;
use App\Models\Transaction;
use App\Services\AuditLogService;
use App\Services\UnitConversionService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DiscountApprovalController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    public function pending()
    {
        $pending = Transaction::where('discount_approval_status', 'pending')
            ->with(['cashier:id,name', 'customer:id,name', 'cashierShift:id,opened_at'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($t) => [
                'id' => $t->id,
                'invoice' => $t->invoice,
                'cashier' => $t->cashier?->name,
                'customer' => $t->customer?->name ?? 'Umum',
                'discount' => (int) $t->discount,
                'grand_total' => (int) $t->grand_total,
                'created_at' => $t->created_at?->toISOString(),
            ]);

        return Inertia::render('Dashboard/DiscountApprovals', [
            'pendingTransactions' => $pending,
        ]);
    }

    public function approve(Transaction $transaction)
    {
        abort_if($transaction->discount_approval_status !== 'pending', 404);

        $this->logAndUpdate($transaction, 'approved');

        return back()->with('success', 'Diskon disetujui.');
    }

    public function deny(Request $request, Transaction $transaction)
    {
        abort_if($transaction->discount_approval_status !== 'pending', 404);

        $this->logAndUpdate($transaction, 'denied', $request->notes);

        return back()->with('success', 'Diskon ditolak.');
    }

    private function logAndUpdate(Transaction $transaction, string $status, ?string $notes = null): void
    {
        \DB::transaction(function () use ($transaction, $status, $notes) {
            $originalDiscount = (int) $transaction->discount;
            $newDiscount = $status === 'approved' ? $originalDiscount : 0;
            $newGrandTotal = $status === 'approved'
                ? (int) $transaction->grand_total
                : (int) $transaction->grand_total + $originalDiscount;

            $isCash = $transaction->payment_method === 'cash';
            $cashAmount = (int) $transaction->cash;
            $changeAmount = $isCash ? max(0, $cashAmount - $newGrandTotal) : 0;

            $paymentStatus = 'paid';
            if ($status === 'denied') {
                if ($transaction->payment_method === 'pay_later') {
                    $paymentStatus = 'unpaid';
                } elseif ($isCash) {
                    $paymentStatus = $cashAmount >= $newGrandTotal ? 'paid' : 'pending';
                } else {
                    $paymentStatus = 'pending';
                }
            }

            $transaction->update([
                'discount' => $newDiscount,
                'grand_total' => $newGrandTotal,
                'change' => $changeAmount,
                'discount_approval_status' => $status,
                'discount_approved_by' => auth()->id(),
                'discount_approved_at' => now(),
                'payment_status' => $paymentStatus,
            ]);

            if ($transaction->receivable) {
                $transaction->receivable->update([
                    'total' => $newGrandTotal,
                    'status' => $paymentStatus === 'paid' ? 'paid' : 'unpaid',
                ]);
            }

            if ($status === 'denied' && $transaction->profits()->exists()) {
                $details = $transaction->details()->with('product')->get();
                $unitConversion = app(UnitConversionService::class);

                $transaction->profits()->delete();
                foreach ($details as $detail) {
                    $unitBuyPrice = $detail->unit_id && $detail->product
                        ? $unitConversion->getBuyPrice($detail->product, $detail->unit_id)
                        : (int) (($detail->product?->buy_price ?? 0) * ($detail->conversion_factor ?: 1));
                    $totalBuyPrice = $unitBuyPrice * $detail->qty;
                    $lineTotal = (int) $detail->price;
                    $profitTotal = $lineTotal - $totalBuyPrice;

                    $transaction->profits()->create([
                        'total' => $profitTotal,
                    ]);
                }
            }

            DiscountApprovalLog::where('transaction_id', $transaction->id)
                ->where('status', 'pending')
                ->update([
                    'status' => $status,
                    'responded_by' => auth()->id(),
                    'responded_at' => now(),
                    'notes' => $notes,
                ]);
        });

        $this->auditLogService->log(
            event: 'discount_approval.'.$status,
            module: 'transactions',
            auditable: $transaction,
            description: "Diskon transaksi {$transaction->invoice} di".($status === 'approved' ? 'setujui' : 'tolak'),
            after: ['discount_approval_status' => $status],
        );
    }
}
