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
        Schema::table('payment_settings', function (Blueprint $table) {
            $table->boolean('qrisly_enabled')->default(false)->after('xendit_production');
            $table->text('qrisly_api_key')->nullable()->after('qrisly_enabled');
            $table->string('qrisly_qris_id')->nullable()->after('qrisly_api_key');
            $table->boolean('qrisly_production')->default(false)->after('qrisly_qris_id');
            $table->boolean('qrisly_use_unique_amount')->default(true)->after('qrisly_production');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payment_settings', function (Blueprint $table) {
            $table->dropColumn([
                'qrisly_enabled',
                'qrisly_api_key',
                'qrisly_qris_id',
                'qrisly_production',
                'qrisly_use_unique_amount',
            ]);
        });
    }
};
