<?php

namespace Tests\Feature\Categories;

use App\Models\Category;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CategoryQuickStoreTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([PermissionSeeder::class, RoleSeeder::class, UserSeeder::class]);
        $this->user = User::role('super-admin')->first() ?? User::where('email', 'admin@mail.com')->first() ?? User::first();
        $this->user->markEmailAsVerified();
        $this->actingAs($this->user);
    }

    public function test_authorized_user_can_quick_store_category(): void
    {
        Storage::fake('public');

        $payload = [
            'name' => 'Kategori Cepat Baru',
            'description' => 'Deskripsi kategori dibuat langsung dari form produk',
            'image' => UploadedFile::fake()->image('kategori.png'),
        ];

        $response = $this->postJson(route('categories.quick-store'), $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Kategori berhasil ditambahkan.',
                'data' => [
                    'name' => 'Kategori Cepat Baru',
                    'description' => 'Deskripsi kategori dibuat langsung dari form produk',
                ],
            ]);

        $this->assertDatabaseHas('categories', [
            'name' => 'Kategori Cepat Baru',
            'description' => 'Deskripsi kategori dibuat langsung dari form produk',
        ]);
    }

    public function test_quick_store_validates_required_and_unique_name(): void
    {
        Category::create([
            'name' => 'Minuman',
            'description' => 'Kategori Minuman',
        ]);

        // 1. Missing name
        $response = $this->postJson(route('categories.quick-store'), [
            'description' => 'Tanpa nama',
        ]);
        $response->assertStatus(422)->assertJsonValidationErrors(['name']);

        // 2. Duplicate name
        $response = $this->postJson(route('categories.quick-store'), [
            'name' => 'Minuman',
            'description' => 'Duplikat nama',
        ]);
        $response->assertStatus(422)->assertJsonValidationErrors(['name']);
    }
}
