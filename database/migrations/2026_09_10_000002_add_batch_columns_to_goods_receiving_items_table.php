<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('goods_receiving_items', function (Blueprint $table) {
            $table->string('batch_number', 100)->nullable()->after('qty_received');
            $table->date('expired_at')->nullable()->after('batch_number');
        });
    }

    public function down(): void
    {
        Schema::table('goods_receiving_items', function (Blueprint $table) {
            $table->dropColumn(['batch_number', 'expired_at']);
        });
    }
};
