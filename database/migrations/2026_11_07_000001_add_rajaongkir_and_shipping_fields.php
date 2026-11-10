<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Add weight column to products table
        if (Schema::hasTable('products') && ! Schema::hasColumn('products', 'weight')) {
            Schema::table('products', function (Blueprint $table) {
                $table->unsignedInteger('weight')->nullable()->default(1000)->after('sell_price')->comment('Berat produk dalam gram');
            });
        }

        // 2. Add shipping detail columns to transactions table
        if (Schema::hasTable('transactions')) {
            Schema::table('transactions', function (Blueprint $table) {
                if (! Schema::hasColumn('transactions', 'shipping_courier')) {
                    $table->string('shipping_courier', 50)->nullable()->after('shipping_cost');
                }
                if (! Schema::hasColumn('transactions', 'shipping_service')) {
                    $table->string('shipping_service', 50)->nullable()->after('shipping_courier');
                }
                if (! Schema::hasColumn('transactions', 'shipping_etd')) {
                    $table->string('shipping_etd', 50)->nullable()->after('shipping_service');
                }
                if (! Schema::hasColumn('transactions', 'shipping_weight')) {
                    $table->unsignedInteger('shipping_weight')->nullable()->after('shipping_etd');
                }
                if (! Schema::hasColumn('transactions', 'shipping_destination_id')) {
                    $table->unsignedBigInteger('shipping_destination_id')->nullable()->after('shipping_weight');
                }
                if (! Schema::hasColumn('transactions', 'shipping_destination_label')) {
                    $table->string('shipping_destination_label')->nullable()->after('shipping_destination_id');
                }
                if (! Schema::hasColumn('transactions', 'shipping_tracking_number')) {
                    $table->string('shipping_tracking_number', 100)->nullable()->after('shipping_destination_label');
                }
            });
        }

        // 3. Add shipping detail columns to catalog_orders table
        if (Schema::hasTable('catalog_orders')) {
            Schema::table('catalog_orders', function (Blueprint $table) {
                if (! Schema::hasColumn('catalog_orders', 'shipping_courier')) {
                    $table->string('shipping_courier', 50)->nullable()->after('shipping_cost');
                }
                if (! Schema::hasColumn('catalog_orders', 'shipping_service')) {
                    $table->string('shipping_service', 50)->nullable()->after('shipping_courier');
                }
                if (! Schema::hasColumn('catalog_orders', 'shipping_etd')) {
                    $table->string('shipping_etd', 50)->nullable()->after('shipping_service');
                }
                if (! Schema::hasColumn('catalog_orders', 'shipping_weight')) {
                    $table->unsignedInteger('shipping_weight')->nullable()->after('shipping_etd');
                }
                if (! Schema::hasColumn('catalog_orders', 'shipping_destination_id')) {
                    $table->unsignedBigInteger('shipping_destination_id')->nullable()->after('shipping_weight');
                }
                if (! Schema::hasColumn('catalog_orders', 'shipping_destination_label')) {
                    $table->string('shipping_destination_label')->nullable()->after('shipping_destination_id');
                }
                if (! Schema::hasColumn('catalog_orders', 'shipping_tracking_number')) {
                    $table->string('shipping_tracking_number', 100)->nullable()->after('shipping_destination_label');
                }
            });
        }

        // 4. Add origin columns to warehouses table
        if (Schema::hasTable('warehouses')) {
            Schema::table('warehouses', function (Blueprint $table) {
                if (! Schema::hasColumn('warehouses', 'rajaongkir_origin_id')) {
                    $table->unsignedBigInteger('rajaongkir_origin_id')->nullable()->after('address');
                }
                if (! Schema::hasColumn('warehouses', 'rajaongkir_origin_label')) {
                    $table->string('rajaongkir_origin_label')->nullable()->after('rajaongkir_origin_id');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('products') && Schema::hasColumn('products', 'weight')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('weight');
            });
        }

        if (Schema::hasTable('transactions')) {
            Schema::table('transactions', function (Blueprint $table) {
                $columns = [
                    'shipping_courier',
                    'shipping_service',
                    'shipping_etd',
                    'shipping_weight',
                    'shipping_destination_id',
                    'shipping_destination_label',
                    'shipping_tracking_number',
                ];
                $existing = array_filter($columns, fn ($col) => Schema::hasColumn('transactions', $col));
                if (! empty($existing)) {
                    $table->dropColumn($existing);
                }
            });
        }

        if (Schema::hasTable('catalog_orders')) {
            Schema::table('catalog_orders', function (Blueprint $table) {
                $columns = [
                    'shipping_courier',
                    'shipping_service',
                    'shipping_etd',
                    'shipping_weight',
                    'shipping_destination_id',
                    'shipping_destination_label',
                    'shipping_tracking_number',
                ];
                $existing = array_filter($columns, fn ($col) => Schema::hasColumn('catalog_orders', $col));
                if (! empty($existing)) {
                    $table->dropColumn($existing);
                }
            });
        }

        if (Schema::hasTable('warehouses')) {
            Schema::table('warehouses', function (Blueprint $table) {
                $columns = ['rajaongkir_origin_id', 'rajaongkir_origin_label'];
                $existing = array_filter($columns, fn ($col) => Schema::hasColumn('warehouses', $col));
                if (! empty($existing)) {
                    $table->dropColumn($existing);
                }
            });
        }
    }
};
