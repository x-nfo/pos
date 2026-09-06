<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CatalogOrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'catalog_order_id',
        'product_id',
        'product_title',
        'unit_id',
        'conversion_factor',
        'qty',
        'price',
        'subtotal',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'price' => 'integer',
            'subtotal' => 'integer',
            'conversion_factor' => 'decimal:4',
        ];
    }

    public function catalogOrder(): BelongsTo
    {
        return $this->belongsTo(CatalogOrder::class, 'catalog_order_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }
}
