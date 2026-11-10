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
        // 1. Update customer_vouchers table to support general/public store coupons
        if (Schema::hasTable('customer_vouchers')) {
            Schema::table('customer_vouchers', function (Blueprint $table) {
                // Allow customer_id to be nullable for general coupons
                $table->foreignId('customer_id')->nullable()->change();

                if (! Schema::hasColumn('customer_vouchers', 'max_discount')) {
                    $table->unsignedBigInteger('max_discount')->nullable()->after('minimum_order')->comment('Maksimal potongan diskon untuk tipe persentase');
                }
                if (! Schema::hasColumn('customer_vouchers', 'usage_limit')) {
                    $table->unsignedInteger('usage_limit')->nullable()->after('max_discount')->comment('Batas total pemakaian kupon');
                }
                if (! Schema::hasColumn('customer_vouchers', 'times_used')) {
                    $table->unsignedInteger('times_used')->default(0)->after('usage_limit')->comment('Jumlah kupon yang telah dipakai');
                }
            });
        }

        // 2. Add coupon & discount fields to catalog_orders table
        if (Schema::hasTable('catalog_orders')) {
            Schema::table('catalog_orders', function (Blueprint $table) {
                if (! Schema::hasColumn('catalog_orders', 'customer_voucher_id')) {
                    $table->foreignId('customer_voucher_id')->nullable()->after('notes')->constrained('customer_vouchers')->nullOnDelete();
                }
                if (! Schema::hasColumn('catalog_orders', 'coupon_code')) {
                    $table->string('coupon_code', 50)->nullable()->after('customer_voucher_id');
                }
                if (! Schema::hasColumn('catalog_orders', 'discount_amount')) {
                    $table->unsignedBigInteger('discount_amount')->default(0)->after('coupon_code');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('catalog_orders')) {
            Schema::table('catalog_orders', function (Blueprint $table) {
                if (Schema::hasColumn('catalog_orders', 'customer_voucher_id')) {
                    $table->dropForeign(['customer_voucher_id']);
                    $table->dropColumn('customer_voucher_id');
                }
                if (Schema::hasColumn('catalog_orders', 'coupon_code')) {
                    $table->dropColumn('coupon_code');
                }
                if (Schema::hasColumn('catalog_orders', 'discount_amount')) {
                    $table->dropColumn('discount_amount');
                }
            });
        }

        if (Schema::hasTable('customer_vouchers')) {
            Schema::table('customer_vouchers', function (Blueprint $table) {
                if (Schema::hasColumn('customer_vouchers', 'max_discount')) {
                    $table->dropColumn('max_discount');
                }
                if (Schema::hasColumn('customer_vouchers', 'usage_limit')) {
                    $table->dropColumn('usage_limit');
                }
                if (Schema::hasColumn('customer_vouchers', 'times_used')) {
                    $table->dropColumn('times_used');
                }
            });
        }
    }
};
