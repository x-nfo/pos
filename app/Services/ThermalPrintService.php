<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\Transaction;

class ThermalPrintService
{
    public function generateReceiptText(Transaction $transaction, string $paperSize = '80mm'): string
    {
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

        if ($transaction->payment_method === 'cash' && $transaction->cash > 0) {
            $lines[] = $this->leftRight('Tunai', number_format((int) $transaction->cash, 0, ',', '.'), $maxWidth);
            if (($transaction->change ?? 0) > 0) {
                $lines[] = $this->leftRight('Kembali', number_format((int) $transaction->change, 0, ',', '.'), $maxWidth);
            }
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
}
