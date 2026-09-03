<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->call([
            PermissionSeeder::class,
            RoleSeeder::class,
            UserSeeder::class,
            PaymentSettingSeeder::class,
            SampleDataSeeder::class,
            OperationalCoreSeeder::class,
            FeatureCoverageSeeder::class,
            DineInSettingsSeeder::class,
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->seedDefaultWarehouse();
    }

    private function seedDefaultWarehouse(): void
    {
        $pusat = Warehouse::where('code', 'PUSAT')->first();

        if (! $pusat) {
            $pusat = Warehouse::create([
                'code' => 'PUSAT',
                'name' => 'Gudang Pusat',
                'type' => 'main',
                'is_active' => true,
                'sort_order' => 0,
            ]);
        }

        $cabang = Warehouse::where('code', 'CABANG-1')->first();
        if (! $cabang) {
            $cabang = Warehouse::create([
                'code' => 'CABANG-1',
                'name' => 'Cabang 1 (Retail)',
                'type' => 'branch',
                'is_active' => true,
                'sort_order' => 1,
            ]);
        }

        $defaultWarehouse = Warehouse::active()->orderBy('sort_order')->orderBy('code')->first() ?? $pusat;

        // Assign default cashier to branch warehouse if not set
        $cashier = User::where('email', 'kasir@mail.com')->first();
        if ($cashier && is_null($cashier->warehouse_id)) {
            $cashier->update(['warehouse_id' => $cabang->id]);
        }

        // Ensure all products have product_warehouse records for all active warehouses
        $activeWarehouses = Warehouse::active()->get();
        $productsList = DB::table('products')->get(['id', 'stock']);

        foreach ($activeWarehouses as $wh) {
            foreach ($productsList as $prod) {
                $exists = DB::table('product_warehouse')
                    ->where('product_id', $prod->id)
                    ->where('warehouse_id', $wh->id)
                    ->exists();

                if (! $exists) {
                    DB::table('product_warehouse')->insert([
                        'product_id' => $prod->id,
                        'warehouse_id' => $wh->id,
                        'stock' => max(10, (int) $prod->stock),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }
    }
}
