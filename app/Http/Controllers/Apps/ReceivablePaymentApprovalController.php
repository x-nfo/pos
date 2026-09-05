<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Receivable;
use App\Models\ReceivablePayment;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReceivablePaymentApprovalController extends Controller
{
    public function approve(Request $request, ReceivablePayment $payment)
    {
        $user = $request->user();

        if ($user && ! $user->isHQ()) {
            $payment->loadMissing('receivable.transaction');
            $txWarehouseId = $payment->receivable?->transaction?->warehouse_id;
            if ($txWarehouseId && (int) $txWarehouseId !== (int) $user->warehouse_id) {
                abort(403, 'Anda tidak memiliki wewenang menyetujui pembayaran piutang cabang lain.');
            }
        }

        // Edge case: Self approval prevention (except for super-admin)
        if ($payment->user_id === $user->id && ! $user->hasRole('super-admin')) {
            return back()->with('error', 'Anda tidak dapat menyetujui pembayaran yang Anda input sendiri.');
        }

        try {
            DB::transaction(function () use ($request, $payment, $user) {
                // Lock payment row to prevent race conditions
                $payment = ReceivablePayment::where('id', $payment->id)->lockForUpdate()->firstOrFail();

                if ($payment->status !== 'pending') {
                    throw new Exception('Pembayaran ini sudah diproses sebelumnya (Status: '.$payment->status.').');
                }

                // Lock receivable row
                $receivable = Receivable::where('id', $payment->receivable_id)->lockForUpdate()->firstOrFail();

                // Validate remaining balance
                if ($payment->amount > $receivable->remaining) {
                    throw new Exception('Nominal pembayaran (Rp '.number_format($payment->amount, 0, ',', '.').') melebihi sisa piutang saat ini (Rp '.number_format($receivable->remaining, 0, ',', '.').').');
                }

                $payment->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'approval_notes' => $request->input('approval_notes'),
                ]);

                $receivable->paid = ($receivable->paid ?? 0) + $payment->amount;
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
            });

            return back()->with('success', 'Pembayaran piutang berhasil disetujui (Approved).');
        } catch (Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function reject(Request $request, ReceivablePayment $payment)
    {
        $validated = $request->validate([
            'approval_notes' => ['required', 'string', 'max:500'],
        ], [
            'approval_notes.required' => 'Alasan penolakan wajib diisi.',
        ]);

        $user = $request->user();

        if ($user && ! $user->isHQ()) {
            $payment->loadMissing('receivable.transaction');
            $txWarehouseId = $payment->receivable?->transaction?->warehouse_id;
            if ($txWarehouseId && (int) $txWarehouseId !== (int) $user->warehouse_id) {
                abort(403, 'Anda tidak memiliki wewenang menolak pembayaran piutang cabang lain.');
            }
        }

        // Edge case: Self rejection prevention (except for super-admin)
        if ($payment->user_id === $user->id && ! $user->hasRole('super-admin')) {
            return back()->with('error', 'Anda tidak dapat memproses pembayaran yang Anda input sendiri.');
        }

        try {
            DB::transaction(function () use ($validated, $payment, $user) {
                // Lock payment row to prevent race conditions
                $payment = ReceivablePayment::where('id', $payment->id)->lockForUpdate()->firstOrFail();

                if ($payment->status !== 'pending') {
                    throw new Exception('Pembayaran ini sudah diproses sebelumnya (Status: '.$payment->status.').');
                }

                $payment->update([
                    'status' => 'rejected',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'approval_notes' => $validated['approval_notes'],
                ]);
            });

            return back()->with('success', 'Pembayaran piutang telah ditolak (Rejected).');
        } catch (Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }
}
