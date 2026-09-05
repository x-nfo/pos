<?php

namespace Tests\Feature\Settings;

use App\Models\Category;
use App\Models\PromoBanner;
use App\Models\Setting;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PromoBannerTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([PermissionSeeder::class, RoleSeeder::class, UserSeeder::class]);
        $this->admin = User::role('super-admin')->first() ?? User::where('email', 'admin@mail.com')->first();
        $this->admin->markEmailAsVerified();
        $this->actingAs($this->admin);

        Storage::fake('public');
    }

    public function test_admin_can_upload_and_create_promo_banner(): void
    {
        $category = Category::create(['name' => 'Minuman']);
        $file = UploadedFile::fake()->image('promo-hero.jpg', 1200, 450);

        $response = $this->post(route('settings.promo-banners.store'), [
            'title' => 'Promo Gantung Gajian',
            'subtitle' => 'Periode 1 - 7 September 2026',
            'image' => $file,
            'link_url' => 'https://wa.me/62812345678',
            'category_id' => $category->id,
            'sort_order' => 1,
            'is_active' => true,
        ]);

        $response->assertSessionHas('success');

        $banner = PromoBanner::first();
        $this->assertNotNull($banner);
        $this->assertSame('Promo Gantung Gajian', $banner->title);
        $this->assertSame('Periode 1 - 7 September 2026', $banner->subtitle);
        $this->assertSame($category->id, $banner->category_id);
        $this->assertTrue($banner->is_active);
        $this->assertSame(1, $banner->sort_order);

        Storage::disk('public')->assertExists($banner->image);
    }

    public function test_admin_can_update_promo_banner_details_and_image(): void
    {
        $oldFile = UploadedFile::fake()->image('old-banner.jpg', 800, 300);
        $oldPath = $oldFile->store('banners', 'public');

        $banner = PromoBanner::create([
            'title' => 'Promo Lama',
            'image' => $oldPath,
            'sort_order' => 0,
            'is_active' => true,
        ]);

        $newFile = UploadedFile::fake()->image('new-banner.png', 1200, 450);

        $response = $this->post(route('settings.promo-banners.update', $banner->id), [
            'title' => 'Promo Kemerdekaan Baru',
            'subtitle' => 'Diskon s.d 45%',
            'image' => $newFile,
            'sort_order' => 2,
            'is_active' => false,
        ]);

        $response->assertSessionHas('success');
        $banner->refresh();

        $this->assertSame('Promo Kemerdekaan Baru', $banner->title);
        $this->assertSame('Diskon s.d 45%', $banner->subtitle);
        $this->assertSame(2, $banner->sort_order);
        $this->assertFalse($banner->is_active);

        // Old file deleted, new file exists
        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists($banner->image);
    }

    public function test_admin_can_toggle_active_status(): void
    {
        $banner = PromoBanner::create([
            'title' => 'Promo Flash Sale',
            'image' => 'banners/dummy.jpg',
            'is_active' => true,
        ]);

        $this->patch(route('settings.promo-banners.toggle', $banner->id))
            ->assertSessionHas('success');

        $banner->refresh();
        $this->assertFalse($banner->is_active);

        $this->patch(route('settings.promo-banners.toggle', $banner->id))
            ->assertSessionHas('success');

        $banner->refresh();
        $this->assertTrue($banner->is_active);
    }

    public function test_admin_can_update_banner_orders(): void
    {
        $b1 = PromoBanner::create(['title' => 'B1', 'image' => 'b1.jpg', 'sort_order' => 0]);
        $b2 = PromoBanner::create(['title' => 'B2', 'image' => 'b2.jpg', 'sort_order' => 1]);

        $response = $this->post(route('settings.promo-banners.order'), [
            'orders' => [
                ['id' => $b1->id, 'sort_order' => 10],
                ['id' => $b2->id, 'sort_order' => 5],
            ],
        ]);

        $response->assertSessionHas('success');
        $this->assertSame(10, $b1->fresh()->sort_order);
        $this->assertSame(5, $b2->fresh()->sort_order);
    }

    public function test_admin_can_delete_promo_banner_and_file_is_removed(): void
    {
        $file = UploadedFile::fake()->image('delete-me.jpg');
        $path = $file->store('banners', 'public');

        $banner = PromoBanner::create([
            'title' => 'Akan Dihapus',
            'image' => $path,
        ]);

        Storage::disk('public')->assertExists($path);

        $this->delete(route('settings.promo-banners.destroy', $banner->id))
            ->assertSessionHas('success');

        $this->assertDatabaseMissing('promo_banners', ['id' => $banner->id]);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_store_settings_identity_provides_promo_banners_list(): void
    {
        PromoBanner::create([
            'title' => 'Banner Toko 1',
            'image' => 'banners/toko1.jpg',
            'is_active' => true,
        ]);

        $response = $this->get(route('settings.store'));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Settings/StoreIdentity')
            ->has('promoBanners', 1)
            ->where('promoBanners.0.title', 'Banner Toko 1')
            ->has('categories')
            ->where('settings.static_banner_enabled', true)
        );
    }

    public function test_admin_can_update_static_banner_settings(): void
    {
        $response = $this->post(route('settings.static-banner.update'), [
            'static_banner_enabled' => true,
            'static_banner_badge' => 'SUPER DISKON',
            'static_banner_title' => 'Promo Spesial Payday',
            'static_banner_subtitle' => 'Gratis ongkir untuk seluruh pemesanan',
            'static_banner_action_text' => 'Beli Sekarang',
            'static_banner_link_url' => 'https://example.com/promo',
        ]);

        $response->assertSessionHas('success');

        $this->assertTrue(Setting::getBool('static_banner_enabled'));
        $this->assertSame('SUPER DISKON', Setting::get('static_banner_badge'));
        $this->assertSame('Promo Spesial Payday', Setting::get('static_banner_title'));
        $this->assertSame('Gratis ongkir untuk seluruh pemesanan', Setting::get('static_banner_subtitle'));
        $this->assertSame('Beli Sekarang', Setting::get('static_banner_action_text'));
        $this->assertSame('https://example.com/promo', Setting::get('static_banner_link_url'));
    }
}
