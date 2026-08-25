<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_returns', function (Blueprint $table) {
            $table->bigInteger('exchange_amount')->default(0)->after('total_return_amount');
            $table->bigInteger('difference_amount')->default(0)->after('exchange_amount');
            $table->string('exchange_payment_method', 30)->nullable()->after('difference_amount');
            $table->bigInteger('exchange_cash')->default(0)->after('exchange_payment_method');
            $table->bigInteger('exchange_change')->default(0)->after('exchange_cash');
        });

        Schema::create('sales_return_exchange_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sales_return_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->integer('qty');
            $table->bigInteger('unit_price');
            $table->bigInteger('subtotal');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_return_exchange_items');

        Schema::table('sales_returns', function (Blueprint $table) {
            $table->dropColumn([
                'exchange_amount',
                'difference_amount',
                'exchange_payment_method',
                'exchange_cash',
                'exchange_change',
            ]);
        });
    }
};
