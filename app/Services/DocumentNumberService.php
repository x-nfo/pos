<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerVoucher;
use App\Models\Payable;
use App\Models\SalesReturn;
use App\Models\StockOpname;
use App\Models\Transaction;
use App\Models\Warehouse;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;

class DocumentNumberService
{
    /**
     * Generate collision-free transaction invoice number (TRX-XXXXXXXXXX).
     */
    public function generateTransactionInvoice(int $maxAttempts = 10): string
    {
        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            $random = Str::upper(Str::random(10));
            $invoice = 'TRX-'.$random;

            if (! Transaction::where('invoice', $invoice)->exists()) {
                return $invoice;
            }
        }

        // Fallback with high-entropy timestamp + random
        return 'TRX-'.now()->format('YmdHis').'-'.Str::upper(Str::random(4));
    }

    /**
     * Generate sequential document number for models like PurchaseOrder, GoodsReceiving, etc.
     */
    public function generateSequentialNumber(
        string $modelClass,
        string $column = 'document_number',
        string $prefix = 'DOC-',
        int $padLength = 4
    ): string {
        $last = $modelClass::where($column, 'like', $prefix.'%')
            ->orderByDesc($column)
            ->value($column);

        $next = $last ? (int) Str::afterLast($last, '-') + 1 : 1;

        return $prefix.str_pad((string) $next, $padLength, '0', STR_PAD_LEFT);
    }

    /**
     * Execute a callback and automatically retry if a duplicate entry / unique constraint violation occurs.
     */
    public function executeWithRetry(callable $callback, int $maxAttempts = 3): mixed
    {
        $attempts = 0;

        while (true) {
            try {
                $attempts++;

                return $callback();
            } catch (QueryException $e) {
                $isDuplicate = in_array((string) $e->getCode(), ['23000', '1062'], true)
                    || str_contains(strtolower($e->getMessage()), 'duplicate')
                    || str_contains(strtolower($e->getMessage()), 'unique');

                if ($isDuplicate && $attempts < $maxAttempts) {
                    usleep(random_int(10000, 50000)); // 10ms to 50ms jitter

                    continue;
                }

                throw $e;
            }
        }
    }

    /**
     * Generate collision-free customer voucher code (VCR-XXXXXXXX).
     */
    public function generateVoucherCode(int $maxAttempts = 10): string
    {
        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            $code = 'VCR-'.Str::upper(Str::random(8));

            if (! CustomerVoucher::where('code', $code)->exists()) {
                return $code;
            }
        }

        return 'VCR-'.now()->format('YmdHis').'-'.Str::upper(Str::random(4));
    }

    /**
     * Generate collision-free member code (MEM-XXXXXXXX).
     */
    public function generateMemberCode(int $maxAttempts = 10): string
    {
        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            $code = 'MEM-'.Str::upper(Str::random(8));

            if (! Customer::where('member_code', $code)->exists()) {
                return $code;
            }
        }

        return 'MEM-'.now()->format('YmdHis').'-'.Str::upper(Str::random(4));
    }

    /**
     * Generate collision-free sales return code (SR-YYYYMMDDHis-XXXX).
     */
    public function generateSalesReturnCode(): string
    {
        do {
            $code = 'SR-'.now()->format('YmdHis').'-'.Str::upper(Str::random(4));
        } while (SalesReturn::where('code', $code)->exists());

        return $code;
    }

    /**
     * Format warehouse/branch code for document prefixes (alphanumeric only, uppercase, fallback 'HQ').
     */
    public function formatBranchCode(Warehouse|int|string|null $warehouse = null): string
    {
        if ($warehouse instanceof Warehouse) {
            $code = $warehouse->code;
        } elseif (is_numeric($warehouse)) {
            $code = Warehouse::where('id', (int) $warehouse)->value('code');
        } elseif (is_string($warehouse)) {
            $code = $warehouse;
        } else {
            $code = null;
        }

        if (empty($code)) {
            return 'HQ';
        }

        $sanitized = Str::upper(preg_replace('/[^A-Za-z0-9]/', '', (string) $code));

        return ! empty($sanitized) ? substr($sanitized, 0, 10) : 'HQ';
    }

    /**
     * Generate sequential payable document number (AP-[KODE_CABANG]-[YYYYMMDD]-[0001]).
     */
    public function generatePayableDocumentNumber(Warehouse|int|string|null $warehouse = null): string
    {
        $branchCode = $this->formatBranchCode($warehouse);
        $prefix = 'AP-'.$branchCode.'-'.now()->format('Ymd').'-';

        return $this->generateSequentialNumber(
            modelClass: Payable::class,
            column: 'document_number',
            prefix: $prefix,
            padLength: 4
        );
    }

    /**
     * Generate collision-free stock opname code (SO-YYYYMMDDHis-XXXX).
     */
    public function generateStockOpnameCode(): string
    {
        do {
            $code = 'SO-'.now()->format('YmdHis').'-'.Str::upper(Str::random(4));
        } while (StockOpname::where('code', $code)->exists());

        return $code;
    }
}
