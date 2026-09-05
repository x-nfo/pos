<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Migrate remaining stock to default warehouse
        $defaultWarehouse = DB::table('warehouses')->orderBy('id')->first();
        if ($defaultWarehouse) {
            $products = DB::table('products')->where('stock', '>', 0)->get();
            foreach ($products as $product) {
                $exists = DB::table('product_warehouse')
                    ->where('product_id', $product->id)
                    ->where('warehouse_id', $defaultWarehouse->id)
                    ->exists();

                if (! $exists) {
                    DB::table('product_warehouse')->insert([
                        'product_id' => $product->id,
                        'warehouse_id' => $defaultWarehouse->id,
                        'stock' => $product->stock,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }

        // 2. Drop stock column
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('stock');
        });

        // 3. Assign default warehouse_id to existing records with null warehouse_id
        if ($defaultWarehouse) {
            DB::table('transactions')->whereNull('warehouse_id')->update(['warehouse_id' => $defaultWarehouse->id]);
            DB::table('carts')->whereNull('warehouse_id')->update(['warehouse_id' => $defaultWarehouse->id]);
            DB::table('stock_mutations')->whereNull('warehouse_id')->update(['warehouse_id' => $defaultWarehouse->id]);
        }

        // 4. Make warehouse_id required on transactions, carts, stock_mutations
        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('warehouse_id')->nullable(false)->change();
        });
        Schema::table('carts', function (Blueprint $table) {
            $table->foreignId('warehouse_id')->nullable(false)->change();
        });
        Schema::table('stock_mutations', function (Blueprint $table) {
            $table->foreignId('warehouse_id')->nullable(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_mutations', function (Blueprint $table) {
            $table->foreignId('warehouse_id')->nullable()->change();
        });
        Schema::table('carts', function (Blueprint $table) {
            $table->foreignId('warehouse_id')->nullable()->change();
        });
        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('warehouse_id')->nullable()->change();
        });

        Schema::table('products', function (Blueprint $table) {
            $table->integer('stock')->default(0)->after('sell_price');
        });
    }
};
