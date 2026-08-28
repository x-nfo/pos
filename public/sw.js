const CACHE_NAME = 'pos-cache-v7';
const PRECACHE_ASSETS = [
    '/manifest.json',
    '/favicon.ico',
];

const MASTER_API_PATTERNS = ['/products', '/customers', '/pricing', '/categories', '/warehouses'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS).catch(() => {
                // Silently skip if offline during install
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only handle HTTP/HTTPS GET requests
    if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
        return;
    }

    // Ignore Vite HMR and internal dev server requests
    if (
        url.pathname.startsWith('/@vite') ||
        url.pathname.startsWith('/@react-refresh') ||
        url.pathname.startsWith('/__vite_ping') ||
        url.port === '5173'
    ) {
        return;
    }

    const isStaticAsset =
        url.pathname.startsWith('/build/') ||
        url.pathname.startsWith('/images/') ||
        url.pathname.startsWith('/storage/') ||
        url.pathname === '/manifest.json' ||
        url.pathname === '/favicon.ico' ||
        url.origin.includes('fonts.googleapis.com') ||
        url.origin.includes('fonts.gstatic.com');

    // 1. Static assets & fonts: Stale-While-Revalidate / Cache-First
    if (isStaticAsset) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const networkFetch = fetch(event.request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseToCache).catch(() => {});
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => null);

                if (cachedResponse) {
                    return cachedResponse;
                }

                return networkFetch.then((res) => {
                    return res || new Response('', { status: 404, statusText: 'Not Found' });
                });
            })
        );
        return;
    }

    // 2. Master Data API: Network-First with Cache fallback
    if (MASTER_API_PATTERNS.some((p) => url.pathname.includes(p))) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache).catch(() => {});
                        });
                    } else if (!networkResponse.ok || networkResponse.status >= 500) {
                        return caches.match(event.request).then((cached) => cached || networkResponse);
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(event.request).then((cached) => {
                        return cached || new Response('[]', {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        });
                    });
                })
        );
        return;
    }

    const isInertiaRequest = event.request.headers.get('X-Inertia') === 'true';

    // 3. Inertia.js Navigation Requests (X-Inertia: true)
    if (isInertiaRequest) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache).catch(() => {});
                        });
                    } else if (!networkResponse.ok || networkResponse.status >= 500) {
                        return caches.match(event.request).then((cached) => cached || networkResponse);
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(event.request, { ignoreSearch: true }).then((cached) => {
                        if (cached) return cached;
                        // If navigating to transaction routes offline, fallback to cached POS Inertia payload
                        if (url.pathname.includes('/transactions')) {
                            return caches
                                .match('/dashboard/transactions', { ignoreSearch: true })
                                .then((fallback) => fallback || caches.match('/dashboard/transactions/mobile', { ignoreSearch: true }))
                                .then((res) => res || new Response(
                                    JSON.stringify({
                                        component: 'Dashboard/Transactions/Index',
                                        props: {},
                                        url: url.pathname,
                                    }),
                                    {
                                        status: 200,
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'X-Inertia': 'true',
                                        },
                                    }
                                ));
                        }
                        return new Response(
                            JSON.stringify({
                                component: 'Dashboard/Transactions/Index',
                                props: {},
                                url: url.pathname,
                            }),
                            {
                                status: 200,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-Inertia': 'true',
                                },
                            }
                        );
                    });
                })
        );
        return;
    }

    // 4. HTML Page Navigation (mode: 'navigate' or accept: text/html)
    const isNavigation = event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html');
    if (isNavigation) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache.clone()).catch(() => {});
                            cache.put(url.pathname, responseToCache.clone()).catch(() => {});
                            cache.put('/app-shell', responseToCache).catch(() => {});
                        });
                    } else if (!networkResponse.ok && networkResponse.status >= 500) {
                        return caches.match(event.request, { ignoreSearch: true }).then((cached) => {
                            if (cached) return cached;
                            return caches
                                .match('/dashboard/transactions', { ignoreSearch: true })
                                .then((posCached) => posCached || caches.match('/dashboard/transactions/mobile', { ignoreSearch: true }) || caches.match('/app-shell', { ignoreSearch: true }) || caches.match('/') || networkResponse);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(event.request, { ignoreSearch: true }).then((cached) => {
                        if (cached) return cached;
                        // Fallback hierarchy for HTML pages
                        return caches
                            .match('/dashboard/transactions', { ignoreSearch: true })
                            .then((posCached) => {
                                if (posCached) return posCached;
                                return caches
                                    .match('/dashboard/transactions/mobile', { ignoreSearch: true })
                                    .then((mobileCached) => {
                                        if (mobileCached) return mobileCached;
                                        return caches
                                            .match('/app-shell', { ignoreSearch: true })
                                            .then((shellCached) => {
                                                if (shellCached) return shellCached;
                                                return caches
                                                    .match('/dashboard', { ignoreSearch: true })
                                                    .then((dashCached) => dashCached || caches.match('/', { ignoreSearch: true }));
                                            });
                                    });
                            })
                            .then((finalResponse) => {
                                if (finalResponse) return finalResponse;

                                return new Response(
                                    `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mode Offline - Kasir POS</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .card { background: #1e293b; padding: 32px; border-radius: 24px; max-width: 420px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); border: 1px solid #334155; text-align: center; }
        h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #fff; }
        p { font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px; }
        .btn { display: block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 12px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; font-size: 14px; width: 100%; box-sizing: border-box; margin-bottom: 8px; }
        .btn:hover { background: #4338ca; }
        .btn-secondary { background: #334155; color: #cbd5e1; margin-bottom: 0; }
        .btn-secondary:hover { background: #475569; }
    </style>
</head>
<body>
    <div class="card">
        <div style="font-size: 48px; margin-bottom: 16px;">📶</div>
        <h1>Anda Sedang Offline</h1>
        <p>Halaman ini belum sempat tersimpan di cache lokal. Buka halaman Kasir saat terhubung ke internet agar dapat diakses sepenuhnya tanpa koneksi.</p>
        <button class="btn" onclick="window.location.href='/dashboard/transactions'">Buka Kasir POS</button>
        <button class="btn btn-secondary" onclick="window.location.reload()">Coba Muat Ulang</button>
    </div>
</body>
</html>`,
                                    {
                                        status: 200,
                                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                                    }
                                );
                            });
                    });
                })
        );
        return;
    }

    // 5. Default GET requests
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache).catch(() => {});
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request, { ignoreSearch: true }).then((cached) => {
                    return cached || new Response('', { status: 404, statusText: 'Not Found' });
                });
            })
    );
});
