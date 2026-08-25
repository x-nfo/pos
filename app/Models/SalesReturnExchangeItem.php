<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SalesReturnExchangeItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'sales_return_id',
        'product_id',
        'qty',
        'unit_price',
        'subtotal',
    ];

    protected $casts = [
        'sales_return_id' => 'integer',
        'product_id' => 'integer',
        'qty' => 'integer',
        'unit_price' => 'integer',
        'subtotal' => 'integer',
    ];

    public function salesReturn()
    {
        return $this->belongsTo(SalesReturn::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }
}
