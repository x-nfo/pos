<?php

namespace App\Http\Controllers;

use App\Services\BrandingService;
use Illuminate\Http\JsonResponse;

class ManifestController extends Controller
{
    public function __invoke(BrandingService $brandingService): JsonResponse
    {
        $branding = $brandingService->getBranding();
        $appName = $branding['appName'];
        $shortName = mb_substr($appName, 0, 12);

        $icon192 = $branding['logoCollapsed'] ?: $branding['favicon'] ?: '/images/icon-192.png';
        $icon512 = $branding['logoLight'] ?: '/images/icon-512.png';

        $manifest = [
            'name' => $appName,
            'short_name' => $shortName,
            'description' => $branding['tagline'],
            'start_url' => '/dashboard/transactions',
            'scope' => '/',
            'display' => 'standalone',
            'background_color' => '#ffffff',
            'theme_color' => $branding['colors']['primary'],
            'orientation' => 'any',
            'icons' => [
                [
                    'src' => $icon192,
                    'sizes' => '192x192',
                    'type' => 'image/png',
                ],
                [
                    'src' => $icon512,
                    'sizes' => '512x512',
                    'type' => 'image/png',
                ],
            ],
            'shortcuts' => [
                [
                    'name' => 'Kasir POS',
                    'short_name' => 'Kasir',
                    'description' => 'Buka antarmuka kasir POS',
                    'url' => '/dashboard/transactions',
                    'icons' => [
                        [
                            'src' => $icon192,
                            'sizes' => '192x192',
                        ],
                    ],
                ],
                [
                    'name' => 'Mobile POS',
                    'short_name' => 'Mobile POS',
                    'description' => 'Buka kasir versi layar sentuh/handheld',
                    'url' => '/dashboard/transactions/mobile',
                    'icons' => [
                        [
                            'src' => $icon192,
                            'sizes' => '192x192',
                        ],
                    ],
                ],
            ],
            'categories' => ['business', 'finance'],
            'lang' => 'id-ID',
        ];

        return response()->json($manifest, 200, [
            'Content-Type' => 'application/manifest+json',
        ]);
    }
}
