<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('catalog_orders', function (Blueprint $table) {
            $table->string('payment_method')->nullable()->default('bank_transfer')->after('grand_total');
            $table->foreignId('bank_account_id')->nullable()->after('payment_method')->constrained('bank_accounts')->nullOnDelete();
            $table->string('payment_proof')->nullable()->after('bank_account_id');
            $table->timestamp('payment_proof_uploaded_at')->nullable()->after('payment_proof');
        });
    }

    public function down(): void
    {
        Schema::table('catalog_orders', function (Blueprint $table) {
            $table->dropForeign(['bank_account_id']);
            $table->dropColumn([
                'payment_method',
                'bank_account_id',
                'payment_proof',
                'payment_proof_uploaded_at',
            ]);
        });
    }
};
