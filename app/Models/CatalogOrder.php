<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class CatalogOrder extends Model
{
    use HasFactory;

    public const STATUS_SUBMITTED = 'submitted';

    public const STATUS_CONFIRMED = 'confirmed';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_READY = 'ready';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    public const DELIVERY_PICKUP = 'pickup';

    public const DELIVERY_SHIPPING = 'delivery';

    protected $fillable = [
        'order_number',
        'access_token',
        'warehouse_id',
        'customer_id',
        'customer_name',
        'customer_phone',
        'delivery_method',
        'delivery_address',
        'notes',
        'subtotal',
        'shipping_cost',
        'grand_total',
        'status',
        'cancellation_reason',
        'cashier_id',
        'transaction_id',
        'confirmed_at',
        'completed_at',
        'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'integer',
            'shipping_cost' => 'integer',
            'grand_total' => 'integer',
            'confirmed_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (CatalogOrder $order) {
            if (empty($order->access_token)) {
                $order->access_token = (string) Str::uuid();
            }

            if (empty($order->order_number)) {
                $datePrefix = Carbon::now()->format('Ymd');
                $countToday = static::whereDate('created_at', Carbon::today())->count() + 1;
                $order->order_number = sprintf('ORD-%s-%04d', $datePrefix, $countToday);
            }
        });
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_SUBMITTED);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', [
            self::STATUS_SUBMITTED,
            self::STATUS_CONFIRMED,
            self::STATUS_PROCESSING,
            self::STATUS_READY,
        ]);
    }

    public function items(): HasMany
    {
        return $this->hasMany(CatalogOrderItem::class, 'catalog_order_id');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }
}
