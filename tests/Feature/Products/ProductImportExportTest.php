<?php

namespace Tests\Feature\Products;

use App\Exports\ProductsExport;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

class ProductImportExportTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([PermissionSeeder::class, RoleSeeder::class, UserSeeder::class]);
        $this->admin = User::role('super-admin')->first() ?? User::where('email', 'admin@mail.com')->first() ?? User::first();
        $this->admin->markEmailAsVerified();
        $this->actingAs($this->admin);
    }

    public function test_can_download_products_export(): void
    {
        Excel::fake();

        $response = $this->get(route('export.products'));

        $response->assertSuccessful();
        Excel::assertDownloaded('produk.xlsx', function (ProductsExport $export) {
            return true;
        });
    }

    public function test_can_download_product_and_customer_templates(): void
    {
        Excel::fake();

        $responseProducts = $this->get(route('import.template', ['type' => 'products']));
        $responseProducts->assertSuccessful();
        Excel::assertDownloaded('template-products.xlsx');

        $responseCustomers = $this->get(route('import.template', ['type' => 'customers']));
        $responseCustomers->assertSuccessful();
        Excel::assertDownloaded('template-customers.xlsx');
    }

    public function test_can_import_products_from_csv(): void
    {
        // CSV content: creates two new products
        $csvContent = implode("\n", [
            'Barcode,SKU,Nama,Deskripsi,Kategori,Harga Beli,Harga Jual,Stok,Min Stok,Max Stok,Tipe Pajak,Tarif Pajak',
            '8991234567890,SKU-001,Indomie Goreng Original,Mi Instan Lezat,Makanan,3000,4000,75,15,150,exclusive,0',
            '8990987654321,SKU-002,Teh Botol Sosro,Minuman Teh,Minuman,2000,3500,100,20,200,exclusive,0',
        ]);

        $file = UploadedFile::fake()->createWithContent('products.csv', $csvContent);

        $response = $this->post(route('import.products'), [
            'file' => $file,
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('success');

        // Verify products and categories were created
        $this->assertDatabaseHas('categories', [
            'name' => 'Makanan',
        ]);
        $this->assertDatabaseHas('categories', [
            'name' => 'Minuman',
        ]);

        $this->assertDatabaseHas('products', [
            'barcode' => '8991234567890',
            'sku' => 'SKU-001',
            'title' => 'Indomie Goreng Original',
            'buy_price' => 3000,
            'sell_price' => 4000,
            'stock' => 75,
        ]);

        $this->assertDatabaseHas('products', [
            'barcode' => '8990987654321',
            'sku' => 'SKU-002',
            'title' => 'Teh Botol Sosro',
            'buy_price' => 2000,
            'sell_price' => 3500,
            'stock' => 100,
        ]);
    }

    public function test_import_products_rejects_duplicate_sku_in_database_and_returns_error_list(): void
    {
        $cat = Category::create([
            'name' => 'Makanan',
            'description' => 'Makanan',
            'image' => 'default.png',
        ]);

        Product::create([
            'image' => '',
            'barcode' => '8991111111111',
            'sku' => 'SKU-EXISTING-01',
            'title' => 'Produk A',
            'category_id' => $cat->id,
            'buy_price' => 1000,
            'sell_price' => 2000,
            'stock' => 10,
            'min_stock' => 0,
            'max_stock' => 0,
            'tax_type' => 'exclusive',
            'tax_rate' => 0,
        ]);

        $csvContent = implode("\n", [
            'Barcode,SKU,Nama,Deskripsi,Kategori,Harga Beli,Harga Jual,Stok,Min Stok,Max Stok,Tipe Pajak,Tarif Pajak',
            '8992222222222,SKU-EXISTING-01,Produk Duplikat SKU,Deskripsi,Makanan,1000,2000,10,0,0,exclusive,0',
        ]);

        $file = UploadedFile::fake()->createWithContent('duplicate_sku.csv', $csvContent);

        $response = $this->post(route('import.products'), [
            'file' => $file,
        ]);

        $response->assertSessionHas('error');
        $errorMessage = session('error');
        $this->assertStringContainsString('Baris 2', $errorMessage);
        $this->assertStringContainsString('SKU sudah digunakan', $errorMessage);
    }

    public function test_import_products_rejects_duplicate_barcode_in_database_and_returns_error_list(): void
    {
        $cat = Category::create([
            'name' => 'Makanan',
            'description' => 'Makanan',
            'image' => 'default.png',
        ]);

        Product::create([
            'image' => '',
            'barcode' => '8991234567890',
            'sku' => 'SKU-UNIQUE-01',
            'title' => 'Produk Barcode Lama',
            'category_id' => $cat->id,
            'buy_price' => 1000,
            'sell_price' => 2000,
            'stock' => 10,
            'min_stock' => 0,
            'max_stock' => 0,
            'tax_type' => 'exclusive',
            'tax_rate' => 0,
        ]);

        $csvContent = implode("\n", [
            'Barcode,SKU,Nama,Deskripsi,Kategori,Harga Beli,Harga Jual,Stok,Min Stok,Max Stok,Tipe Pajak,Tarif Pajak',
            '8991234567890,SKU-UNIQUE-02,Produk Barcode Sama,Deskripsi,Makanan,1000,2000,10,0,0,exclusive,0',
        ]);

        $file = UploadedFile::fake()->createWithContent('duplicate_barcode.csv', $csvContent);

        $response = $this->post(route('import.products'), [
            'file' => $file,
        ]);

        $response->assertSessionHas('error');
        $errorMessage = session('error');
        $this->assertStringContainsString('Baris 2', $errorMessage);
        $this->assertStringContainsString('Barcode sudah terdaftar', $errorMessage);
    }

    public function test_can_download_customers_export(): void
    {
        Excel::fake();

        $response = $this->get(route('export.customers'));

        $response->assertSuccessful();
        Excel::assertDownloaded('customer.xlsx');
    }

    public function test_can_import_customers_from_csv(): void
    {
        $csvContent = implode("\n", [
            'Nama,Telepon,Alamat',
            'Budi Santoso,08123456789,Jl. Mawar No. 10',
            'Siti Rahma,08987654321,Jl. Melati No. 5',
        ]);

        $file = UploadedFile::fake()->createWithContent('customers.csv', $csvContent);

        $response = $this->post(route('import.customers'), [
            'file' => $file,
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('customers', [
            'name' => 'Budi Santoso',
            'no_telp' => '08123456789',
            'address' => 'Jl. Mawar No. 10',
        ]);

        $this->assertDatabaseHas('customers', [
            'name' => 'Siti Rahma',
            'no_telp' => '08987654321',
            'address' => 'Jl. Melati No. 5',
        ]);
    }
}
