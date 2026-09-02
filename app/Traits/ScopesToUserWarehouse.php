<?php

namespace App\Traits;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

trait ScopesToUserWarehouse
{
    /**
     * Scope query to the current user's assigned warehouse.
     * If user is null or HQ (Super Admin or warehouse_id is null), returns unfiltered query.
     */
    public function scopeForUserWarehouse(Builder $query, ?User $user = null, string $column = 'warehouse_id'): Builder
    {
        $user = $user ?? auth()->user();
        if (! $user || $user->isHQ()) {
            return $query;
        }

        return $query->where($this->getTable().'.'.$column, $user->warehouse_id);
    }
}
