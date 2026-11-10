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
        if (Schema::hasTable('products') && ! Schema::hasColumn('products', 'variant_display_type')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('variant_display_type', 20)
                    ->default('color')
                    ->after('has_variants')
                    ->comment('Tipe tampilan varian warna: color (lingkaran swatch), image (foto baju), pill (pill teks)');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('products') && Schema::hasColumn('products', 'variant_display_type')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('variant_display_type');
            });
        }
    }
};
