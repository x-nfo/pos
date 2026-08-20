const CACHE_NAME = 'pos-cache-v3';
const MASTER_API_PATTERNS = ['/products', '/customers', '/pricing', '/categories', '/warehouses'];

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only handle GET requests for caching
    if (event.request.method !== 'GET') {
        return;
    }

    // Master data API
    if (MASTER_API_PATTERNS.some((p) => url.pathname.includes(p))) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // If network gave error (e.g. 502 from ngrok), fallback to cache
                    if (!response.ok || response.status >= 500) {
                        return caches.match(event.request).then((cached) => cached || response);
                    }
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Static assets & Navigation HTML pages
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // If response is a 502/504 Bad Gateway from Ngrok, intercept and fallback to cached page/asset
                if (!response.ok && response.status >= 500) {
                    return caches.match(event.request).then((cached) => {
                        if (cached) return cached;
                        // If navigating, fallback to root/transactions cache if available
                        if (event.request.mode === 'navigate') {
                            return caches.match('/transactions') || caches.match('/') || response;
                        }
                        return response;
                    });
                }
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    if (event.request.mode === 'navigate') {
                        return caches.match('/transactions') || caches.match('/');
                    }
                    return new Response('Offline', { status: 503, statusText: 'Offline' });
                });
            })
    );
});
