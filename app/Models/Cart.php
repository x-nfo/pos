<?php

namespace App\Models;

use App\Services\UnitConversionService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Cart extends Model
{
    use HasFactory;

    protected $fillable = [
        'cashier_id', 'warehouse_id', 'product_id', 'unit_id', 'conversion_factor', 'qty', 'price', 'hold_id', 'hold_label', 'held_at',
    ];

    protected $appends = [
        'unit_price',
    ];

    protected $casts = [
        'held_at' => 'datetime',
        'conversion_factor' => 'decimal:4',
    ];

    public function getUnitPriceAttribute(): int
    {
        if ($this->qty > 0 && $this->price > 0) {
            return (int) round($this->price / $this->qty);
        }

        if ($this->unit_id && $this->relationLoaded('product') && $this->product) {
            return app(UnitConversionService::class)->getSellPrice($this->product, $this->unit_id);
        }

        return (int) ($this->product?->sell_price ?? 0);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class);
    }

    public function scopeActive($query)
    {
        return $query->whereNull('hold_id');
    }

    public function scopeHeld($query)
    {
        return $query->whereNotNull('hold_id');
    }

    public function scopeForHold($query, $holdId)
    {
        return $query->where('hold_id', $holdId);
    }
}
