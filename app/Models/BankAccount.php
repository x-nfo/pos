<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BankAccount extends Model
{
    use HasFactory;

    protected $fillable = [
        'warehouse_id',
        'bank_name',
        'account_number',
        'account_name',
        'logo',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'warehouse_id' => 'integer',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    protected $appends = [
        'logo_url',
    ];

    /**
     * Scope to get only active bank accounts
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to order by sort_order
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order')->orderBy('bank_name');
    }

    /**
     * Scope to filter bank accounts available for a given warehouse.
     * Includes global accounts (warehouse_id is null) and branch-specific accounts.
     * If $warehouseId is null, returns all accounts (e.g. for HQ).
     */
    public function scopeForWarehouse($query, ?int $warehouseId)
    {
        if (! $warehouseId) {
            return $query;
        }

        return $query->where(function ($q) use ($warehouseId) {
            $q->whereNull('warehouse_id')
                ->orWhere('warehouse_id', $warehouseId);
        });
    }

    /**
     * Get warehouse associated with this bank account (null if global)
     */
    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class)->withTrashed();
    }

    /**
     * Get transactions using this bank account
     */
    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }

    /**
     * Get receivable payments using this bank account
     */
    public function receivablePayments()
    {
        return $this->hasMany(ReceivablePayment::class);
    }

    /**
     * Get payable payments using this bank account
     */
    public function payablePayments()
    {
        return $this->hasMany(PayablePayment::class);
    }

    public function getLogoUrlAttribute(): ?string
    {
        if (! $this->logo) {
            return null;
        }

        if (
            str_starts_with($this->logo, 'http://') ||
            str_starts_with($this->logo, 'https://') ||
            str_starts_with($this->logo, '/storage/')
        ) {
            return $this->logo;
        }

        return asset('storage/'.ltrim($this->logo, '/'));
    }
}
