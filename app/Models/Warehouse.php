<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Warehouse extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'code',
        'name',
        'type',
        'address',
        'phone',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort_order' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class)
            ->withPivot('stock')
            ->using(ProductWarehouse::class)
            ->withTimestamps();
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function cashierShifts(): HasMany
    {
        return $this->hasMany(CashierShift::class);
    }

    public function purchaseOrders(): HasMany
    {
        return $this->hasMany(PurchaseOrder::class);
    }

    public function goodsReceivings(): HasMany
    {
        return $this->hasMany(GoodsReceiving::class);
    }

    public function supplierReturns(): HasMany
    {
        return $this->hasMany(SupplierReturn::class);
    }

    public function stockTransfersSource(): HasMany
    {
        return $this->hasMany(StockTransfer::class, 'source_warehouse_id');
    }

    public function stockTransfersDestination(): HasMany
    {
        return $this->hasMany(StockTransfer::class, 'destination_warehouse_id');
    }

    public function stockOpnames(): HasMany
    {
        return $this->hasMany(StockOpname::class);
    }

    public function stockMutations(): HasMany
    {
        return $this->hasMany(StockMutation::class);
    }

    public function productBatches(): HasMany
    {
        return $this->hasMany(ProductBatch::class);
    }

    public function salesReturns(): HasMany
    {
        return $this->hasMany(SalesReturn::class);
    }

    public function hasHistoricalRelations(): bool
    {
        if ($this->type === 'main') {
            return true;
        }

        $totalStock = (int) $this->products()->sum('product_warehouse.stock');
        if ($totalStock > 0) {
            return true;
        }

        return $this->transactions()->exists()
            || $this->cashierShifts()->exists()
            || $this->purchaseOrders()->exists()
            || $this->goodsReceivings()->exists()
            || $this->supplierReturns()->exists()
            || $this->stockTransfersSource()->exists()
            || $this->stockTransfersDestination()->exists()
            || $this->stockOpnames()->exists()
            || $this->stockMutations()->exists()
            || $this->salesReturns()->exists();
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
