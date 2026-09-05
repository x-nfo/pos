<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $casts = [
        'id' => 'integer',
        'category_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
        'buy_price' => 'integer',
        'sell_price' => 'integer',
        'tax_rate' => 'decimal:2',
        'min_stock' => 'integer',
        'max_stock' => 'integer',
        'is_composite' => 'boolean',
    ];

    protected $fillable = [
        'image',
        'barcode',
        'sku',
        'title',
        'description',
        'buy_price',
        'sell_price',
        'category_id',
        'tax_type',
        'tax_rate',
        'min_stock',
        'max_stock',
        'stock',
        'is_composite',
    ];

    protected $appends = [
        'stock',
    ];

    public ?int $_pending_stock = null;

    protected static function booted(): void
    {
        static::saving(function (Product $product) {
            if (array_key_exists('stock', $product->attributes)) {
                $product->_pending_stock = (int) $product->attributes['stock'];
                unset($product->attributes['stock']);
            }
        });

        static::saved(function (Product $product) {
            if ($product->_pending_stock !== null) {
                $stock = $product->_pending_stock;
                $product->_pending_stock = null;

                if ($product->wasRecentlyCreated) {
                    $defaultWarehouse = Warehouse::defaultWarehouse();
                    $product->warehouses()->syncWithoutDetaching([
                        $defaultWarehouse->id => ['stock' => $stock],
                    ]);
                }
            }
        });
        static::deleting(function (Product $product) {
            if (! $product->isForceDeleting()) {
                $suffix = '_del_'.time().'_'.$product->id;
                if (! str_contains($product->barcode, '_del_')) {
                    $product->barcode = substr($product->barcode, 0, 70).$suffix;
                }
                if ($product->sku && ! str_contains($product->sku, '_del_')) {
                    $product->sku = substr($product->sku, 0, 70).$suffix;
                }
                $product->saveQuietly();
            }
        });

        static::restoring(function (Product $product) {
            if (str_contains($product->barcode, '_del_')) {
                $product->barcode = explode('_del_', $product->barcode)[0];
            }
            if ($product->sku && str_contains($product->sku, '_del_')) {
                $product->sku = explode('_del_', $product->sku)[0];
            }
        });
    }

    public function category()
    {
        return $this->belongsTo(Category::class)->withTrashed();
    }

    public function warehouses(): BelongsToMany
    {
        return $this->belongsToMany(Warehouse::class)
            ->withPivot('stock')
            ->using(ProductWarehouse::class)
            ->withTimestamps();
    }

    public function units(): BelongsToMany
    {
        return $this->belongsToMany(Unit::class, 'product_units')
            ->withPivot(['is_base', 'conversion_factor', 'buy_price', 'sell_price', 'barcode', 'sku_suffix'])
            ->using(ProductUnit::class)
            ->withTimestamps();
    }

    public function baseUnit(): ?Unit
    {
        return $this->units()->wherePivot('is_base', true)->first();
    }

    public function components(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'composite_product_items', 'composite_product_id', 'component_product_id')
            ->withPivot('qty')
            ->withTimestamps();
    }

    public function compositeOf(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'composite_product_items', 'component_product_id', 'composite_product_id');
    }

    public function compositeStock(): int
    {
        if (! $this->is_composite) {
            return $this->stockTotal();
        }
        $minStock = null;
        foreach ($this->components as $component) {
            $available = (int) floor($component->stockTotal() / max(1, (float) $component->pivot->qty));
            $minStock = $minStock === null ? $available : min($minStock, $available);
        }

        return $minStock ?? 0;
    }

    public function stockOpnameItems()
    {
        return $this->hasMany(StockOpnameItem::class);
    }

    public function stockMutations()
    {
        return $this->hasMany(StockMutation::class);
    }

    public function salesReturnItems()
    {
        return $this->hasMany(SalesReturnItem::class);
    }

    public function salesReturnExchangeItems()
    {
        return $this->hasMany(SalesReturnExchangeItem::class);
    }

    public function transactionDetails()
    {
        return $this->hasMany(TransactionDetail::class);
    }

    public function purchaseOrderItems()
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function goodsReceivingItems()
    {
        return $this->hasMany(GoodsReceivingItem::class);
    }

    public function supplierReturnItems()
    {
        return $this->hasMany(SupplierReturnItem::class);
    }

    public function stockTransferItems()
    {
        return $this->hasMany(StockTransferItem::class);
    }

    public function dineOrderItems()
    {
        return $this->hasMany(DineOrderItem::class);
    }

    public function carts()
    {
        return $this->hasMany(Cart::class);
    }

    public function productBatches()
    {
        return $this->hasMany(ProductBatch::class);
    }

    public function pricingRules()
    {
        return $this->hasMany(PricingRule::class);
    }

    public function hasHistoricalRelations(): bool
    {
        if ($this->transactionDetails()->exists()) {
            return true;
        }

        if ($this->stockMutations()->where('reference_type', '!=', 'product_create')->exists()) {
            return true;
        }

        if ($this->purchaseOrderItems()->exists() || $this->goodsReceivingItems()->exists() || $this->supplierReturnItems()->exists()) {
            return true;
        }

        if ($this->salesReturnItems()->exists() || $this->salesReturnExchangeItems()->exists() || $this->stockOpnameItems()->exists() || $this->stockTransferItems()->exists() || $this->dineOrderItems()->exists()) {
            return true;
        }

        if ($this->carts()->exists()) {
            return true;
        }

        return false;
    }

    public function stock(): Attribute
    {
        return Attribute::make(
            get: function ($value) {
                if ($value !== null) {
                    return (int) $value;
                }
                if ($this->_pending_stock !== null) {
                    return $this->_pending_stock;
                }
                if ($this->relationLoaded('warehouses')) {
                    return (int) $this->warehouses->sum(fn ($w) => $w->pivot->stock ?? 0);
                }

                return (int) $this->warehouses()->sum('product_warehouse.stock');
            },
            set: function ($value) {
                $this->_pending_stock = (int) $value;

                return [];
            }
        );
    }

    public function stockTotal(): int
    {
        return $this->stock;
    }

    public function isLowStock(?int $warehouseId = null): bool
    {
        if ($this->min_stock <= 0) {
            return false;
        }
        $stock = $warehouseId
            ? (int) ($this->warehouses()->where('warehouse_id', $warehouseId)->first()?->pivot->stock ?? 0)
            : $this->stockTotal();

        return $stock <= $this->min_stock;
    }

    public function suggestedOrderQty(): int
    {
        if ($this->max_stock <= 0 || $this->min_stock <= 0) {
            return 0;
        }

        return max(0, $this->max_stock - $this->stockTotal());
    }

    protected function image(): Attribute
    {
        return Attribute::make(
            get: function ($value) {
                if (! $value) {
                    return null;
                }

                if (
                    str_starts_with($value, 'http://') ||
                    str_starts_with($value, 'https://') ||
                    str_starts_with($value, '/storage/')
                ) {
                    return $value;
                }

                return asset('/storage/products/'.ltrim($value, '/'));
            }
        );
    }
}
