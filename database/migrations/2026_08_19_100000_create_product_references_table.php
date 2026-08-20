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
        Schema::create('product_references', function (Blueprint $table) {
            $table->id();
            $table->string('barcode')->index();
            $table->string('sku')->nullable()->index();
            $table->string('name')->index();
            $table->string('category_name')->nullable()->index();
            $table->string('unit')->nullable();
            $table->decimal('buy_price', 15, 2)->default(0);
            $table->decimal('sell_price', 15, 2)->default(0);
            $table->string('supplier_name')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_references');
    }
};
