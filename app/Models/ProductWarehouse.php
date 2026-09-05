<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class ProductWarehouse extends Pivot
{
    public $incrementing = true;

    protected $table = 'product_warehouse';

    protected function casts(): array
    {
        return [
            'stock' => 'integer',
        ];
    }

    public function save(array $options = [])
    {
        if (! $this->exists && isset($this->product_id, $this->warehouse_id)) {
            $existing = static::where('product_id', $this->product_id)
                ->where('warehouse_id', $this->warehouse_id)
                ->first();

            if ($existing) {
                $this->exists = true;
                $this->id = $existing->id;
                $this->attributes['id'] = $existing->id;
            }
        }

        return parent::save($options);
    }
}
