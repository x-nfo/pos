<?php

namespace App\Http\Controllers;

use App\Services\BrandingService;
use Illuminate\Http\Request;

class OgImageController extends Controller
{
    public function show(Request $request)
    {
        $branding = app(BrandingService::class)->getBranding();

        $appName = $branding['appName'] ?? 'Rekasir';
        $tagline = $branding['tagline'] ?? 'Sistem Kasir & Manajemen Toko Modern';
        $primaryHex = $branding['colors']['primary'] ?? '#4f46e5';

        // Parse primary hex color
        $hex = ltrim($primaryHex, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
        }
        if (strlen($hex) !== 6 || ! ctype_xdigit($hex)) {
            $hex = '4f46e5';
        }

        $r1 = hexdec(substr($hex, 0, 2));
        $g1 = hexdec(substr($hex, 2, 2));
        $b1 = hexdec(substr($hex, 4, 2));

        $r2 = (int) max(0, $r1 * 0.65);
        $g2 = (int) max(0, $g1 * 0.65);
        $b2 = (int) max(0, $b1 * 0.65);

        $width = 1200;
        $height = 630;

        $img = imagecreatetruecolor($width, $height);

        // Draw linear gradient background
        for ($y = 0; $y < $height; $y++) {
            $factor = $y / $height;
            $r = (int) ($r1 + ($r2 - $r1) * $factor);
            $g = (int) ($g1 + ($g2 - $g1) * $factor);
            $b = (int) ($b1 + ($b2 - $b1) * $factor);

            $color = imagecolorallocate($img, $r, $g, $b);
            imageline($img, 0, $y, $width, $y, $color);
        }

        $white = imagecolorallocate($img, 255, 255, 255);
        $subColor = imagecolorallocate($img, 224, 231, 255);

        // Try loading uploaded logo
        $logoLoaded = false;
        $logoPath = $this->resolveLocalLogoPath($branding['logoLight'] ?? $branding['logoDark'] ?? null);

        if ($logoPath && file_exists($logoPath)) {
            $logoLoaded = $this->drawCustomLogo($img, $logoPath, 90, 160, 200, 200);
        }

        // Fallback: draw clean POS Cashier / Store icon if no custom logo loaded
        if (! $logoLoaded) {
            $this->drawPosIcon($img, 100, 160, 200, 200, $white);
        }

        // Font discovery
        $fontBold = $this->findFont(['DejaVuSans-Bold.ttf', 'Ubuntu-B.ttf', 'LiberationSans-Bold.ttf', 'Lato-Bold.ttf']);
        $fontRegular = $this->findFont(['DejaVuSans.ttf', 'Ubuntu-R.ttf', 'LiberationSans-Regular.ttf', 'Lato-Regular.ttf']);

        $textX = 350;

        if ($fontBold) {
            // App Name
            imagettftext($img, 56, 0, $textX, 260, $white, $fontBold, $appName);
        } else {
            imagestring($img, 5, $textX, 240, $appName, $white);
        }

        if ($fontRegular) {
            // Tagline
            imagettftext($img, 24, 0, $textX, 330, $subColor, $fontRegular, $tagline);
            // Features badge
            imagettftext($img, 18, 0, $textX, 390, $subColor, $fontRegular, 'Point of Sale · Multi-Warehouse · CRM & Loyalty');
        } else {
            imagestring($img, 4, $textX, 310, $tagline, $subColor);
        }

        ob_start();
        imagepng($img);
        $pngData = ob_get_clean();
        imagedestroy($img);

        return response($pngData, 200, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    private function resolveLocalLogoPath(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        if (str_contains($url, '/storage/')) {
            $relativePath = ltrim(parse_url($url, PHP_URL_PATH), '/');
            $relativePath = preg_replace('#^storage/#', '', $relativePath);
            return storage_path('app/public/'.$relativePath);
        }

        return public_path(ltrim(parse_url($url, PHP_URL_PATH), '/'));
    }

    private function drawCustomLogo($canvas, string $path, int $x, int $y, int $maxW, int $maxH): bool
    {
        $info = @getimagesize($path);
        if (! $info) {
            return false;
        }

        $type = $info[2];
        $src = match ($type) {
            IMAGETYPE_PNG => @imagecreatefrompng($path),
            IMAGETYPE_JPEG => @imagecreatefromjpeg($path),
            IMAGETYPE_WEBP => @imagecreatefromwebp($path),
            default => null,
        };

        if (! $src) {
            return false;
        }

        $srcW = imagesx($src);
        $srcH = imagesy($src);

        $scale = min($maxW / $srcW, $maxH / $srcH);
        $dstW = (int) ($srcW * $scale);
        $dstH = (int) ($srcH * $scale);

        $dstX = $x + (int) (($maxW - $dstW) / 2);
        $dstY = $y + (int) (($maxH - $dstH) / 2);

        imagecopyresampled($canvas, $src, $dstX, $dstY, 0, 0, $dstW, $dstH, $srcW, $srcH);
        imagedestroy($src);

        return true;
    }

    private function drawPosIcon($canvas, int $x, int $y, int $w, int $h, int $color)
    {
        imagesetthickness($canvas, 8);

        // Store Front Roof / Canopy
        imagepolygon($canvas, [
            $x + (int)($w * 0.1), $y + (int)($h * 0.4),
            $x + (int)($w * 0.5), $y + (int)($h * 0.15),
            $x + (int)($w * 0.9), $y + (int)($h * 0.4),
        ], 3, $color);

        // Cash register body
        imagerectangle(
            $canvas,
            $x + (int)($w * 0.15),
            $y + (int)($h * 0.45),
            $x + (int)($w * 0.85),
            $y + (int)($h * 0.85),
            $color
        );

        // Screen
        imagerectangle(
            $canvas,
            $x + (int)($w * 0.25),
            $y + (int)($h * 0.52),
            $x + (int)($w * 0.75),
            $y + (int)($h * 0.68),
            $color
        );

        // Cash drawer line
        imageline(
            $canvas,
            $x + (int)($w * 0.15),
            $y + (int)($h * 0.75),
            $x + (int)($w * 0.85),
            $y + (int)($h * 0.75),
            $color
        );
    }

    private function findFont(array $candidates): ?string
    {
        $dirs = [
            '/usr/share/fonts/truetype/dejavu/',
            '/usr/share/fonts/truetype/ubuntu/',
            '/usr/share/fonts/truetype/liberation/',
            '/usr/share/fonts/truetype/lato/',
        ];

        foreach ($dirs as $dir) {
            foreach ($candidates as $name) {
                if (file_exists($dir.$name)) {
                    return $dir.$name;
                }
            }
        }

        return null;
    }
}
