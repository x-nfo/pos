<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

@php
    $branding = app(\App\Services\BrandingService::class)->getBranding();
    $cssVariables = app(\App\Services\BrandingService::class)->generateCssVariables();
@endphp
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
    <meta name="theme-color" content="{{ $branding['colors']['primary'] }}">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="{{ $branding['appName'] }}">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="description" content="{{ $branding['appName'] }} — {{ $branding['tagline'] }}">
    <meta property="og:site_name" content="{{ $branding['appName'] }}">
    <meta property="og:title" content="{{ $branding['appName'] }} — {{ $branding['tagline'] }}">
    <meta property="og:description" content="{{ $branding['appName'] }} — {{ $branding['tagline'] }}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="{{ config('app.url') }}/">
    <meta property="og:image" content="{{ route('og.image') }}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{ $branding['appName'] }} — {{ $branding['tagline'] }}">
    <meta name="twitter:description" content="{{ $branding['appName'] }} — {{ $branding['tagline'] }}">
    <meta name="twitter:image" content="{{ route('og.image') }}">
    
    @if($branding['favicon'])
        <link rel="icon" type="image/x-icon" href="{{ $branding['favicon'] }}?v={{ md5($branding['favicon']) }}">
        <link rel="apple-touch-icon" href="{{ $branding['favicon'] }}?v={{ md5($branding['favicon']) }}">
    @else
        <link rel="icon" type="image/x-icon" href="/favicon.ico">
    @endif
    <link rel="manifest" href="/manifest.json?v={{ md5(json_encode($branding)) }}">

    <title data-inertia>{{ $branding['appName'] }}</title>

    <!-- Fonts - Preconnect for performance -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet">

    <!-- Scripts -->
    @routes
    @viteReactRefresh
    @vite('resources/js/app.jsx')
    @inertiaHead

    <!-- Dynamic Theming CSS Variables (Highest cascade priority) -->
    <style id="branding-theme-vars">
        {!! $cssVariables !!}
    </style>

    <style>
        html,
        body {
            overflow-x: hidden;
            max-width: 100vw;
        }

        body.dark {
            background-color: rgb(2 6 23);
        }

        body.light {
            background-color: rgb(248 250 252);
        }
    </style>
</head>

<body class="font-sans antialiased bg-slate-50 transition-colors duration-200 overflow-x-hidden" onload="setInitialTheme()">

    @inertia
    <script>
        function setInitialTheme() {
            const darkMode = localStorage.getItem('darkMode') === 'true';
            if (darkMode) {
                document.body.classList.add('dark');
                document.body.classList.remove('light');
            } else {
                document.body.classList.add('light');
                document.body.classList.remove('dark');
            }
        }
    </script>
</body>

</html>
