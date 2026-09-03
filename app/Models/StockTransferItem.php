<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockTransferItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_transfer_id',
        'product_id',
        'unit_id',
        'conversion_factor',
        'qty',
        'received_qty',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'received_qty' => 'integer',
            'conversion_factor' => 'decimal:4',
        ];
    }

    public function stockTransfer(): BelongsTo
    {
        return $this->belongsTo(StockTransfer::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function getBaseQtyAttribute(): int
    {
        return (int) round($this->qty * (float) ($this->conversion_factor ?: 1.0));
    }

    public function getReceivedBaseQtyAttribute(): int
    {
        $received = $this->received_qty ?? $this->qty;

        return (int) round($received * (float) ($this->conversion_factor ?: 1.0));
    }
}
