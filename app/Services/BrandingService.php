<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Schema;

class BrandingService
{
    /**
     * Default branding configuration
     */
    public const DEFAULT_APP_NAME = 'Rekasir';

    public const DEFAULT_TAGLINE = 'Sistem Kasir & Manajemen Toko Modern';

    public const DEFAULT_PRIMARY_COLOR = '#4f46e5';

    public const DEFAULT_ACCENT_COLOR = '#06b6d4';

    /**
     * Get all branding data formatted for frontend / Inertia props
     */
    public function getBranding(): array
    {
        if (! Schema::hasTable('settings')) {
            return $this->getDefaults();
        }

        $appName = Setting::get('app_name', config('app.name', self::DEFAULT_APP_NAME));
        $logoLight = $this->resolveMediaUrl(Setting::get('app_logo_light'));
        $logoDark = $this->resolveMediaUrl(Setting::get('app_logo_dark'));
        $logoCollapsed = $this->resolveMediaUrl(Setting::get('app_logo_collapsed'));
        $favicon = $this->resolveMediaUrl(Setting::get('app_favicon'));

        $primaryColor = Setting::get('theme_primary_color', self::DEFAULT_PRIMARY_COLOR);
        $accentColor = Setting::get('theme_accent_color', self::DEFAULT_ACCENT_COLOR);

        return [
            'appName' => $appName ?: self::DEFAULT_APP_NAME,
            'tagline' => Setting::get('app_tagline', self::DEFAULT_TAGLINE),
            'logoLight' => $logoLight,
            'logoDark' => $logoDark,
            'logoCollapsed' => $logoCollapsed,
            'favicon' => $favicon,
            'colors' => [
                'primary' => $primaryColor ?: self::DEFAULT_PRIMARY_COLOR,
                'accent' => $accentColor ?: self::DEFAULT_ACCENT_COLOR,
            ],
            'footerText' => Setting::get('app_footer_text', '© '.date('Y').' '.($appName ?: self::DEFAULT_APP_NAME).'. All rights reserved.'),
            'poweredBy' => [
                'show' => (bool) Setting::get('app_powered_by_show', false),
                'text' => Setting::get('app_powered_by_text', ''),
                'url' => Setting::get('app_powered_by_url', ''),
            ],
            'landingPageMode' => Setting::get('landing_page_mode', 'public_landing'),
        ];
    }

    /**
     * Get raw settings for the admin branding form
     */
    public function getSettingsForForm(): array
    {
        return [
            'app_name' => Setting::get('app_name', config('app.name', self::DEFAULT_APP_NAME)),
            'app_tagline' => Setting::get('app_tagline', self::DEFAULT_TAGLINE),
            'app_logo_light' => Setting::get('app_logo_light', ''),
            'app_logo_dark' => Setting::get('app_logo_dark', ''),
            'app_logo_collapsed' => Setting::get('app_logo_collapsed', ''),
            'app_favicon' => Setting::get('app_favicon', ''),
            'theme_primary_color' => Setting::get('theme_primary_color', self::DEFAULT_PRIMARY_COLOR),
            'theme_accent_color' => Setting::get('theme_accent_color', self::DEFAULT_ACCENT_COLOR),
            'app_footer_text' => Setting::get('app_footer_text', '© '.date('Y').' '.self::DEFAULT_APP_NAME.'. All rights reserved.'),
            'app_powered_by_show' => (bool) Setting::get('app_powered_by_show', false),
            'app_powered_by_text' => Setting::get('app_powered_by_text', ''),
            'app_powered_by_url' => Setting::get('app_powered_by_url', ''),
            'landing_page_mode' => Setting::get('landing_page_mode', 'public_landing'),
        ];
    }

    /**
     * Generate CSS variable declarations to inject into HTML head
     */
    public function generateCssVariables(): string
    {
        $primaryHex = self::DEFAULT_PRIMARY_COLOR;
        $accentHex = self::DEFAULT_ACCENT_COLOR;

        if (Schema::hasTable('settings')) {
            $primaryHex = Setting::get('theme_primary_color', self::DEFAULT_PRIMARY_COLOR) ?: self::DEFAULT_PRIMARY_COLOR;
            $accentHex = Setting::get('theme_accent_color', self::DEFAULT_ACCENT_COLOR) ?: self::DEFAULT_ACCENT_COLOR;
        }

        $primaryShades = $this->generateRgbShades($primaryHex);
        $accentShades = $this->generateRgbShades($accentHex);

        $css = ":root, :root:root, html {\n";
        foreach ($primaryShades as $shade => $rgb) {
            $css .= "    --color-primary-{$shade}: {$rgb};\n";
        }
        foreach ($accentShades as $shade => $rgb) {
            $css .= "    --color-accent-{$shade}: {$rgb};\n";
        }
        $css .= "}\n";

        return $css;
    }

    /**
     * Helper to resolve file paths or fallback
     */
    private function resolveMediaUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        if (str_starts_with($path, '/storage/')) {
            return $path;
        }

        return '/storage/'.ltrim($path, '/');
    }

    /**
     * Fallback defaults when settings table is not ready
     */
    private function getDefaults(): array
    {
        return [
            'appName' => self::DEFAULT_APP_NAME,
            'tagline' => self::DEFAULT_TAGLINE,
            'logoLight' => null,
            'logoDark' => null,
            'logoCollapsed' => null,
            'favicon' => null,
            'colors' => [
                'primary' => self::DEFAULT_PRIMARY_COLOR,
                'accent' => self::DEFAULT_ACCENT_COLOR,
            ],
            'footerText' => '© '.date('Y').' '.self::DEFAULT_APP_NAME.'. All rights reserved.',
            'poweredBy' => [
                'show' => false,
                'text' => '',
                'url' => '',
            ],
            'landingPageMode' => 'public_landing',
        ];
    }

    /**
     * Generate 50..950 RGB color shades from a base hex color
     */
    public function generateRgbShades(string $hex): array
    {
        $hex = ltrim($hex, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
        }

        if (strlen($hex) !== 6 || ! ctype_xdigit($hex)) {
            $hex = '4f46e5';
        }

        $r = hexdec(substr($hex, 0, 2));
        $g = hexdec(substr($hex, 2, 2));
        $b = hexdec(substr($hex, 4, 2));

        // Generate tints (lighter) and shades (darker) based on 600 as base
        return [
            '50' => $this->mixRgb($r, $g, $b, 255, 255, 255, 0.92),
            '100' => $this->mixRgb($r, $g, $b, 255, 255, 255, 0.82),
            '200' => $this->mixRgb($r, $g, $b, 255, 255, 255, 0.65),
            '300' => $this->mixRgb($r, $g, $b, 255, 255, 255, 0.45),
            '400' => $this->mixRgb($r, $g, $b, 255, 255, 255, 0.22),
            '500' => $this->mixRgb($r, $g, $b, 255, 255, 255, 0.08),
            '600' => "{$r} {$g} {$b}",
            '700' => $this->mixRgb($r, $g, $b, 0, 0, 0, 0.15),
            '800' => $this->mixRgb($r, $g, $b, 0, 0, 0, 0.30),
            '900' => $this->mixRgb($r, $g, $b, 0, 0, 0, 0.48),
            '950' => $this->mixRgb($r, $g, $b, 0, 0, 0, 0.65),
        ];
    }

    private function mixRgb(int $r1, int $g1, int $b1, int $r2, int $g2, int $b2, float $weight2): string
    {
        $weight1 = 1.0 - $weight2;
        $r = (int) round($r1 * $weight1 + $r2 * $weight2);
        $g = (int) round($g1 * $weight1 + $g2 * $weight2);
        $b = (int) round($b1 * $weight1 + $b2 * $weight2);

        return "{$r} {$g} {$b}";
    }
}
