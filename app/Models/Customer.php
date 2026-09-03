<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * fillable
     *
     * @var array
     */
    protected $fillable = [
        'name',
        'no_telp',
        'address',
        'is_loyalty_member',
        'member_code',
        'loyalty_tier',
        'loyalty_points',
        'loyalty_total_spent',
        'loyalty_transaction_count',
        'loyalty_member_since',
        'last_purchase_at',
        'province_id',
        'province_name',
        'regency_id',
        'regency_name',
        'district_id',
        'district_name',
        'village_id',
        'village_name',
    ];

    protected $casts = [
        'is_loyalty_member' => 'boolean',
        'loyalty_points' => 'integer',
        'loyalty_total_spent' => 'integer',
        'loyalty_transaction_count' => 'integer',
        'loyalty_member_since' => 'datetime',
        'last_purchase_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    protected $appends = [
        'phone',
    ];

    public function salesReturns()
    {
        return $this->hasMany(SalesReturn::class);
    }

    public function customerCredits()
    {
        return $this->hasMany(CustomerCredit::class);
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }

    public function loyaltyPointHistories()
    {
        return $this->hasMany(LoyaltyPointHistory::class);
    }

    public function vouchers()
    {
        return $this->hasMany(CustomerVoucher::class);
    }

    public function receivables()
    {
        return $this->hasMany(Receivable::class);
    }

    public function dineOrders()
    {
        return $this->hasMany(DineOrder::class);
    }

    public function campaignLogs()
    {
        return $this->hasMany(CustomerCampaignLog::class);
    }

    public function segmentMemberships()
    {
        return $this->hasMany(CustomerSegmentMembership::class);
    }

    public function segments()
    {
        return $this->belongsToMany(CustomerSegment::class, 'customer_segment_memberships')
            ->withPivot(['source', 'matched_at'])
            ->withTimestamps();
    }

    public function hasHistoricalRelations(): bool
    {
        return $this->transactions()->exists()
            || $this->receivables()->exists()
            || $this->salesReturns()->exists()
            || $this->customerCredits()->exists()
            || $this->loyaltyPointHistories()->exists()
            || $this->vouchers()->where('is_used', true)->exists()
            || $this->dineOrders()->exists();
    }

    public function getPhoneAttribute(): ?string
    {
        return $this->no_telp;
    }

    public function getFormattedPhoneAttribute(): ?string
    {
        if (empty($this->no_telp)) {
            return null;
        }

        $targetFormatted = preg_replace('/[^0-9]/', '', (string) $this->no_telp);

        if ($targetFormatted && str_starts_with($targetFormatted, '0')) {
            $targetFormatted = '62'.substr($targetFormatted, 1);
        } elseif ($targetFormatted && str_starts_with($targetFormatted, '8')) {
            $targetFormatted = '62'.$targetFormatted;
        }

        return $targetFormatted;
    }
}
