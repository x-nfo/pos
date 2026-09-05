<?php

use App\Models\Payable;
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
        Schema::table('payables', function (Blueprint $table) {
            $table->foreignId('warehouse_id')->nullable()->after('purchase_order_id')->constrained('warehouses')->nullOnDelete();
        });

        // Backfill existing payables that already have a purchase_order_id
        if (Schema::hasTable('payables') && Schema::hasTable('purchase_orders')) {
            Payable::query()
                ->whereNotNull('purchase_order_id')
                ->whereNull('warehouse_id')
                ->with('purchaseOrder')
                ->each(function ($payable) {
                    if ($payable->purchaseOrder?->warehouse_id) {
                        $payable->update(['warehouse_id' => $payable->purchaseOrder->warehouse_id]);
                    }
                });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payables', function (Blueprint $table) {
            $table->dropConstrainedForeignId('warehouse_id');
        });
    }
};
