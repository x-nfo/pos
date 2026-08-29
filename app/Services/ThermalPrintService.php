<?php

namespace App\Services;

use App\Models\SalesReturn;
use App\Models\Setting;
use App\Models\Transaction;

class ThermalPrintService
{
    public function generateReceiptText(Transaction $transaction, string $paperSize = '80mm'): string
    {
        $transaction->loadMissing(['customer', 'details.product', 'details.unit', 'cashier', 'bankAccount']);

        $storeName = Setting::get('store_name', 'Toko Anda');
        $storeAddress = Setting::get('store_address', '');
        $storePhone = Setting::get('store_phone', '');
        $maxWidth = $paperSize === '58mm' ? 32 : 48;

        $lines = [];
        $lines[] = '';
        $lines[] = $this->center(strtoupper($storeName ?? 'TOKO ANDA'), $maxWidth);
        if ($storeAddress) {
            $lines[] = $this->center($storeAddress, $maxWidth);
        }
        if ($storePhone) {
            $lines[] = $this->center('Telp: '.$storePhone, $maxWidth);
        }
        $lines[] = $this->line($maxWidth);
        $lines[] = $this->left('No: '.($transaction->invoice ?? ''), $maxWidth);
        $lines[] = $this->left('Tgl: '.($transaction->created_at?->format('d/m/Y H:i') ?? ''), $maxWidth);
        $lines[] = $this->left('Kasir: '.($transaction->cashier?->name ?? '-'), $maxWidth);
        $lines[] = $this->left('Pelanggan: '.($transaction->customer?->name ?? 'Umum'), $maxWidth);
        $lines[] = $this->line($maxWidth);

        foreach ($transaction->details as $detail) {
            $title = mb_substr($detail->product?->title ?? 'Produk', 0, $maxWidth - 10);
            $linePrice = number_format((int) $detail->price, 0, ',', '.');
            $unitSymbol = $detail->unit?->symbol ? ' '.$detail->unit->symbol : '';
            $lineTotal = "{$detail->qty}{$unitSymbol}x @ ".number_format((int) ($detail->unit_price ?: $detail->price / max(1, $detail->qty)), 0, ',', '.');
            $lines[] = $this->left($title, $maxWidth);
            $lines[] = $this->leftRight($lineTotal, $linePrice, $maxWidth);
        }

        $lines[] = $this->line($maxWidth);
        $subtotal = ($transaction->grand_total ?? 0) + ($transaction->discount ?? 0) - ($transaction->shipping_cost ?? 0) - ($transaction->tax_total ?? 0);
        $lines[] = $this->leftRight('Subtotal', number_format($subtotal, 0, ',', '.'), $maxWidth);
        if (($transaction->discount ?? 0) > 0) {
            $lines[] = $this->leftRight('Diskon', '-'.number_format((int) $transaction->discount, 0, ',', '.'), $maxWidth);
        }
        if (($transaction->tax_total ?? 0) > 0) {
            $lines[] = $this->leftRight('PPN', number_format((int) $transaction->tax_total, 0, ',', '.'), $maxWidth);
        }
        if (($transaction->shipping_cost ?? 0) > 0) {
            $lines[] = $this->leftRight('Ongkir', number_format((int) $transaction->shipping_cost, 0, ',', '.'), $maxWidth);
        }
        $lines[] = $this->line($maxWidth);
        $lines[] = $this->leftRight('TOTAL', number_format((int) $transaction->grand_total, 0, ',', '.'), $maxWidth);

        $paymentMap = [
            'cash' => 'TUNAI',
            'bank_transfer' => 'TRANSFER BANK',
            'qris' => 'QRIS',
            'qrisly' => 'QRIS',
            'midtrans' => 'MIDTRANS',
            'xendit' => 'XENDIT',
            'pay_later' => 'PIUTANG',
        ];
        $methodLabel = $paymentMap[$transaction->payment_method] ?? strtoupper((string) $transaction->payment_method);
        $lines[] = $this->leftRight('Metode', $methodLabel, $maxWidth);

        if ($transaction->payment_method === 'cash' && $transaction->cash > 0) {
            $lines[] = $this->leftRight('Tunai', number_format((int) $transaction->cash, 0, ',', '.'), $maxWidth);
            if (($transaction->change ?? 0) > 0) {
                $lines[] = $this->leftRight('Kembali', number_format((int) $transaction->change, 0, ',', '.'), $maxWidth);
            }
        }

        if ($transaction->payment_status !== 'paid') {
            $lines[] = $this->line($maxWidth);
            $lines[] = $this->center('*** BELUM LUNAS ***', $maxWidth);
            $lines[] = $this->center($transaction->payment_method === 'bank_transfer' ? 'BELUM DIKONFIRMASI' : 'MENUNGGU KONFIRMASI DANA', $maxWidth);
            if ($transaction->payment_method === 'bank_transfer' && $transaction->bankAccount) {
                $lines[] = $this->center('Transfer: '.$transaction->bankAccount->bank_name, $maxWidth);
                $lines[] = $this->center('Rek: '.$transaction->bankAccount->account_number, $maxWidth);
                $lines[] = $this->center('a.n '.$transaction->bankAccount->account_name, $maxWidth);
            }
        } else {
            $lines[] = $this->leftRight('Status', 'LUNAS', $maxWidth);
        }

        $lines[] = $this->line($maxWidth);
        $lines[] = $this->center('Terima kasih', $maxWidth);
        $lines[] = $this->center('Barang yang sudah dibeli', $maxWidth);
        $lines[] = $this->center('tidak dapat ditukar/dikembalikan', $maxWidth);
        $lines[] = '';
        $lines[] = '';

        return implode("\n", $lines);
    }

    public function generateReceiptHtml(Transaction $transaction, ?string $paperSize = null): string
    {
        $paperSize = $paperSize ?: Setting::get('printer_paper_size', '58mm');
        $text = $this->generateReceiptText($transaction, $paperSize);
        $width = $paperSize === '58mm' ? '48mm' : '80mm';
        $fontSize = $paperSize === '58mm' ? '11px' : '12px';

        return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Struk '.$transaction->invoice.'</title><style>@page{size:'.$paperSize.' auto;margin:0;}body{margin:0;padding:0;background:#fff;font-family:monospace;}pre{font-family:monospace;font-size:'.$fontSize.';line-height:1.3;width:'.$width.';max-width:'.$width.';margin:0;padding:2px;box-sizing:border-box;white-space:pre-wrap;word-break:break-all;color:#000;}</style></head><body onload="window.print()"><pre>'.e($text).'</pre></body></html>';
    }

    public function generateWhatsappReceiptText(Transaction $transaction): string
    {
        $transaction->loadMissing(['customer', 'details.product', 'details.unit', 'cashier', 'receivable', 'bankAccount']);

        $storeName = Setting::get('store_name', config('app.name', 'Point of Sales'));
        $storeAddress = Setting::get('store_address', '');
        $storePhone = Setting::get('store_phone', '');

        if ($storeAddress && str_contains(strtolower($storeAddress), 'belum diisi')) {
            $storeAddress = '';
        }
        if ($storePhone && str_contains(strtolower($storePhone), 'belum diisi')) {
            $storePhone = '';
        }

        $isPaid = $transaction->payment_status === 'paid';

        $lines = [];
        $lines[] = $isPaid ? '*STRUK PEMBELIAN (LUNAS)*' : '*TAGIHAN PEMBELIAN (BELUM LUNAS)*';
        $lines[] = '*'.strtoupper((string) $storeName).'*';
        if ($storeAddress) {
            $lines[] = $storeAddress;
        }
        if ($storePhone) {
            $lines[] = 'Telp: '.$storePhone;
        }
        $lines[] = '================================';
        $lines[] = 'No. Nota  : '.$transaction->invoice;
        $lines[] = 'Tanggal   : '.($transaction->created_at?->format('d/m/Y H:i') ?? now()->format('d/m/Y H:i'));
        $lines[] = 'Kasir     : '.($transaction->cashier?->name ?? '-');
        $lines[] = 'Pelanggan : '.($transaction->customer?->name ?? 'Umum');
        $lines[] = '================================';

        foreach ($transaction->details as $detail) {
            $title = $detail->product?->title ?? 'Produk';
            $qty = $detail->qty ?: 1;
            $unitSymbol = $detail->unit?->symbol ? ' '.$detail->unit->symbol : ' pcs';
            $unitPrice = (int) ($detail->unit_price ?: ($detail->price / max(1, $qty)));
            $linePrice = (int) $detail->price;

            $lines[] = "*{$title}*";
            $lines[] = "{$qty}{$unitSymbol} x Rp ".number_format($unitPrice, 0, ',', '.').' = Rp '.number_format($linePrice, 0, ',', '.');
            if (($detail->discount_total ?? 0) > 0) {
                $lines[] = '(Diskon Item: -Rp '.number_format((int) $detail->discount_total, 0, ',', '.').')';
            }
        }

        $lines[] = '================================';
        $subtotal = ($transaction->grand_total ?? 0) + ($transaction->discount ?? 0) - ($transaction->shipping_cost ?? 0) - ($transaction->tax_total ?? 0);
        $lines[] = 'Subtotal  : Rp '.number_format($subtotal, 0, ',', '.');

        if (($transaction->discount ?? 0) > 0) {
            $lines[] = 'Diskon    : -Rp '.number_format((int) $transaction->discount, 0, ',', '.');
        }
        if (($transaction->tax_total ?? 0) > 0) {
            $lines[] = 'PPN       : +Rp '.number_format((int) $transaction->tax_total, 0, ',', '.');
        }
        if (($transaction->shipping_cost ?? 0) > 0) {
            $lines[] = 'Ongkir    : +Rp '.number_format((int) $transaction->shipping_cost, 0, ',', '.');
        }
        $lines[] = '--------------------------------';
        $lines[] = '*TOTAL     : Rp '.number_format((int) $transaction->grand_total, 0, ',', '.').'*';

        $paymentMap = [
            'cash' => 'Tunai (Cash)',
            'bank_transfer' => 'Transfer Bank',
            'qris' => 'QRIS',
            'qrisly' => 'QRIS Dinamis',
            'midtrans' => 'Midtrans Gateway',
            'xendit' => 'Xendit Gateway',
            'pay_later' => 'Tempo / Piutang',
        ];
        $paymentLabel = $paymentMap[$transaction->payment_method] ?? strtoupper((string) $transaction->payment_method);
        $lines[] = 'Metode    : '.$paymentLabel;
        $lines[] = 'Status    : '.($isPaid ? 'LUNAS' : 'BELUM LUNAS (MENUNGGU KONFIRMASI)');

        if ($transaction->payment_method === 'cash' && ($transaction->cash ?? 0) > 0) {
            $lines[] = 'Bayar     : Rp '.number_format((int) $transaction->cash, 0, ',', '.');
            if (($transaction->change ?? 0) > 0) {
                $lines[] = 'Kembali   : Rp '.number_format((int) $transaction->change, 0, ',', '.');
            }
        }

        if (! $isPaid && $transaction->payment_method === 'bank_transfer' && $transaction->bankAccount) {
            $lines[] = '--------------------------------';
            $lines[] = '*Petunjuk Transfer:*';
            $lines[] = "Bank      : {$transaction->bankAccount->bank_name}";
            $lines[] = "No. Rek   : {$transaction->bankAccount->account_number}";
            $lines[] = "Atas Nama : {$transaction->bankAccount->account_name}";
        }

        if ($transaction->receivable && $transaction->payment_method === 'pay_later') {
            $remaining = max(0, (int) $transaction->receivable->total - (int) $transaction->receivable->paid);
            $lines[] = 'Sisa Tagihan : Rp '.number_format($remaining, 0, ',', '.');
            if ($transaction->receivable->due_date) {
                $lines[] = 'Jatuh Tempo  : '.$transaction->receivable->due_date->format('d/m/Y');
            }
        }

        $lines[] = '================================';
        $lines[] = 'Terima kasih atas kunjungan Anda!';
        $lines[] = '--------------------------------';
        $lines[] = '*Lihat Nota Online:*';
        $lines[] = route('transactions.public', $transaction->invoice, true);

        return implode("\n", $lines);
    }

    public function generateSalesReturnReceiptText(SalesReturn $salesReturn, string $paperSize = '80mm'): string
    {
        $salesReturn->loadMissing(['transaction', 'customer', 'cashier', 'items.product', 'exchangeItems.product']);

        $storeName = Setting::get('store_name', 'Toko Anda');
        $storeAddress = Setting::get('store_address', '');
        $storePhone = Setting::get('store_phone', '');
        $maxWidth = $paperSize === '58mm' ? 32 : 48;

        $lines = [];
        $lines[] = '';
        $lines[] = $this->center(strtoupper($storeName ?? 'TOKO ANDA'), $maxWidth);
        if ($storeAddress) {
            $lines[] = $this->center($storeAddress, $maxWidth);
        }
        if ($storePhone) {
            $lines[] = $this->center('Telp: '.$storePhone, $maxWidth);
        }
        $lines[] = $this->line($maxWidth);
        $lines[] = $this->center($salesReturn->return_type === 'product_exchange' ? 'BUKTI TUKAR BARANG' : 'BUKTI RETUR PENJUALAN', $maxWidth);
        $lines[] = $this->line($maxWidth);
        $lines[] = $this->left('No Retur: '.($salesReturn->code ?? ''), $maxWidth);
        $lines[] = $this->left('Ref Nota: '.($salesReturn->transaction?->invoice ?? '-'), $maxWidth);
        $lines[] = $this->left('Tgl: '.($salesReturn->completed_at?->format('d/m/Y H:i') ?? $salesReturn->created_at?->format('d/m/Y H:i') ?? ''), $maxWidth);
        $lines[] = $this->left('Kasir: '.($salesReturn->cashier?->name ?? '-'), $maxWidth);
        $lines[] = $this->left('Pelanggan: '.($salesReturn->customer?->name ?? 'Umum'), $maxWidth);
        $lines[] = $this->line($maxWidth);

        $lines[] = $this->left('[BARANG DIRETUR]', $maxWidth);
        foreach ($salesReturn->items as $item) {
            $title = mb_substr($item->product?->title ?? 'Produk', 0, $maxWidth - 10);
            $linePrice = '-'.number_format((int) $item->subtotal, 0, ',', '.');
            $lineTotal = "{$item->qty_return}x @ ".number_format((int) $item->unit_price, 0, ',', '.');
            $lines[] = $this->left($title, $maxWidth);
            $lines[] = $this->leftRight($lineTotal, $linePrice, $maxWidth);
        }

        if ($salesReturn->return_type === 'product_exchange' && $salesReturn->exchangeItems->isNotEmpty()) {
            $lines[] = $this->line($maxWidth);
            $lines[] = $this->left('[BARANG PENGGANTI]', $maxWidth);
            foreach ($salesReturn->exchangeItems as $item) {
                $title = mb_substr($item->product?->title ?? 'Produk', 0, $maxWidth - 10);
                $linePrice = number_format((int) $item->subtotal, 0, ',', '.');
                $lineTotal = "{$item->qty}x @ ".number_format((int) $item->unit_price, 0, ',', '.');
                $lines[] = $this->left($title, $maxWidth);
                $lines[] = $this->leftRight($lineTotal, $linePrice, $maxWidth);
            }

            $lines[] = $this->line($maxWidth);
            $lines[] = $this->leftRight('Total Retur', '-'.number_format((int) $salesReturn->total_return_amount, 0, ',', '.'), $maxWidth);
            $lines[] = $this->leftRight('Total Pengganti', number_format((int) $salesReturn->exchange_amount, 0, ',', '.'), $maxWidth);
            $lines[] = $this->line($maxWidth);

            $diff = (int) $salesReturn->difference_amount;
            if ($diff > 0) {
                $lines[] = $this->leftRight('Kurang Bayar', number_format($diff, 0, ',', '.'), $maxWidth);
                $methodName = strtoupper(str_replace('_', ' ', $salesReturn->exchange_payment_method ?: 'Tunai'));
                $lines[] = $this->leftRight("Bayar ({$methodName})", number_format((int) ($salesReturn->exchange_cash ?: $diff), 0, ',', '.'), $maxWidth);
                if (($salesReturn->exchange_change ?? 0) > 0) {
                    $lines[] = $this->leftRight('Kembali', number_format((int) $salesReturn->exchange_change, 0, ',', '.'), $maxWidth);
                }
            } elseif ($diff < 0) {
                $refundType = $salesReturn->credited_amount > 0 ? 'Saldo Toko' : 'Refund Tunai';
                $lines[] = $this->leftRight($refundType, number_format(abs($diff), 0, ',', '.'), $maxWidth);
            } else {
                $lines[] = $this->leftRight('Selisih', 'Rp 0 (Tukar Pas)', $maxWidth);
            }
        } else {
            $lines[] = $this->line($maxWidth);
            $lines[] = $this->leftRight('Total Retur', number_format((int) $salesReturn->total_return_amount, 0, ',', '.'), $maxWidth);
            if ($salesReturn->return_type === 'store_credit' || $salesReturn->credited_amount > 0) {
                $lines[] = $this->leftRight('Saldo Toko', number_format((int) $salesReturn->credited_amount, 0, ',', '.'), $maxWidth);
            } else {
                $lines[] = $this->leftRight('Refund Tunai', number_format((int) $salesReturn->refund_amount, 0, ',', '.'), $maxWidth);
            }
        }

        $lines[] = $this->line($maxWidth);
        $lines[] = $this->center('Terima kasih', $maxWidth);
        $lines[] = $this->center('Simpan bukti ini sebagai konfirmasi', $maxWidth);
        $lines[] = '';
        $lines[] = '';

        return implode("\n", $lines);
    }

    public function generateSalesReturnReceiptHtml(SalesReturn $salesReturn, ?string $paperSize = null): string
    {
        $paperSize = $paperSize ?: Setting::get('printer_paper_size', '58mm');
        $text = $this->generateSalesReturnReceiptText($salesReturn, $paperSize);
        $width = $paperSize === '58mm' ? '48mm' : '80mm';
        $fontSize = $paperSize === '58mm' ? '11px' : '12px';

        return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Struk Retur '.$salesReturn->code.'</title><style>@page{size:'.$paperSize.' auto;margin:0;}body{margin:0;padding:0;background:#fff;font-family:monospace;}pre{font-family:monospace;font-size:'.$fontSize.';line-height:1.3;width:'.$width.';max-width:'.$width.';margin:0;padding:2px;box-sizing:border-box;white-space:pre-wrap;word-break:break-all;color:#000;}</style></head><body onload="window.print()"><pre>'.e($text).'</pre></body></html>';
    }

    private function center(string $text, int $width): string
    {
        $text = trim($text);
        $len = mb_strlen($text);
        if ($len >= $width) {
            return mb_substr($text, 0, $width);
        }
        $pad = (int) (($width - $len) / 2);

        return str_repeat(' ', max(0, $pad)).$text;
    }

    private function left(string $text, int $width): string
    {
        return mb_substr($text, 0, $width);
    }

    private function leftRight(string $left, string $right, int $width): string
    {
        $left = mb_substr($left, 0, $width - 15);
        $right = mb_substr($right, 0, 14);
        $dots = $width - mb_strlen($left) - mb_strlen($right);
        if ($dots < 1) {
            return $left.' '.$right;
        }

        return $left.str_repeat(' ', $dots).$right;
    }

    private function line(int $width): string
    {
        return str_repeat('-', $width);
    }

    public function printDirectToCups(Transaction $transaction, ?string $printerName = null, ?string $paperSize = null): bool
    {
        $printerName = $printerName ?: Setting::get('printer_cups_name', 'EPPOS');
        $paperSize = $paperSize ?: Setting::get('printer_paper_size', '58mm');

        $maxWidth = $paperSize === '58mm' ? 32 : 48;
        $escInit = "\x1b@";
        $escCenter = "\x1ba\x01";
        $escLeft = "\x1ba\x00";
        $escBoldOn = "\x1bE\x01";
        $escBoldOff = "\x1bE\x00";

        $storeName = Setting::get('store_name', 'Toko Anda');
        $storeAddress = Setting::get('store_address', '');
        $storePhone = Setting::get('store_phone', '');

        $raw = $escInit;
        $raw .= $escCenter.$escBoldOn.strtoupper($storeName)."\r\n".$escBoldOff;
        if ($storeAddress) {
            $raw .= $storeAddress."\r\n";
        }
        if ($storePhone) {
            $raw .= 'Telp: '.$storePhone."\r\n";
        }

        $raw .= $escLeft;
        $raw .= str_repeat('=', $maxWidth)."\r\n";
        $raw .= 'No: '.$transaction->invoice."\r\n";
        $raw .= 'Tgl: '.($transaction->created_at?->format('d/m/Y H:i') ?? '')."\r\n";
        $raw .= 'Kasir: '.($transaction->cashier?->name ?? '-')."\r\n";
        $raw .= 'Pelanggan: '.($transaction->customer?->name ?? 'Umum')."\r\n";
        $raw .= str_repeat('=', $maxWidth)."\r\n";

        foreach ($transaction->details as $detail) {
            $title = mb_substr($detail->product?->title ?? 'Produk', 0, $maxWidth);
            $qty = max(1, $detail->qty);
            $total = (int) $detail->price;
            $unit = (int) ($detail->unit_price ?: $total / $qty);
            $unitSymbol = $detail->unit?->symbol ? ' '.$detail->unit->symbol : '';
            $lineTotal = "{$qty}{$unitSymbol}x @ ".number_format($unit, 0, ',', '.');
            $linePrice = number_format($total, 0, ',', '.');

            $raw .= $title."\r\n";
            $raw .= $this->leftRight($lineTotal, $linePrice, $maxWidth)."\r\n";
        }

        $raw .= str_repeat('-', $maxWidth)."\r\n";
        $promoDiscount = $transaction->details->sum('discount_total');
        $voucherDiscount = $transaction->customer_voucher_discount ?? 0;
        $loyaltyDiscount = $transaction->loyalty_discount_total ?? 0;
        $subtotal = ($transaction->grand_total ?? 0) + ($transaction->discount ?? 0) - ($transaction->shipping_cost ?? 0) - ($transaction->tax_total ?? 0) + $promoDiscount + $voucherDiscount + $loyaltyDiscount;

        $raw .= $this->leftRight('Subtotal', number_format($subtotal, 0, ',', '.'), $maxWidth)."\r\n";
        if ($promoDiscount > 0) {
            $raw .= $this->leftRight('Promo', '-'.number_format((int) $promoDiscount, 0, ',', '.'), $maxWidth)."\r\n";
        }
        if (($transaction->discount ?? 0) > 0) {
            $raw .= $this->leftRight('Diskon', '-'.number_format((int) $transaction->discount, 0, ',', '.'), $maxWidth)."\r\n";
        }
        if ($voucherDiscount > 0) {
            $raw .= $this->leftRight('Voucher', '-'.number_format((int) $voucherDiscount, 0, ',', '.'), $maxWidth)."\r\n";
        }
        if ($loyaltyDiscount > 0) {
            $raw .= $this->leftRight('Poin', '-'.number_format((int) $loyaltyDiscount, 0, ',', '.'), $maxWidth)."\r\n";
        }
        if (($transaction->shipping_cost ?? 0) > 0) {
            $raw .= $this->leftRight('Ongkir', number_format((int) $transaction->shipping_cost, 0, ',', '.'), $maxWidth)."\r\n";
        }
        if (($transaction->tax_total ?? 0) > 0) {
            $raw .= $this->leftRight('PPN', number_format((int) $transaction->tax_total, 0, ',', '.'), $maxWidth)."\r\n";
        }
        $raw .= str_repeat('-', $maxWidth)."\r\n";
        $raw .= $escBoldOn.$this->leftRight('TOTAL', number_format((int) $transaction->grand_total, 0, ',', '.'), $maxWidth)."\r\n".$escBoldOff;

        if ($transaction->payment_method === 'cash' && $transaction->cash > 0) {
            $raw .= $this->leftRight('Bayar (Tunai)', number_format((int) $transaction->cash, 0, ',', '.'), $maxWidth)."\r\n";
            if (($transaction->change ?? 0) > 0) {
                $raw .= $this->leftRight('Kembali', number_format((int) $transaction->change, 0, ',', '.'), $maxWidth)."\r\n";
            }
        }

        $raw .= str_repeat('=', $maxWidth)."\r\n";
        $raw .= $escCenter;
        $raw .= "Terima kasih\r\n";
        $raw .= "Barang yang sudah dibeli\r\n";
        $raw .= "tidak dapat ditukar/kembali\r\n\r\n\r\n\r\n\r\n";

        $process = @proc_open(['lpr', '-P', $printerName, '-o', 'raw'], [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ], $pipes);

        if (is_resource($process)) {
            fwrite($pipes[0], $raw);
            fclose($pipes[0]);
            fclose($pipes[1]);
            fclose($pipes[2]);

            return proc_close($process) === 0;
        }

        return false;
    }

    public function printSalesReturnDirectToCups(SalesReturn $salesReturn, ?string $printerName = null, ?string $paperSize = null): bool
    {
        $printerName = $printerName ?: Setting::get('printer_cups_name', 'EPPOS');
        $paperSize = $paperSize ?: Setting::get('printer_paper_size', '58mm');

        $maxWidth = $paperSize === '58mm' ? 32 : 48;
        $escInit = "\x1b@";
        $escCenter = "\x1ba\x01";
        $escLeft = "\x1ba\x00";
        $escBoldOn = "\x1bE\x01";
        $escBoldOff = "\x1bE\x00";

        $storeName = Setting::get('store_name', 'Toko Anda');
        $storeAddress = Setting::get('store_address', '');
        $storePhone = Setting::get('store_phone', '');

        $raw = $escInit;
        $raw .= $escCenter.$escBoldOn.strtoupper($storeName)."\r\n".$escBoldOff;
        if ($storeAddress) {
            $raw .= $storeAddress."\r\n";
        }
        if ($storePhone) {
            $raw .= 'Telp: '.$storePhone."\r\n";
        }

        $isExchange = $salesReturn->return_type === 'product_exchange';
        $title = $isExchange ? 'BUKTI TUKAR BARANG' : 'BUKTI RETUR PENJUALAN';

        $raw .= str_repeat('=', $maxWidth)."\r\n";
        $raw .= $escBoldOn.$this->center($title, $maxWidth)."\r\n".$escBoldOff;
        $raw .= str_repeat('-', $maxWidth)."\r\n";

        $raw .= $escLeft;
        $raw .= 'No: '.$salesReturn->code."\r\n";
        $raw .= 'Ref: '.($salesReturn->transaction?->invoice ?? '-')."\r\n";
        $raw .= 'Tgl: '.(($salesReturn->completed_at ?? $salesReturn->created_at)?->format('d/m/Y H:i') ?? '')."\r\n";
        $raw .= 'Kasir: '.($salesReturn->cashier?->name ?? '-')."\r\n";
        $raw .= 'Pelanggan: '.($salesReturn->customer?->name ?? 'Umum')."\r\n";
        $raw .= str_repeat('=', $maxWidth)."\r\n";

        $raw .= $escBoldOn."[BARANG DIRETUR]\r\n".$escBoldOff;
        foreach ($salesReturn->items as $item) {
            $itemTitle = mb_substr($item->product?->title ?? 'Produk', 0, $maxWidth);
            $qty = (int) ($item->qty_return ?: $item->qty ?: 1);
            $unitPrice = (int) $item->unit_price;
            $subtotal = (int) ($item->subtotal ?: $qty * $unitPrice);

            $raw .= $itemTitle."\r\n";
            $raw .= $this->leftRight("{$qty}x @ ".number_format($unitPrice, 0, ',', '.'), '-'.number_format($subtotal, 0, ',', '.'), $maxWidth)."\r\n";
        }

        if ($isExchange && $salesReturn->exchangeItems->isNotEmpty()) {
            $raw .= str_repeat('-', $maxWidth)."\r\n";
            $raw .= $escBoldOn."[BARANG PENGGANTI]\r\n".$escBoldOff;
            foreach ($salesReturn->exchangeItems as $item) {
                $itemTitle = mb_substr($item->product?->title ?? 'Produk Pengganti', 0, $maxWidth);
                $qty = (int) $item->qty;
                $unitPrice = (int) $item->unit_price;
                $subtotal = (int) ($item->subtotal ?: $qty * $unitPrice);

                $raw .= $itemTitle."\r\n";
                $raw .= $this->leftRight("{$qty}x @ ".number_format($unitPrice, 0, ',', '.'), number_format($subtotal, 0, ',', '.'), $maxWidth)."\r\n";
            }
        }

        $raw .= str_repeat('-', $maxWidth)."\r\n";

        if ($isExchange) {
            $raw .= $this->leftRight('Total Retur', '-'.number_format((int) $salesReturn->total_return_amount, 0, ',', '.'), $maxWidth)."\r\n";
            $raw .= $this->leftRight('Total Pengganti', number_format((int) $salesReturn->exchange_amount, 0, ',', '.'), $maxWidth)."\r\n";
            $raw .= str_repeat('-', $maxWidth)."\r\n";

            $diff = (int) $salesReturn->difference_amount;
            if ($diff > 0) {
                $raw .= $escBoldOn.$this->leftRight('Kurang Bayar', number_format($diff, 0, ',', '.'), $maxWidth)."\r\n".$escBoldOff;
                $methodName = strtoupper(str_replace('_', ' ', $salesReturn->exchange_payment_method ?: 'Tunai'));
                $raw .= $this->leftRight("Bayar ({$methodName})", number_format((int) ($salesReturn->exchange_cash ?: $diff), 0, ',', '.'), $maxWidth)."\r\n";
                if (($salesReturn->exchange_change ?? 0) > 0) {
                    $raw .= $this->leftRight('Kembali', number_format((int) $salesReturn->exchange_change, 0, ',', '.'), $maxWidth)."\r\n";
                }
            } elseif ($diff < 0) {
                $refundType = $salesReturn->credited_amount > 0 ? 'Saldo Toko' : 'Refund Tunai';
                $raw .= $escBoldOn.$this->leftRight($refundType, number_format(abs($diff), 0, ',', '.'), $maxWidth)."\r\n".$escBoldOff;
            } else {
                $raw .= $this->leftRight('Selisih', 'Rp 0 (Tukar Pas)', $maxWidth)."\r\n";
            }
        } else {
            $raw .= $this->leftRight('Total Retur', number_format((int) $salesReturn->total_return_amount, 0, ',', '.'), $maxWidth)."\r\n";
            $refundType = ($salesReturn->return_type === 'store_credit' || $salesReturn->credited_amount > 0) ? 'Saldo Toko' : 'Refund Tunai';
            $refundAmount = $salesReturn->credited_amount ?: $salesReturn->refund_amount ?: $salesReturn->total_return_amount ?: 0;
            $raw .= $this->leftRight($refundType, number_format((int) $refundAmount, 0, ',', '.'), $maxWidth)."\r\n";
        }

        $raw .= str_repeat('=', $maxWidth)."\r\n";
        $raw .= $escCenter;
        $raw .= "Terima kasih\r\n";
        $raw .= "Simpan bukti ini sebagai konfirmasi\r\n\r\n\r\n\r\n\r\n";

        $process = @proc_open(['lpr', '-P', $printerName, '-o', 'raw'], [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ], $pipes);

        if (is_resource($process)) {
            fwrite($pipes[0], $raw);
            fclose($pipes[0]);
            fclose($pipes[1]);
            fclose($pipes[2]);

            return proc_close($process) === 0;
        }

        return false;
    }
}
