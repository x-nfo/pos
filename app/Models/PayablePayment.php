<?php

namespace App\Models;

use App\Services\DocumentNumberService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PayablePayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'payable_id',
        'paid_at',
        'amount',
        'method',
        'bank_account_id',
        'user_id',
        'note',
    ];

    protected $casts = [
        'paid_at' => 'date',
        'amount' => 'float',
    ];

    protected $appends = [
        'voucher_number',
    ];

    public function getVoucherNumberAttribute(): string
    {
        $warehouse = null;
        if ($this->relationLoaded('payable') && $this->payable) {
            $warehouse = $this->payable->purchaseOrder?->warehouse;
        } elseif ($this->payable_id) {
            $payable = Payable::with('purchaseOrder.warehouse')->find($this->payable_id);
            $warehouse = $payable?->purchaseOrder?->warehouse;
        }

        $branchCode = app(DocumentNumberService::class)->formatBranchCode($warehouse);
        $dateStr = $this->paid_at
            ? Carbon::parse($this->paid_at)->format('Ymd')
            : ($this->created_at ? $this->created_at->format('Ymd') : now()->format('Ymd'));
        $seq = str_pad((string) ($this->id ?? 1), 4, '0', STR_PAD_LEFT);

        return "PV-{$branchCode}-{$dateStr}-{$seq}";
    }

    public function payable()
    {
        return $this->belongsTo(Payable::class);
    }

    public function bankAccount()
    {
        return $this->belongsTo(BankAccount::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
