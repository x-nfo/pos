<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Services\Auth\LandingPageResolverService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LandingPageResolutionTest extends TestCase
{
    use RefreshDatabase;

    private LandingPageResolverService $resolver;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $this->resolver = app(LandingPageResolverService::class);
    }

    public function test_super_admin_resolves_to_dashboard(): void
    {
        $user = User::factory()->create();
        $user->assignRole('super-admin');

        $this->assertSame('dashboard', $this->resolver->resolveRouteName($user));
        $this->assertSame(route('dashboard', absolute: false), $this->resolver->resolveUrl($user));
    }

    public function test_store_manager_resolves_to_dashboard(): void
    {
        $user = User::factory()->create();
        $user->assignRole('store-manager');

        $this->assertSame('dashboard', $this->resolver->resolveRouteName($user));
    }

    public function test_cashier_resolves_to_pos_transactions(): void
    {
        $user = User::factory()->create();
        $user->assignRole('cashier');

        $this->assertSame('transactions.index', $this->resolver->resolveRouteName($user));
    }

    public function test_kitchen_staff_resolves_to_dine_orders(): void
    {
        $user = User::factory()->create();
        $user->assignRole('kitchen-staff');

        $this->assertSame('dine-orders.index', $this->resolver->resolveRouteName($user));
    }

    public function test_warehouse_staff_resolves_to_goods_receivings(): void
    {
        $user = User::factory()->create();
        $user->assignRole('warehouse-staff');

        $this->assertSame('goods-receivings.index', $this->resolver->resolveRouteName($user));
    }

    public function test_finance_staff_resolves_to_receivables(): void
    {
        $user = User::factory()->create();
        $user->assignRole('finance-staff');

        $this->assertSame('receivables.index', $this->resolver->resolveRouteName($user));
    }

    public function test_user_without_permissions_resolves_to_access_hub(): void
    {
        $user = User::factory()->create();

        $this->assertSame('dashboard.access', $this->resolver->resolveRouteName($user));
    }

    public function test_cashier_login_redirects_directly_to_pos(): void
    {
        $user = User::factory()->create([
            'email' => 'cashier.test@example.com',
            'password' => bcrypt('password123'),
        ]);
        $user->assignRole('cashier');

        $response = $this->post('/login', [
            'email' => 'cashier.test@example.com',
            'password' => 'password123',
        ] + $this->botGuardPayload());

        $this->assertAuthenticated();
        $response->assertRedirect(route('transactions.index', absolute: false));
    }

    public function test_admin_login_redirects_directly_to_dashboard(): void
    {
        $user = User::factory()->create([
            'email' => 'admin.test@example.com',
            'password' => bcrypt('password123'),
        ]);
        $user->assignRole('super-admin');

        $response = $this->post('/login', [
            'email' => 'admin.test@example.com',
            'password' => 'password123',
        ] + $this->botGuardPayload());

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));
    }
}
