<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentSetting;
use App\Models\Setting;
use App\Models\Transaction;
use App\Services\StockMutationService;
use App\Services\ThermalPrintService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PaymentWebhookController extends Controller
{
    public function __construct(
        private readonly StockMutationService $stockMutationService
    ) {}

    private function autoPrintIfEnabled(Transaction $transaction): void
    {
        if (Setting::getBool('printer_auto_print', false) && Setting::get('printer_driver', 'browser') === 'server') {
            try {
                $transaction->loadMissing(['details.product', 'details.unit', 'cashier', 'customer']);
                app(ThermalPrintService::class)->printDirectToCups($transaction);
            } catch (\Throwable $e) {
                Log::warning("Auto print on webhook paid failed for {$transaction->invoice}: {$e->getMessage()}");
            }
        }
    }

    /**
     * Handle Midtrans notification webhook
     * URL: POST /api/webhooks/midtrans
     */
    public function midtrans(Request $request)
    {
        try {
            $paymentSetting = PaymentSetting::first();

            if (! $paymentSetting || ! $paymentSetting->midtrans_enabled) {
                return response()->json(['status' => 'error', 'message' => 'Midtrans not configured'], 400);
            }

            // Get notification data
            $orderId = $request->input('order_id');
            $statusCode = $request->input('status_code');
            $grossAmount = $request->input('gross_amount');
            $serverKey = $paymentSetting->resolvedSecret('midtrans_server_key');

            // Verify signature
            $signatureKey = $request->input('signature_key');
            $expectedSignature = hash('sha512', $orderId.$statusCode.$grossAmount.$serverKey);

            if ($signatureKey !== $expectedSignature) {
                Log::warning('Midtrans Webhook: Invalid signature', [
                    'provider' => 'midtrans',
                    'order_id' => $orderId,
                    'verification_result' => 'invalid',
                    'error_category' => 'invalid_signature',
                ]);

                return response()->json(['status' => 'error', 'message' => 'Invalid signature'], 403);
            }

            // Find transaction by invoice (order_id)
            $transaction = Transaction::where('invoice', $orderId)->first();

            if (! $transaction) {
                Log::warning('Midtrans Webhook: Transaction not found', [
                    'provider' => 'midtrans',
                    'order_id' => $orderId,
                    'verification_result' => 'valid',
                    'error_category' => 'transaction_not_found',
                ]);

                return response()->json(['status' => 'error', 'message' => 'Transaction not found'], 404);
            }

            // Map Midtrans status to our status
            $transactionStatus = $request->input('transaction_status');
            $fraudStatus = $request->input('fraud_status');

            $newStatus = $this->mapMidtransStatus($transactionStatus, $fraudStatus);
            $previousStatus = $transaction->payment_status;

            // Prevent status update if transaction is already marked paid
            if ($previousStatus === 'paid' && $newStatus !== 'paid') {
                Log::info('Midtrans Webhook: Ignored status update for already paid transaction', [
                    'provider' => 'midtrans',
                    'order_id' => $orderId,
                    'incoming_status' => $newStatus,
                ]);

                return response()->json(['status' => 'success', 'message' => 'Transaction already paid']);
            }

            $transaction->update([
                'payment_status' => $newStatus,
                'payment_reference' => $request->input('transaction_id') ?: $transaction->payment_reference,
            ]);

            if ($newStatus === 'paid') {
                $this->autoPrintIfEnabled($transaction);
            } elseif (in_array($newStatus, ['expired', 'failed', 'cancelled']) && in_array($previousStatus, ['pending', 'unpaid', 'pending_approval'])) {
                $this->stockMutationService->restockTransaction($transaction, reason: $newStatus);
            }

            Log::info('Midtrans Webhook: Transaction updated', [
                'provider' => 'midtrans',
                'order_id' => $orderId,
                'payment_reference' => $request->input('transaction_id'),
                'normalized_status' => $newStatus,
                'verification_result' => 'valid',
            ]);

            return response()->json(['status' => 'success']);

        } catch (\Exception $e) {
            Log::error('Midtrans Webhook Error', [
                'provider' => 'midtrans',
                'order_id' => $request->input('order_id'),
                'verification_result' => 'unknown',
                'error_category' => 'exception',
                'message' => $e->getMessage(),
            ]);

            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Handle Xendit notification webhook
     * URL: POST /api/webhooks/xendit
     */
    public function xendit(Request $request)
    {
        try {
            $paymentSetting = PaymentSetting::first();

            if (! $paymentSetting || ! $paymentSetting->xendit_enabled) {
                return response()->json(['status' => 'error', 'message' => 'Xendit not configured'], 400);
            }

            $callbackToken = $request->header('X-CALLBACK-TOKEN');
            $expectedToken = $paymentSetting->resolvedSecret('xendit_callback_token');

            if (blank($expectedToken)) {
                Log::warning('Xendit Webhook: Callback token is not configured.', [
                    'provider' => 'xendit',
                    'external_id' => $request->input('external_id'),
                    'verification_result' => 'misconfigured',
                    'error_category' => 'missing_callback_token',
                ]);

                return response()->json(['status' => 'error', 'message' => 'Xendit callback token is not configured'], 400);
            }

            if (! is_string($callbackToken) || ! hash_equals($expectedToken, $callbackToken)) {
                Log::warning('Xendit Webhook: Invalid callback token', [
                    'provider' => 'xendit',
                    'external_id' => $request->input('external_id'),
                    'verification_result' => 'invalid',
                    'error_category' => 'invalid_callback_token',
                ]);

                return response()->json(['status' => 'error', 'message' => 'Invalid callback token'], 403);
            }

            $externalId = $request->input('external_id'); // This is our invoice number
            $status = $request->input('status');
            $paymentId = $request->input('id');

            if (blank($externalId) || blank($status) || blank($paymentId)) {
                return response()->json(['status' => 'error', 'message' => 'Invalid payload'], 422);
            }

            // Find transaction by invoice
            $transaction = Transaction::where('invoice', $externalId)->first();

            if (! $transaction) {
                Log::warning('Xendit Webhook: Transaction not found', [
                    'provider' => 'xendit',
                    'external_id' => $externalId,
                    'verification_result' => 'valid',
                    'error_category' => 'transaction_not_found',
                ]);

                return response()->json(['status' => 'error', 'message' => 'Transaction not found'], 404);
            }

            // Map Xendit status to our status
            $newStatus = $this->mapXenditStatus($status);
            $previousStatus = $transaction->payment_status;

            // Prevent status update if transaction is already marked paid
            if ($previousStatus === 'paid' && $newStatus !== 'paid') {
                Log::info('Xendit Webhook: Ignored status update for already paid transaction', [
                    'provider' => 'xendit',
                    'external_id' => $externalId,
                    'incoming_status' => $newStatus,
                ]);

                return response()->json(['status' => 'success', 'message' => 'Transaction already paid']);
            }

            $transaction->update([
                'payment_status' => $newStatus,
                'payment_reference' => $paymentId ?: $transaction->payment_reference,
            ]);

            if ($newStatus === 'paid') {
                $this->autoPrintIfEnabled($transaction);
            } elseif (in_array($newStatus, ['expired', 'failed', 'cancelled']) && in_array($previousStatus, ['pending', 'unpaid', 'pending_approval'])) {
                $this->stockMutationService->restockTransaction($transaction, reason: $newStatus);
            }

            Log::info('Xendit Webhook: Transaction updated', [
                'provider' => 'xendit',
                'external_id' => $externalId,
                'payment_reference' => $paymentId,
                'normalized_status' => $newStatus,
                'verification_result' => 'valid',
            ]);

            return response()->json(['status' => 'success']);

        } catch (\Exception $e) {
            Log::error('Xendit Webhook Error', [
                'provider' => 'xendit',
                'external_id' => $request->input('external_id'),
                'verification_result' => 'unknown',
                'error_category' => 'exception',
                'message' => $e->getMessage(),
            ]);

            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Handle QRISLY notification webhook
     * URL: POST /api/webhooks/qrisly
     */
    public function qrisly(Request $request)
    {
        try {
            $paymentSetting = PaymentSetting::first();

            if (! $paymentSetting || ! $paymentSetting->qrisly_enabled) {
                return response()->json(['success' => false, 'message' => 'QRISLY not configured'], 400);
            }

            $event = $request->input('event');
            $data = $request->input('data', []);
            $historyId = $data['qris_history_id'] ?? $request->input('qris_history_id');
            $status = $data['status'] ?? $request->input('status');

            if (blank($historyId) && blank($event)) {
                return response()->json(['success' => false, 'message' => 'Invalid payload'], 422);
            }

            // Find transaction by payment_reference (history_id)
            $transaction = Transaction::where('payment_reference', (string) $historyId)->first();

            // Fallback match by original amount for recent pending QRISLY transactions
            if (! $transaction && ! empty($data['original_amount'])) {
                $transaction = Transaction::where('payment_method', PaymentSetting::GATEWAY_QRISLY)
                    ->where('payment_status', 'pending')
                    ->where('grand_total', (int) $data['original_amount'])
                    ->latest()
                    ->first();
            }

            if (! $transaction) {
                Log::warning('QRISLY Webhook: Transaction not found', [
                    'provider' => 'qrisly',
                    'history_id' => $historyId,
                    'event' => $event,
                    'verification_result' => 'valid',
                    'error_category' => 'transaction_not_found',
                ]);

                return response()->json(['success' => false, 'message' => 'Transaction not found'], 404);
            }

            $newStatus = $this->mapQrislyStatus($event, $status);
            $previousStatus = $transaction->payment_status;

            // Prevent status update if transaction is already marked paid
            if ($previousStatus === 'paid' && $newStatus !== 'paid') {
                Log::info('QRISLY Webhook: Ignored status update for already paid transaction', [
                    'provider' => 'qrisly',
                    'history_id' => $historyId,
                    'invoice' => $transaction->invoice,
                    'incoming_status' => $newStatus,
                ]);

                return response()->json(['success' => true, 'message' => 'Transaction already paid']);
            }

            $transaction->update([
                'payment_status' => $newStatus,
                'payment_reference' => $historyId ? (string) $historyId : $transaction->payment_reference,
            ]);

            if ($newStatus === 'paid') {
                $this->autoPrintIfEnabled($transaction);
            } elseif (in_array($newStatus, ['expired', 'failed', 'cancelled']) && in_array($previousStatus, ['pending', 'unpaid', 'pending_approval'])) {
                $this->stockMutationService->restockTransaction($transaction, reason: $newStatus);
            }

            Log::info('QRISLY Webhook: Transaction updated', [
                'provider' => 'qrisly',
                'history_id' => $historyId,
                'invoice' => $transaction->invoice,
                'event' => $event,
                'normalized_status' => $newStatus,
                'verification_result' => 'valid',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Webhook received and processed',
            ]);

        } catch (\Exception $e) {
            Log::error('QRISLY Webhook Error', [
                'provider' => 'qrisly',
                'history_id' => $request->input('data.qris_history_id'),
                'verification_result' => 'unknown',
                'error_category' => 'exception',
                'message' => $e->getMessage(),
            ]);

            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Map QRISLY event and status to our payment status
     */
    private function mapQrislyStatus(?string $event, ?string $status): string
    {
        if ($event === 'payment.success' || strtolower((string) $status) === 'paid') {
            return 'paid';
        }

        if ($event === 'payment.expired' || strtolower((string) $status) === 'expired') {
            return 'expired';
        }

        return match (strtolower((string) $status)) {
            'paid' => 'paid',
            'unpaid' => 'pending',
            'expired' => 'expired',
            'cancelled', 'failed' => 'failed',
            default => 'pending',
        };
    }

    /**
     * Map Midtrans transaction status to our payment status
     */
    private function mapMidtransStatus(string $transactionStatus, ?string $fraudStatus = null): string
    {
        // Handle fraud status first
        if ($fraudStatus === 'challenge' || $fraudStatus === 'deny') {
            return 'failed';
        }

        return match ($transactionStatus) {
            'capture', 'settlement' => 'paid',
            'pending' => 'pending',
            'expire' => 'expired',
            'deny', 'cancel' => 'failed',
            default => 'pending',
        };
    }

    /**
     * Map Xendit invoice status to our payment status
     */
    private function mapXenditStatus(string $status): string
    {
        return match (strtoupper($status)) {
            'PAID', 'SETTLED' => 'paid',
            'PENDING' => 'pending',
            'EXPIRED' => 'expired',
            'FAILED' => 'failed',
            default => 'pending',
        };
    }
}
