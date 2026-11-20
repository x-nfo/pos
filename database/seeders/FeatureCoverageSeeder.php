<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\BankAccount;
use App\Models\GoodsReceiving;
use App\Models\GoodsReceivingItem;
use App\Models\Payable;
use App\Models\PayablePayment;
use App\Models\PaymentSetting;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Setting;
use App\Models\StockMutation;
use App\Models\StockOpname;
use App\Models\Supplier;
use App\Models\SupplierReturn;
use App\Models\SupplierReturnItem;
use App\Models\Transaction;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\GoodsReceivingService;
use App\Services\PurchaseOrderService;
use App\Services\StockMutationService;
use App\Services\SupplierReturnService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class FeatureCoverageSeeder extends Seeder
{
    public function run(): void
    {
        if (! $this->requiredTablesExist()) {
            $this->command?->warn('Skipping FeatureCoverageSeeder because required tables do not exist.');

            return;
        }

        $admin = User::where('email', 'admin@mail.com')->first() ?? User::where('email', 'ruslisanda63@gmail.com')->first() ?? User::first();
        $cashier = User::where('email', 'kasir@mail.com')->first() ?? $admin;

        if (! $admin || ! $cashier) {
            $this->command?->warn('Skipping FeatureCoverageSeeder because sample users are missing.');

            return;
        }

        $suppliers = Supplier::orderBy('name')->get()->keyBy('name');
        $products = Product::orderBy('id')->get()->keyBy('barcode');

        if ($suppliers->isEmpty() || $products->isEmpty()) {
            $this->command?->warn('Skipping FeatureCoverageSeeder because suppliers or products are missing.');

            return;
        }

        $this->command?->info('Seeding feature coverage data...');

        $this->resetFeatureData();
        $this->seedStoreSettings();
        $bankAccounts = $this->seedBankAccounts();
        $this->configurePaymentSettings();
        $this->assignBankTransferTransaction($bankAccounts, $cashier);

        Auth::setUser($admin);

        try {
            $this->seedPurchaseFlow($admin, $cashier, $suppliers, $products);
            $this->seedStockOpnames($admin, $products);
            $this->seedSupplementaryAuditLogs($admin, $cashier, $bankAccounts);
        } finally {
            Auth::logout();
        }
    }

    private function requiredTablesExist(): bool
    {
        return collect([
            'bank_accounts',
            'settings',
            'purchase_orders',
            'purchase_order_items',
            'goods_receivings',
            'goods_receiving_items',
            'supplier_returns',
            'supplier_return_items',
            'stock_opnames',
            'stock_opname_items',
            'stock_mutations',
            'audit_logs',
            'payables',
            'payable_payments',
        ])->every(fn (string $table) => Schema::hasTable($table));
    }

    private function resetFeatureData(): void
    {
        $purchasePayableIds = Payable::query()
            ->whereNotNull('purchase_order_id')
            ->pluck('id');

        if ($purchasePayableIds->isNotEmpty()) {
            PayablePayment::query()->whereIn('payable_id', $purchasePayableIds)->delete();
        }

        AuditLog::query()
            ->whereIn('module', ['purchase', 'bank_accounts', 'store_settings', 'payment_settings', 'cashier_shifts'])
            ->delete();

        AuditLog::query()
            ->where('module', 'payable')
            ->where('description', 'like', 'Hutang otomatis dari penerimaan PO %')
            ->delete();

        AuditLog::query()
            ->where('module', 'stock')
            ->where(function ($query) {
                $query
                    ->where('description', 'like', 'Stok masuk dari penerimaan barang %')
                    ->orWhere('description', 'like', 'Stok keluar dari retur supplier %')
                    ->orWhere('description', 'Stock opname difinalisasi.%')
                    ->orWhere('description', 'like', 'Stok produk disesuaikan melalui stock opname.%');
            })
            ->delete();

        StockMutation::query()
            ->whereIn('reference_type', ['goods_receiving', 'supplier_return', 'stock_opname'])
            ->delete();

        Schema::disableForeignKeyConstraints();

        try {
            SupplierReturnItem::truncate();
            SupplierReturn::truncate();
            GoodsReceivingItem::truncate();
            GoodsReceiving::truncate();
            Payable::query()->whereNotNull('purchase_order_id')->delete();
            PurchaseOrderItem::truncate();
            PurchaseOrder::truncate();

            DB::table('stock_opname_items')->delete();
            StockOpname::truncate();

            BankAccount::truncate();
        } finally {
            Schema::enableForeignKeyConstraints();
        }
    }

    private function seedStoreSettings(): void
    {
        $settings = [
            'monthly_sales_target' => ['value' => '35000000', 'description' => 'Target penjualan bulanan'],
            'store_name' => ['value' => 'VELOUR APPAREL & CO.', 'description' => 'Nama butik toko fashion'],
            'store_logo' => ['value' => null, 'description' => 'Logo toko'],
            'store_address' => ['value' => 'Jl. Senopati No. 88, Kebayoran Baru, Jakarta Selatan, DKI Jakarta 12190', 'description' => 'Alamat lengkap toko'],
            'store_phone' => ['value' => '0812-9988-7766', 'description' => 'Nomor telepon toko'],
            'store_email' => ['value' => 'hello@velourapparel.test', 'description' => 'Email toko'],
            'store_website' => ['value' => 'https://velourapparel.test', 'description' => 'Website atau sosial media'],
            'store_city' => ['value' => 'Jakarta Selatan', 'description' => 'Kota/Kabupaten toko'],
        ];

        foreach ($settings as $key => $payload) {
            Setting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => $payload['value'],
                    'description' => $payload['description'],
                ]
            );
        }
    }

    private function seedBankAccounts(): Collection
    {
        $rows = collect([
            [
                'bank_name' => 'BCA',
                'account_number' => '8820192831',
                'account_name' => 'PT Velour Kreasi Mode',
                'is_active' => true,
                'sort_order' => 0,
            ],
            [
                'bank_name' => 'Mandiri',
                'account_number' => '1370098765432',
                'account_name' => 'PT Velour Kreasi Mode',
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'bank_name' => 'BRI',
                'account_number' => '002401998877503',
                'account_name' => 'PT Velour Kreasi Mode',
                'is_active' => false,
                'sort_order' => 2,
            ],
        ]);

        return $rows->map(function (array $row) {
            return BankAccount::create($row);
        })->keyBy('bank_name');
    }

    private function configurePaymentSettings(): void
    {
        PaymentSetting::firstOrCreate([], [
            'default_gateway' => 'cash',
        ])->update([
            'default_gateway' => 'cash',
            'bank_transfer_enabled' => true,
            'midtrans_enabled' => false,
            'xendit_enabled' => false,
        ]);
    }

    private function assignBankTransferTransaction(Collection $bankAccounts, User $cashier): void
    {
        $bankAccount = $bankAccounts->get('BCA');
        $transaction = Transaction::query()
            ->whereNull('customer_id')
            ->latest('id')
            ->first();

        if (! $bankAccount || ! $transaction) {
            return;
        }

        $grandTotal = (int) $transaction->grand_total;

        $transaction->update([
            'cashier_id' => $cashier->id,
            'payment_method' => PaymentSetting::GATEWAY_BANK_TRANSFER,
            'payment_status' => 'paid',
            'payment_reference' => 'TRF-'.$transaction->invoice,
            'bank_account_id' => $bankAccount->id,
            'cash' => $grandTotal,
            'change' => 0,
        ]);
    }

    private function seedPurchaseFlow(
        User $admin,
        User $cashier,
        Collection $suppliers,
        Collection $products
    ): void {
        $purchaseOrderService = app(PurchaseOrderService::class);
        $goodsReceivingService = app(GoodsReceivingService::class);
        $supplierReturnService = app(SupplierReturnService::class);

        $draftOrder = $purchaseOrderService->createOrder(
            [
                'warehouse_id' => 1,
                'supplier_id' => $suppliers->get('UD Label & Aksesoris Mode')?->id ?? $suppliers->first()?->id,
                'notes' => 'Draft pengadaan tote bag dan aksesoris butik akhir minggu.',
            ],
            [
                [
                    'product_id' => $products->get('APRL-ACC-001')?->id ?? $products->first()?->id,
                    'qty_ordered' => 18,
                    'unit_price' => 42000,
                ],
                [
                    'product_id' => $products->get('APRL-ACC-002')?->id ?? $products->skip(1)->first()?->id,
                    'qty_ordered' => 12,
                    'unit_price' => 32000,
                ],
            ],
            $admin->id,
        );

        $draftOrder->update([
            'created_at' => now()->subDays(4)->setTime(9, 15),
            'updated_at' => now()->subDays(4)->setTime(9, 15),
        ]);

        $cancelledOrder = $purchaseOrderService->createOrder(
            [
                'warehouse_id' => 1,
                'supplier_id' => $suppliers->get('PT Garment Bandung Textiles')?->id ?? $suppliers->first()?->id,
                'notes' => 'PO dibatalkan karena kuota warna kain dari supplier habis.',
            ],
            [
                [
                    'product_id' => $products->get('APRL-ACC-003')?->id ?? $products->first()?->id,
                    'qty_ordered' => 30,
                    'unit_price' => 25000,
                ],
                [
                    'product_id' => $products->get('APRL-TSH-001')?->id ?? $products->skip(1)->first()?->id,
                    'qty_ordered' => 20,
                    'unit_price' => 60000,
                ],
            ],
            $admin->id,
        );
        $purchaseOrderService->placeOrder($cancelledOrder);
        $purchaseOrderService->cancelOrder($cancelledOrder);

        $cancelledOrder->update([
            'ordered_at' => now()->subDays(6)->setTime(10, 0),
            'created_at' => now()->subDays(6)->setTime(9, 0),
            'updated_at' => now()->subDays(5)->setTime(11, 0),
        ]);

        $partialOrder = $purchaseOrderService->createOrder(
            [
                'warehouse_id' => 1,
                'supplier_id' => $suppliers->get('PT Garment Bandung Textiles')?->id ?? $suppliers->first()?->id,
                'notes' => 'PO restock kaos boxy dan essentials untuk persiapan akhir pekan.',
            ],
            [
                [
                    'product_id' => $products->get('TSH-OVR-BLK-M')?->id ?? $products->first()?->id,
                    'qty_ordered' => 48,
                    'unit_price' => 65000,
                ],
                [
                    'product_id' => $products->get('TSH-OVR-WHT-L')?->id ?? $products->skip(1)->first()?->id,
                    'qty_ordered' => 24,
                    'unit_price' => 65000,
                ],
            ],
            $admin->id,
        );
        $purchaseOrderService->placeOrder($partialOrder);

        $partialOrder->update([
            'ordered_at' => now()->subDays(3)->setTime(8, 30),
            'created_at' => now()->subDays(3)->setTime(8, 0),
            'updated_at' => now()->subDays(3)->setTime(8, 30),
        ]);

        $partialReceiving = $goodsReceivingService->receive(
            $partialOrder->fresh('items'),
            [
                [
                    'purchase_order_item_id' => $partialOrder->items[0]->id,
                    'qty_received' => 30,
                    'notes' => 'Sebagian kaos hitam diterima sesuai surat jalan pertama.',
                ],
                [
                    'purchase_order_item_id' => $partialOrder->items[1]->id,
                    'qty_received' => 10,
                    'notes' => 'Sebagian kaos putih diterima lebih awal.',
                ],
            ],
            'Penerimaan pertama untuk PO restock mingguan.',
            $cashier->id,
        );

        $partialReceiving->update([
            'received_at' => now()->subDays(2)->setTime(10, 15),
            'created_at' => now()->subDays(2)->setTime(10, 15),
            'updated_at' => now()->subDays(2)->setTime(10, 15),
        ]);

        $partialOrder->refresh();
        $partialOrder->update([
            'updated_at' => now()->subDays(2)->setTime(10, 15),
        ]);

        $completedOrder = $purchaseOrderService->createOrder(
            [
                'warehouse_id' => 1,
                'supplier_id' => $suppliers->get('CV Denim Mill Nusantara')?->id ?? $suppliers->first()?->id,
                'notes' => 'PO lengkap untuk celana chino dan denim selvedge reguler.',
            ],
            [
                [
                    'product_id' => $products->get('PNT-CHN-BLK-32')?->id ?? $products->first()?->id,
                    'qty_ordered' => 15,
                    'unit_price' => 115000,
                ],
                [
                    'product_id' => $products->get('PNT-CHN-SND-32')?->id ?? $products->skip(1)->first()?->id,
                    'qty_ordered' => 20,
                    'unit_price' => 115000,
                ],
                [
                    'product_id' => $products->get('DNM-RAW-IND-32')?->id ?? $products->skip(2)->first()?->id,
                    'qty_ordered' => 16,
                    'unit_price' => 180000,
                ],
            ],
            $admin->id,
        );
        $purchaseOrderService->placeOrder($completedOrder);

        $completedOrder->update([
            'ordered_at' => now()->subDays(2)->setTime(7, 45),
            'created_at' => now()->subDays(2)->setTime(7, 20),
            'updated_at' => now()->subDays(2)->setTime(7, 45),
        ]);

        $completedReceiving = $goodsReceivingService->receive(
            $completedOrder->fresh('items'),
            $completedOrder->items->map(fn (PurchaseOrderItem $item) => [
                'purchase_order_item_id' => $item->id,
                'qty_received' => $item->qty_ordered,
                'notes' => 'Diterima penuh dari supplier.',
            ])->all(),
            'Seluruh item diterima lengkap dan langsung masuk gudang.',
            $cashier->id,
        );

        $completedReceiving->update([
            'received_at' => now()->subDay()->setTime(11, 10),
            'created_at' => now()->subDay()->setTime(11, 10),
            'updated_at' => now()->subDay()->setTime(11, 10),
        ]);

        $completedOrder->refresh();
        $completedOrder->update([
            'completed_at' => now()->subDay()->setTime(11, 10),
            'updated_at' => now()->subDay()->setTime(11, 10),
        ]);

        $completedPayable = Payable::query()
            ->where('purchase_order_id', $completedOrder->id)
            ->first();

        if ($completedPayable) {
            $completedPayable->update([
                'paid' => 250000,
                'status' => 'partial',
                'due_date' => now()->addDays(14)->toDateString(),
                'updated_at' => now()->subHours(12),
            ]);

            PayablePayment::create([
                'payable_id' => $completedPayable->id,
                'paid_at' => now()->subHours(12)->toDateString(),
                'amount' => 250000,
                'method' => 'bank_transfer',
                'user_id' => $admin->id,
                'note' => 'Pembayaran DP untuk penerimaan barang.',
                'created_at' => now()->subHours(12),
                'updated_at' => now()->subHours(12),
            ]);
        }

        $completedReceiving->load('items.purchaseOrderItem');

        $draftReturn = $supplierReturnService->createReturn(
            [
                'supplier_id' => $completedOrder->supplier_id,
                'goods_receiving_id' => $completedReceiving->id,
                'payable_id' => $completedPayable?->id,
                'notes' => 'Draft retur untuk celana dengan jahitan saku miring, menunggu pickup.',
            ],
            [
                [
                    'goods_receiving_item_id' => $completedReceiving->items->last()?->id,
                    'product_id' => $completedReceiving->items->last()?->product_id,
                    'qty_returned' => 1,
                    'unit_price' => $completedReceiving->items->last()?->purchaseOrderItem?->unit_price ?? 0,
                    'reason' => 'Jahitan saku miring',
                    'notes' => 'Belum diproses, masih menunggu pickup konveksi.',
                ],
            ],
            $admin->id,
        );

        $draftReturn->update([
            'created_at' => now()->subHours(8),
            'updated_at' => now()->subHours(8),
        ]);

        $completedReturn = $supplierReturnService->createReturn(
            [
                'supplier_id' => $completedOrder->supplier_id,
                'goods_receiving_id' => $completedReceiving->id,
                'payable_id' => $completedPayable?->id,
                'notes' => 'Retur barang cacat tenun kain dari batch celana denim.',
            ],
            [
                [
                    'goods_receiving_item_id' => $completedReceiving->items->first()?->id,
                    'product_id' => $completedReceiving->items->first()?->product_id,
                    'qty_returned' => 2,
                    'unit_price' => $completedReceiving->items->first()?->purchaseOrderItem?->unit_price ?? 0,
                    'reason' => 'Cacat serat tenun kain',
                    'notes' => 'Dikembalikan saat inspeksi inbound garmen.',
                ],
            ],
            $admin->id,
        );
        $supplierReturnService->complete($completedReturn);

        $completedReturn->update([
            'returned_at' => now()->subHours(6),
            'created_at' => now()->subHours(6),
            'updated_at' => now()->subHours(6),
        ]);
    }

    private function seedStockOpnames(User $admin, Collection $products): void
    {
        $stockMutationService = app(StockMutationService::class);
        $auditLogService = app(AuditLogService::class);

        $draftOpname = StockOpname::create([
            'warehouse_id' => 1,
            'code' => 'SO-DRAFT-001',
            'status' => 'draft',
            'notes' => 'Sesi stock opname rak display depan, belum semua item dihitung.',
            'created_by' => $admin->id,
            'created_at' => now()->subHours(5),
            'updated_at' => now()->subHours(5),
        ]);

        $draftItems = [
            $products->get('TSH-OVR-BLK-L') ?? $products->first(),
            $products->get('SHT-OXF-WHT-M') ?? $products->skip(1)->first(),
            $products->get('APRL-ACC-001') ?? $products->skip(2)->first(),
        ];

        foreach (collect($draftItems)->filter() as $product) {
            $draftOpname->items()->create([
                'product_id' => $product->id,
                'system_stock' => (int) $product->stock,
                'created_at' => now()->subHours(5),
                'updated_at' => now()->subHours(5),
            ]);
        }

        $finalizedAt = now()->subHours(2);
        $finalizedOpname = StockOpname::create([
            'warehouse_id' => 1,
            'code' => 'SO-FINAL-001',
            'status' => 'draft',
            'notes' => 'Opname gudang display untuk batch busana awal pekan.',
            'created_by' => $admin->id,
            'created_at' => now()->subHours(3),
            'updated_at' => now()->subHours(3),
        ]);

        $adjustments = collect([
            [
                'product' => $products->get('PNT-CHN-BLK-32') ?? $products->first(),
                'physical_stock' => null,
                'adjustment' => -1,
                'reason' => 'Satu pcs kancing celana copot saat display rak.',
            ],
            [
                'product' => $products->get('DNM-RAW-IND-32') ?? $products->skip(1)->first(),
                'physical_stock' => null,
                'adjustment' => 2,
                'reason' => 'Temuan stok celana terselip di rak gudang belakang.',
            ],
            [
                'product' => $products->get('SH-SNK-WHT-42') ?? $products->skip(2)->first(),
                'physical_stock' => null,
                'adjustment' => 0,
                'reason' => null,
            ],
        ])->filter(fn (array $item) => $item['product'] instanceof Product)
            ->map(function (array $item) {
                $item['physical_stock'] = max(0, (int) $item['product']->stock + $item['adjustment']);

                return $item;
            });

        foreach ($adjustments as $row) {
            $systemStock = (int) $row['product']->stock;
            $difference = $row['physical_stock'] - $systemStock;

            $finalizedOpname->items()->create([
                'product_id' => $row['product']->id,
                'system_stock' => $systemStock,
                'physical_stock' => $row['physical_stock'],
                'difference' => $difference,
                'adjustment_reason' => $difference === 0 ? null : $row['reason'],
                'created_at' => now()->subHours(3),
                'updated_at' => now()->subHours(3),
            ]);
        }

        $finalizedOpname->load('items.product');

        DB::transaction(function () use ($finalizedOpname, $finalizedAt, $admin, $stockMutationService, $auditLogService) {
            foreach ($finalizedOpname->items as $item) {
                $product = $item->product()->lockForUpdate()->first();

                if (! $product || $item->physical_stock === null) {
                    continue;
                }

                $stockBefore = (int) $product->stock;
                $stockAfter = (int) $item->physical_stock;

                // $product->update([
                //     'stock' => $stockAfter,
                // ]);

                $stockMutationService->recordStockOpnameAdjustment(
                    product: $product,
                    stockOpname: $finalizedOpname,
                    stockBefore: $stockBefore,
                    stockAfter: $stockAfter,
                    reason: $item->adjustment_reason,
                    userId: $admin->id,
                );
            }

            $finalizedOpname->update([
                'status' => 'finalized',
                'finalized_by' => $admin->id,
                'finalized_at' => $finalizedAt,
                'updated_at' => $finalizedAt,
            ]);

            $auditLogService->log(
                event: 'stock.opname.finalized',
                module: 'stock',
                auditable: $finalizedOpname,
                description: 'Stock opname difinalisasi.',
                before: ['status' => 'draft'],
                after: ['status' => 'finalized'],
                meta: [
                    'code' => $finalizedOpname->code,
                    'notes' => $finalizedOpname->notes,
                    'items' => $finalizedOpname->items->map(fn ($item) => [
                        'product_id' => $item->product_id,
                        'product_title' => $item->product?->title,
                        'stock_before' => (int) $item->system_stock,
                        'stock_after' => $item->physical_stock !== null ? (int) $item->physical_stock : null,
                        'difference' => $item->difference !== null ? (int) $item->difference : null,
                        'reason' => $item->adjustment_reason,
                        'reference' => $finalizedOpname->code,
                    ])->values()->all(),
                ],
                actor: $admin,
            );
        });
    }

    private function seedSupplementaryAuditLogs(User $admin, User $cashier, Collection $bankAccounts): void
    {
        $auditLogService = app(AuditLogService::class);

        $auditLogService->log(
            event: 'store.setting.updated',
            module: 'store_settings',
            auditable: ['target_label' => 'Store Profile'],
            description: 'Profil toko diperbarui.',
            before: [
                'store_name' => 'Toko Anda',
                'store_address' => 'Alamat belum diisi',
                'store_phone' => '',
                'store_email' => '',
                'store_website' => '',
                'store_city' => '',
                'store_logo_changed' => false,
            ],
            after: [
                'store_name' => Setting::get('store_name'),
                'store_address' => Setting::get('store_address'),
                'store_phone' => Setting::get('store_phone'),
                'store_email' => Setting::get('store_email'),
                'store_website' => Setting::get('store_website'),
                'store_city' => Setting::get('store_city'),
                'store_logo_changed' => false,
            ],
            actor: $admin,
        );

        foreach ($bankAccounts as $account) {
            $auditLogService->log(
                event: 'bank_account.created',
                module: 'bank_accounts',
                auditable: $account,
                description: 'Rekening bank ditambahkan.',
                after: [
                    'bank_name' => $account->bank_name,
                    'account_number_masked' => $auditLogService->maskAccountNumber($account->account_number),
                    'account_name' => $account->account_name,
                    'is_active' => (bool) $account->is_active,
                    'sort_order' => (int) $account->sort_order,
                ],
                actor: $admin,
            );
        }

        $auditLogService->log(
            event: 'bank_account.reordered',
            module: 'bank_accounts',
            auditable: ['target_label' => 'Bank Accounts'],
            description: 'Urutan rekening bank diperbarui.',
            before: [
                'order' => [
                    ['bank_name' => 'Mandiri', 'sort_order' => 0],
                    ['bank_name' => 'BCA', 'sort_order' => 1],
                    ['bank_name' => 'BRI', 'sort_order' => 2],
                ],
            ],
            after: [
                'order' => $bankAccounts->sortBy('sort_order')->values()->map(fn (BankAccount $account) => [
                    'bank_name' => $account->bank_name,
                    'sort_order' => (int) $account->sort_order,
                ])->all(),
            ],
            actor: $admin,
        );

        $auditLogService->log(
            event: 'payment.setting.updated',
            module: 'payment_settings',
            auditable: PaymentSetting::first(),
            description: 'Konfigurasi payment gateway diperbarui.',
            before: [
                'default_gateway' => 'cash',
                'bank_transfer_enabled' => false,
                'midtrans_enabled' => false,
                'midtrans_production' => false,
                'xendit_enabled' => false,
                'xendit_production' => false,
            ],
            after: [
                'default_gateway' => 'cash',
                'bank_transfer_enabled' => true,
                'midtrans_enabled' => false,
                'midtrans_production' => false,
                'xendit_enabled' => false,
                'xendit_production' => false,
            ],
            actor: $admin,
        );

        $auditLogService->log(
            event: 'cashier.shift.reviewed',
            module: 'cashier_shifts',
            auditable: ['target_label' => 'Shift Kasir Aktif'],
            description: 'Supervisor meninjau ringkasan shift kasir aktif.',
            meta: [
                'reviewed_by' => $admin->name,
                'cashier' => $cashier->name,
                'reviewed_at' => now()->subHour()->toIso8601String(),
            ],
            actor: $admin,
        );
    }
}
