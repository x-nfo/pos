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
        Schema::table('stock_transfer_items', function (Blueprint $table) {
            $table->foreignId('unit_id')->nullable()->after('product_id')->constrained('units')->nullOnDelete();
            $table->decimal('conversion_factor', 15, 4)->default(1.0000)->after('unit_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_transfer_items', function (Blueprint $table) {
            $table->dropForeign(['unit_id']);
            $table->dropColumn(['unit_id', 'conversion_factor']);
        });
    }
};
