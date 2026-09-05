<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockMutation extends Model
{
    use HasFactory;

    protected static function booted(): void
    {
        static::creating(function (StockMutation $mutation) {
            if (empty($mutation->warehouse_id)) {
                $mutation->warehouse_id = auth()->user()?->warehouse_id
                    ?? Warehouse::defaultId();
            }
        });
    }

    protected $fillable = [
        'product_id',
        'warehouse_id',
        'reference_type',
        'reference_id',
        'mutation_type',
        'qty',
        'stock_before',
        'stock_after',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'id' => 'integer',
        'product_id' => 'integer',
        'reference_id' => 'integer',
        'qty' => 'integer',
        'stock_before' => 'integer',
        'stock_after' => 'integer',
        'created_by' => 'integer',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class)->withTrashed();
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
