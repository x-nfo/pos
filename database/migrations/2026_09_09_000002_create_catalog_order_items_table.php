<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('catalog_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('catalog_order_id')->constrained('catalog_orders')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('product_title');
            $table->foreignId('unit_id')->nullable()->constrained('units')->nullOnDelete();
            $table->decimal('conversion_factor', 10, 4)->default(1);
            $table->integer('qty');
            $table->unsignedBigInteger('price');
            $table->unsignedBigInteger('subtotal');
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['catalog_order_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('catalog_order_items');
    }
};
