<?php

namespace Tests\Feature\Branding;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OgImageTest extends TestCase
{
    use RefreshDatabase;

    public function test_og_image_returns_png_image()
    {
        $response = $this->get(route('og.image'));

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'image/png');
    }
}
