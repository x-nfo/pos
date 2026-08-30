<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Unit extends Model
{
    protected $fillable = ['code', 'name', 'symbol'];

    /**
     * Mutator to ensure unit code is always uppercase and trimmed.
     */
    protected function code(): Attribute
    {
        return Attribute::make(
            set: fn ($value) => strtoupper(trim((string) $value)),
        );
    }

    /**
     * Products associated with this unit.
     */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'product_units')
            ->withPivot(['is_base', 'conversion_factor', 'buy_price', 'sell_price', 'barcode', 'sku_suffix'])
            ->withTimestamps();
    }

    /**
     * Product units pivot records.
     */
    public function productUnits(): HasMany
    {
        return $this->hasMany(ProductUnit::class, 'unit_id');
    }

    /**
     * Cart items using this unit.
     */
    public function carts(): HasMany
    {
        return $this->hasMany(Cart::class, 'unit_id');
    }

    /**
     * Transaction details using this unit.
     */
    public function transactionDetails(): HasMany
    {
        return $this->hasMany(TransactionDetail::class, 'unit_id');
    }

    /**
     * Purchase order items using this unit.
     */
    public function purchaseOrderItems(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class, 'unit_id');
    }

    /**
     * Goods receiving items using this unit.
     */
    public function goodsReceivingItems(): HasMany
    {
        return $this->hasMany(GoodsReceivingItem::class, 'unit_id');
    }

    /**
     * Dine order items using this unit.
     */
    public function dineOrderItems(): HasMany
    {
        return $this->hasMany(DineOrderItem::class, 'unit_id');
    }

    /**
     * Check if unit is actively used in products, carts, transactions, or procurement.
     */
    public function hasHistoricalRelations(): bool
    {
        return $this->productUnits()->exists()
            || $this->carts()->exists()
            || $this->transactionDetails()->exists()
            || $this->purchaseOrderItems()->exists()
            || $this->goodsReceivingItems()->exists()
            || $this->dineOrderItems()->exists();
    }
}
