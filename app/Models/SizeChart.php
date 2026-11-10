<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SizeChart extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'apparel_type',
        'default_unit',
        'columns',
        'measurements',
        'fit_rules',
        'diagram_image',
        'how_to_measure_notes',
        'is_active',
    ];

    protected $casts = [
        'columns' => 'array',
        'measurements' => 'array',
        'fit_rules' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Categories using this size chart as default.
     */
    public function categories(): HasMany
    {
        return $this->hasMany(Category::class);
    }

    /**
     * Products specifically assigned to this size chart.
     */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    /**
     * Resolve the active size chart for a given product using hierarchy:
     * 1. Product specific size_chart_id
     * 2. Parent product specific size_chart_id (if this is a variant)
     * 3. Category default size_chart_id
     * 4. Null if none found or inactive
     */
    public static function resolveForProduct(Product $product): ?self
    {
        // 1. Direct product override
        if ($product->size_chart_id) {
            $chart = $product->relationLoaded('sizeChart')
                ? $product->sizeChart
                : $product->sizeChart()->first();

            if ($chart && $chart->is_active) {
                return $chart;
            }
        }

        // 2. Parent product override (for fashion variants)
        if ($product->parent_id) {
            $parent = $product->relationLoaded('parent')
                ? $product->parent
                : $product->parent()->first();

            if ($parent && $parent->size_chart_id) {
                $chart = $parent->relationLoaded('sizeChart')
                    ? $parent->sizeChart
                    : $parent->sizeChart()->first();

                if ($chart && $chart->is_active) {
                    return $chart;
                }
            }
        }

        // 3. Fallback to Category default
        $category = $product->category;
        if (! $category && $product->parent_id && isset($parent)) {
            $category = $parent->category;
        }

        if ($category && $category->size_chart_id) {
            $chart = $category->relationLoaded('sizeChart')
                ? $category->sizeChart
                : $category->sizeChart()->first();

            if ($chart && $chart->is_active) {
                return $chart;
            }
        }

        return null;
    }
}
