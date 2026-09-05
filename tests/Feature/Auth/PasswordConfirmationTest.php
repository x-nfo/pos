<?php

namespace Tests\Feature\Auth;

use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class PasswordConfirmationTest extends TestCase
{
    use RefreshDatabase;

    public function test_confirm_password_screen_can_be_rendered(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get('/confirm-password');

        $response->assertStatus(200);
    }

    public function test_password_can_be_confirmed(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/confirm-password', [
            'password' => 'password',
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
    }

    public function test_password_is_not_confirmed_with_invalid_password(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/confirm-password', [
            'password' => 'wrong-password',
        ]);

        $response->assertSessionHasErrors();
    }

    public function test_sensitive_routes_redirect_to_confirm_password_when_recent_confirmation_is_missing(): void
    {
        $user = User::factory()->create();
        Permission::firstOrCreate(['name' => 'transactions-confirm-payment', 'guard_name' => 'web']);
        $user->givePermissionTo('transactions-confirm-payment');

        $transaction = Transaction::create([
            'warehouse_id' => Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id,
            'cashier_id' => $user->id,
            'invoice' => 'TRX-CONFIRM',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'shipping_cost' => 0,
            'grand_total' => 10000,
            'payment_method' => 'bank_transfer',
            'payment_status' => 'pending',
        ]);

        $response = $this
            ->actingAs($user)
            ->from(route('transactions.history'))
            ->patch(route('transactions.confirm-payment', $transaction));

        $response->assertRedirect(route('password.confirm'));
    }

    public function test_password_can_be_confirmed_via_json_request(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/confirm-password', [
                'password' => 'password',
            ]);

        $response->assertOk();
        $response->assertJson([
            'success' => true,
        ]);
        $response->assertJsonStructure(['success', 'message', 'step_up_fresh_until']);
    }

    public function test_password_confirmation_fails_via_json_with_invalid_password(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/confirm-password', [
                'password' => 'wrong-password',
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
    }

    public function test_sensitive_routes_return_423_when_requested_via_json(): void
    {
        $user = User::factory()->create();
        Permission::firstOrCreate(['name' => 'transactions-confirm-payment', 'guard_name' => 'web']);
        $user->givePermissionTo('transactions-confirm-payment');

        $transaction = Transaction::create([
            'warehouse_id' => Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id,
            'cashier_id' => $user->id,
            'invoice' => 'TRX-CONFIRM-JSON',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'shipping_cost' => 0,
            'grand_total' => 10000,
            'payment_method' => 'bank_transfer',
            'payment_status' => 'pending',
        ]);

        $response = $this
            ->actingAs($user)
            ->patchJson(route('transactions.confirm-payment', $transaction));

        $response->assertStatus(423);
        $response->assertJson([
            'password_confirmation_required' => true,
        ]);
    }
}
