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
        Schema::table('warehouses', function (Blueprint $table) {
            $table->boolean('catalog_delivery_enabled')->default(true)->after('is_active');
            $table->boolean('catalog_pickup_enabled')->default(true)->after('catalog_delivery_enabled');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('warehouses', function (Blueprint $table) {
            $table->dropColumn(['catalog_delivery_enabled', 'catalog_pickup_enabled']);
        });
    }
};
