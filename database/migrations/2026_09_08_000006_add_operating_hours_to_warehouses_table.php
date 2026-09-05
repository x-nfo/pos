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
            $table->boolean('is_24_hours')->default(false)->after('catalog_pickup_enabled');
            $table->string('open_time', 5)->default('08:00')->after('is_24_hours');
            $table->string('close_time', 5)->default('21:00')->after('open_time');
            $table->json('operating_days')->nullable()->after('close_time');
            $table->boolean('is_temporarily_closed')->default(false)->after('operating_days');
            $table->string('closure_reason')->nullable()->after('is_temporarily_closed');
            $table->date('reopen_date')->nullable()->after('closure_reason');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('warehouses', function (Blueprint $table) {
            $table->dropColumn([
                'is_24_hours',
                'open_time',
                'close_time',
                'operating_days',
                'is_temporarily_closed',
                'closure_reason',
                'reopen_date',
            ]);
        });
    }
};
