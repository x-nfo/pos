<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductReference extends Model
{
    use HasFactory;

    protected $fillable = [
        'barcode',
        'sku',
        'name',
        'category_name',
        'unit',
        'buy_price',
        'sell_price',
        'supplier_name',
    ];

    protected function casts(): array
    {
        return [
            'buy_price' => 'decimal:2',
            'sell_price' => 'decimal:2',
        ];
    }
}
