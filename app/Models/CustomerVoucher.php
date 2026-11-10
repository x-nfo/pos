<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CustomerVoucher extends Model
{
    use HasFactory;

    public const TYPE_FIXED_AMOUNT = 'fixed_amount';

    public const TYPE_PERCENTAGE = 'percentage';

    protected $fillable = [
        'customer_id',
        'code',
        'name',
        'discount_type',
        'discount_value',
        'minimum_order',
        'max_discount',
        'usage_limit',
        'times_used',
        'is_active',
        'is_used',
        'starts_at',
        'expires_at',
        'used_at',
        'used_transaction_id',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'customer_id' => 'integer',
        'discount_value' => 'float',
        'minimum_order' => 'integer',
        'max_discount' => 'integer',
        'usage_limit' => 'integer',
        'times_used' => 'integer',
        'is_active' => 'boolean',
        'is_used' => 'boolean',
        'starts_at' => 'datetime',
        'expires_at' => 'datetime',
        'used_at' => 'datetime',
        'used_transaction_id' => 'integer',
        'created_by' => 'integer',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    public function usedTransaction()
    {
        return $this->belongsTo(Transaction::class, 'used_transaction_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isGeneral(): bool
    {
        return is_null($this->customer_id);
    }

    public function calculateDiscount(int $subtotal): int
    {
        if ($this->minimum_order > 0 && $subtotal < $this->minimum_order) {
            return 0;
        }

        if ($this->discount_type === self::TYPE_PERCENTAGE) {
            $discount = (int) round($subtotal * ($this->discount_value / 100));
            if ($this->max_discount !== null && $this->max_discount > 0) {
                $discount = min($discount, (int) $this->max_discount);
            }
        } else {
            $discount = (int) round((float) $this->discount_value);
        }

        return min($subtotal, max(0, $discount));
    }

    public function currentStatusLabel(): string
    {
        if ($this->is_used) {
            return 'used';
        }

        if (! $this->is_active) {
            return 'inactive';
        }

        if ($this->usage_limit !== null && $this->times_used >= $this->usage_limit) {
            return 'exhausted';
        }

        if ($this->starts_at && $this->starts_at->isFuture()) {
            return 'scheduled';
        }

        if ($this->expires_at && $this->expires_at->isPast()) {
            return 'expired';
        }

        return 'active';
    }
}
