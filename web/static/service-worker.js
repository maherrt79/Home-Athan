// Service Worker for Home Athan PWA
// Basic service worker to enable PWA installability

const CACHE_NAME = 'home-athan-v1';

// Install event - cache essential files
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activated');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    // Claim all clients immediately
    return self.clients.claim();
});

// Fetch event - network-first strategy for a live application
self.addEventListener('fetch', (event) => {
    // For API calls, always go to network
    if (event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // For other requests, try network first, then cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone the response before caching
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // If network fails, try cache
                return caches.match(event.request);
            })
    );
});
