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
        Schema::table('receivable_payments', function (Blueprint $table) {
            $table->foreignId('warehouse_id')->nullable()->after('bank_account_id')->constrained('warehouses')->nullOnDelete();
            $table->foreignId('cashier_shift_id')->nullable()->after('warehouse_id')->constrained('cashier_shifts')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('receivable_payments', function (Blueprint $table) {
            $table->dropForeign(['warehouse_id']);
            $table->dropForeign(['cashier_shift_id']);
            $table->dropColumn(['warehouse_id', 'cashier_shift_id']);
        });
    }
};
