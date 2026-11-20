<?php

namespace Tests\Feature\Products;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ProductGalleryImageTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $role = Role::findOrCreate('admin', 'web');
        $role->syncPermissions([
            Permission::findOrCreate('products-access', 'web'),
            Permission::findOrCreate('products-create', 'web'),
            Permission::findOrCreate('products-edit', 'web'),
            Permission::findOrCreate('products-delete', 'web'),
        ]);

        $this->admin = User::factory()->create();
        $this->admin->assignRole($role);

        Warehouse::create([
            'name' => 'Toko Pusat',
            'code' => 'PST',
            'type' => 'main',
            'is_active' => true,
        ]);

        $this->category = Category::create([
            'name' => 'Fashion Wanita',
            'image' => 'categories/fashion.png',
            'description' => 'Kategori Pakaian Fashion Wanita',
        ]);
    }

    public function test_product_model_gallery_images_accessor_and_mutator(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'title' => 'Gamis Silk Floral',
            'barcode' => 'ART-GMS-001',
            'sku' => 'ART-GMS-001',
            'buy_price' => 100000,
            'sell_price' => 220000,
            'tax_rate' => 0,
            'gallery_images' => ['gamis_depan.jpg', 'gamis_belakang.jpg'],
        ]);

        // Raw original is JSON string of clean filenames
        $raw = $product->getRawOriginal('gallery_images');
        $this->assertIsString($raw);
        $decoded = json_decode($raw, true);
        $this->assertCount(2, $decoded);
        $this->assertEquals(['gamis_depan.jpg', 'gamis_belakang.jpg'], $decoded);

        // Accessor provides array of storage URLs
        $this->assertIsArray($product->gallery_images);
        $this->assertCount(2, $product->gallery_images);
        $this->assertStringContainsString('storage/products/gamis_depan.jpg', $product->gallery_images[0]);
        $this->assertStringContainsString('storage/products/gamis_belakang.jpg', $product->gallery_images[1]);
    }

    public function test_can_create_product_with_multiple_gallery_images(): void
    {
        $cover = UploadedFile::fake()->image('cover.jpg', 600, 600);
        $frontAngle = UploadedFile::fake()->image('front.jpg', 600, 600);
        $backAngle = UploadedFile::fake()->image('back.jpg', 600, 600);
        $detailAngle = UploadedFile::fake()->image('detail.jpg', 600, 600);

        $response = $this->actingAs($this->admin)->post(route('products.store'), [
            'category_id' => $this->category->id,
            'title' => 'Blouse Satin Premium',
            'barcode' => 'BLS-STN-001',
            'sku' => 'BLS-STN-001',
            'buy_price' => 75000,
            'sell_price' => 150000,
            'stock' => 20,
            'image' => $cover,
            'gallery_images' => [
                $frontAngle,
                $backAngle,
                $detailAngle,
            ],
        ]);

        $response->assertRedirect(route('products.index'));

        $product = Product::where('sku', 'BLS-STN-001')->firstOrFail();

        $this->assertNotNull($product->image);
        Storage::disk('local')->assertExists('public/products/'.basename($product->image));

        // Check gallery images
        $this->assertIsArray($product->gallery_images);
        $this->assertCount(3, $product->gallery_images);

        $rawGallery = json_decode($product->getRawOriginal('gallery_images'), true);
        $this->assertCount(3, $rawGallery);
        foreach ($rawGallery as $filename) {
            Storage::disk('local')->assertExists('public/products/'.$filename);
        }
    }

    public function test_can_update_product_gallery_images(): void
    {
        $cover = UploadedFile::fake()->image('cover.jpg');
        $img1 = UploadedFile::fake()->image('angle1.jpg');
        $img2 = UploadedFile::fake()->image('angle2.jpg');

        $this->actingAs($this->admin)->post(route('products.store'), [
            'category_id' => $this->category->id,
            'title' => 'Kemeja Katun Rayon',
            'barcode' => 'KMJ-001',
            'sku' => 'KMJ-001',
            'buy_price' => 60000,
            'sell_price' => 120000,
            'stock' => 10,
            'image' => $cover,
            'gallery_images' => [$img1, $img2],
        ]);

        $product = Product::where('sku', 'KMJ-001')->firstOrFail();
        $initialRawGallery = json_decode($product->getRawOriginal('gallery_images'), true);
        $this->assertCount(2, $initialRawGallery);

        $keptExisting = $initialRawGallery[0]; // keep only first
        $removedExisting = $initialRawGallery[1]; // remove second

        $newAngle = UploadedFile::fake()->image('angle_new.jpg');

        $response = $this->actingAs($this->admin)->post(route('products.update', $product->id), [
            '_method' => 'PUT',
            'category_id' => $this->category->id,
            'title' => 'Kemeja Katun Rayon (Updated)',
            'barcode' => 'KMJ-001',
            'sku' => 'KMJ-001',
            'buy_price' => 65000,
            'sell_price' => 130000,
            'existing_gallery_images' => [$keptExisting],
            'gallery_images' => [$newAngle],
        ]);

        $response->assertRedirect(route('products.index'));

        $product->refresh();
        $updatedRawGallery = json_decode($product->getRawOriginal('gallery_images'), true);

        $this->assertCount(2, $updatedRawGallery);
        $this->assertEquals($keptExisting, $updatedRawGallery[0]);

        // Kept image still exists
        Storage::disk('local')->assertExists('public/products/'.$keptExisting);
        // Newly uploaded image exists
        Storage::disk('local')->assertExists('public/products/'.$updatedRawGallery[1]);
        // Removed image was cleaned up
        Storage::disk('local')->assertMissing('public/products/'.$removedExisting);
    }

    public function test_public_catalog_detail_includes_gallery_images(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'title' => 'Tunik Plisket Exclusive',
            'barcode' => 'TNK-PLS-001',
            'sku' => 'TNK-PLS-001',
            'image' => 'products/cover_tunik.jpg',
            'gallery_images' => ['tunik_depan.jpg', 'tunik_belakang.jpg'],
            'buy_price' => 80000,
            'sell_price' => 175000,
            'tax_rate' => 0,
            'stock' => 15,
        ]);

        $response = $this->get(route('catalog.product.show', $product->id));
        $response->assertOk();

        $response->assertInertia(fn ($page) => $page
            ->component('Public/ProductDetail')
            ->has('product.gallery_images', 3) // cover + 2 gallery images
            ->where('product.title', 'Tunik Plisket Exclusive')
        );
    }

    public function test_deleting_product_cleans_up_gallery_images(): void
    {
        $cover = UploadedFile::fake()->image('cover.jpg');
        $front = UploadedFile::fake()->image('front.jpg');

        $this->actingAs($this->admin)->post(route('products.store'), [
            'category_id' => $this->category->id,
            'title' => 'Rok Span Rajut',
            'barcode' => 'ROK-001',
            'sku' => 'ROK-001',
            'buy_price' => 45000,
            'sell_price' => 95000,
            'stock' => 5,
            'image' => $cover,
            'gallery_images' => [$front],
        ]);

        $product = Product::where('sku', 'ROK-001')->firstOrFail();
        $coverFile = basename($product->image);
        $rawGallery = json_decode($product->getRawOriginal('gallery_images'), true);
        $galleryFile = $rawGallery[0];

        Storage::disk('local')->assertExists('public/products/'.$coverFile);
        Storage::disk('local')->assertExists('public/products/'.$galleryFile);

        $deleteResponse = $this->actingAs($this->admin)
            ->from(route('products.index'))
            ->delete(route('products.destroy', $product->id));
        $deleteResponse->assertRedirect(route('products.index'));

        Storage::disk('local')->assertMissing('public/products/'.$coverFile);
        Storage::disk('local')->assertMissing('public/products/'.$galleryFile);
    }
}
