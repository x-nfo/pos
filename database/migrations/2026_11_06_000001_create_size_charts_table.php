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
        Schema::create('size_charts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->string('apparel_type', 30)->default('tops'); // tops, bottoms, footwear, accessories
            $table->string('default_unit', 10)->default('cm');
            $table->json('columns');
            $table->json('measurements');
            $table->json('fit_rules')->nullable();
            $table->string('diagram_image')->nullable();
            $table->text('how_to_measure_notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->foreignId('size_chart_id')
                ->nullable()
                ->after('description')
                ->constrained('size_charts')
                ->nullOnDelete();
        });

        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('size_chart_id')
                ->nullable()
                ->after('category_id')
                ->constrained('size_charts')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('size_chart_id');
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->dropConstrainedForeignId('size_chart_id');
        });

        Schema::dropIfExists('size_charts');
    }
};
