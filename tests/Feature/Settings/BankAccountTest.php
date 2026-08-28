<?php

namespace Tests\Feature\Settings;

use App\Models\BankAccount;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BankAccountTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('super-admin');
    }

    public function test_admin_can_view_bank_accounts_list(): void
    {
        BankAccount::create([
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_name' => 'PT Toko Maju',
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $response = $this->actingAs($this->admin)
            ->get(route('settings.bank-accounts.index'));

        $response->assertOk();
    }

    public function test_admin_can_create_bank_account_with_logo(): void
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->image('bca_logo.png', 100, 100);

        $response = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($this->admin)
            ->post(route('settings.bank-accounts.store'), [
                'bank_name' => 'BCA',
                'account_number' => '1234567890',
                'account_name' => 'PT Toko Maju',
                'is_active' => true,
                'logo' => $file,
            ]);

        $response->assertRedirect(route('settings.bank-accounts.index'));
        $this->assertDatabaseHas('bank_accounts', [
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_name' => 'PT Toko Maju',
            'is_active' => true,
        ]);

        $bankAccount = BankAccount::where('bank_name', 'BCA')->firstOrFail();
        $this->assertNotNull($bankAccount->logo);
        Storage::disk('public')->assertExists($bankAccount->logo);

        $this->assertNotNull($bankAccount->logo_url);
        $this->assertStringContainsString('storage/bank-logos/', $bankAccount->logo_url);
    }

    public function test_admin_can_update_bank_account_and_replace_logo(): void
    {
        Storage::fake('public');

        $oldFile = UploadedFile::fake()->image('old_logo.png');
        $oldPath = $oldFile->store('bank-logos', 'public');

        $bankAccount = BankAccount::create([
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_name' => 'PT Toko Maju',
            'logo' => $oldPath,
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $newFile = UploadedFile::fake()->image('new_logo.png');

        $response = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($this->admin)
            ->put(route('settings.bank-accounts.update', $bankAccount->id), [
                'bank_name' => 'Bank Central Asia',
                'account_number' => '9876543210',
                'account_name' => 'PT Toko Maju Sejahtera',
                'is_active' => true,
                'logo' => $newFile,
            ]);

        $response->assertRedirect(route('settings.bank-accounts.index'));

        $bankAccount->refresh();
        $this->assertEquals('Bank Central Asia', $bankAccount->bank_name);
        $this->assertEquals('9876543210', $bankAccount->account_number);

        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists($bankAccount->logo);
    }

    public function test_admin_can_remove_bank_account_logo(): void
    {
        Storage::fake('public');

        $oldFile = UploadedFile::fake()->image('bca_logo.png');
        $oldPath = $oldFile->store('bank-logos', 'public');

        $bankAccount = BankAccount::create([
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_name' => 'PT Toko Maju',
            'logo' => $oldPath,
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $response = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($this->admin)
            ->put(route('settings.bank-accounts.update', $bankAccount->id), [
                'bank_name' => 'BCA',
                'account_number' => '1234567890',
                'account_name' => 'PT Toko Maju',
                'is_active' => true,
                'remove_logo' => true,
            ]);

        $response->assertRedirect(route('settings.bank-accounts.index'));

        $bankAccount->refresh();
        $this->assertNull($bankAccount->logo);
        $this->assertNull($bankAccount->logo_url);
        Storage::disk('public')->assertMissing($oldPath);
    }

    public function test_admin_can_toggle_bank_account_status(): void
    {
        $bankAccount = BankAccount::create([
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_name' => 'PT Toko Maju',
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $response = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($this->admin)
            ->patch(route('settings.bank-accounts.toggle', $bankAccount->id));

        $response->assertRedirect(route('settings.bank-accounts.index'));
        $this->assertFalse($bankAccount->fresh()->is_active);
    }

    public function test_admin_can_delete_bank_account(): void
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->image('bca.png');
        $path = $file->store('bank-logos', 'public');

        $bankAccount = BankAccount::create([
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_name' => 'PT Toko Maju',
            'logo' => $path,
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $response = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($this->admin)
            ->delete(route('settings.bank-accounts.destroy', $bankAccount->id));

        $response->assertRedirect(route('settings.bank-accounts.index'));
        $this->assertDatabaseMissing('bank_accounts', ['id' => $bankAccount->id]);
        Storage::disk('public')->assertMissing($path);
    }
}
