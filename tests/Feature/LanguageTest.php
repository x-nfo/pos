<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LanguageTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_switch_language(): void
    {
        $response = $this->post('/language/switch', [
            'locale' => 'en',
        ]);

        $response->assertSessionHas('locale', 'en');
        $response->assertCookie('locale', 'en');
    }

    public function test_authenticated_user_can_switch_language(): void
    {
        $user = User::factory()->create(['locale' => 'id']);

        $response = $this->actingAs($user)->post('/language/switch', [
            'locale' => 'en',
        ]);

        $response->assertSessionHas('locale', 'en');
        $response->assertCookie('locale', 'en');
        $this->assertEquals('en', $user->fresh()->locale);
    }

    public function test_invalid_locale_returns_validation_error(): void
    {
        $response = $this->post('/language/switch', [
            'locale' => 'fr',
        ]);

        $response->assertSessionHasErrors('locale');
    }

    public function test_set_locale_middleware_applies_locale_from_user(): void
    {
        $user = User::factory()->create(['locale' => 'en']);

        $response = $this->actingAs($user)->get('/dashboard');

        $this->assertEquals('en', app()->getLocale());
    }
}
