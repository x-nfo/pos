<?php

namespace App\Exports;

use App\Models\Transaction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class TransactionsExport implements FromCollection, ShouldAutoSize, WithHeadings, WithMapping
{
    protected Request $request;

    public function __construct(Request $request)
    {
        $this->request = $request;
    }

    public function collection()
    {
        $query = Transaction::query()
            ->with([
                'customer:id,name',
                'cashier:id,name',
                'warehouse:id,code,name',
            ])
            ->withSum('details as details_sum_price', 'price')
            ->orderByDesc('created_at');

        $user = $this->request->user();
        if ($user) {
            if (! $user->isHQ()) {
                $query->where(function (Builder $sub) use ($user) {
                    $sub->where('warehouse_id', $user->warehouse_id)
                        ->orWhere('cashier_id', $user->id);
                });
            }

            if (! $user->isSuperAdmin() && ! $user->can('reports-access')) {
                $query->where('cashier_id', $user->id);
            }
        }

        return $query
            ->when($this->request->input('invoice'), function (Builder $b, $invoice) {
                $b->where('invoice', 'like', '%'.$invoice.'%');
            })
            ->when($this->request->input('start_date'), function (Builder $b, $date) {
                $b->whereDate('created_at', '>=', $date);
            })
            ->when($this->request->input('end_date'), function (Builder $b, $date) {
                $b->whereDate('created_at', '<=', $date);
            })
            ->when($this->request->input('warehouse_id'), function (Builder $b, $warehouseId) {
                $b->where('warehouse_id', $warehouseId);
            })
            ->when($this->request->input('payment_status'), function (Builder $b, $status) {
                $b->where('payment_status', $status);
            })
            ->when($this->request->input('payment_method'), function (Builder $b, $method) {
                $b->where('payment_method', $method);
            })
            ->get();
    }

    public function headings(): array
    {
        return [
            'Invoice',
            'Tanggal',
            'Cabang / Gudang',
            'Kasir',
            'Pelanggan',
            'Metode Pembayaran',
            'Status Pembayaran',
            'Subtotal',
            'Diskon',
            'Ongkir',
            'PPN',
            'Grand Total',
        ];
    }

    public function map($transaction): array
    {
        $methodLabels = [
            'cash' => 'Tunai',
            'bank_transfer' => 'Transfer Bank',
            'pay_later' => 'Bayar Nanti (Tempo)',
            'midtrans' => 'Midtrans',
            'xendit' => 'Xendit',
            'qrisly' => 'QRISLY',
        ];

        $statusLabels = [
            'paid' => 'Lunas',
            'unpaid' => 'Belum Lunas',
            'pending' => 'Pending',
            'failed' => 'Gagal',
            'expired' => 'Kedaluwarsa',
        ];

        $subtotal = $transaction->details_sum_price !== null
            ? (int) $transaction->details_sum_price
            : (int) ($transaction->grand_total + ($transaction->discount ?? 0) - ($transaction->shipping_cost ?? 0) - ($transaction->tax_total ?? 0));

        return [
            $transaction->invoice,
            $transaction->created_at?->format('Y-m-d H:i:s') ?? '',
            $transaction->warehouse?->name ?? 'Pusat',
            $transaction->cashier?->name ?? '',
            $transaction->customer?->name ?? 'Umum',
            $methodLabels[$transaction->payment_method] ?? ($transaction->payment_method ?? ''),
            $statusLabels[$transaction->payment_status] ?? ($transaction->payment_status ?? ''),
            $subtotal,
            (int) ($transaction->discount ?? 0),
            (int) ($transaction->shipping_cost ?? 0),
            (int) ($transaction->tax_total ?? 0),
            (int) $transaction->grand_total,
        ];
    }
}
