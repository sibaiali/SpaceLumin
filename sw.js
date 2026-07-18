/**
 * Service Worker for Lumin Flow: Utopia Run
 * Enables offline play and caching for PWA/TWA
 */

const CACHE_NAME = 'lumin-flow-v1.0.0';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/manifest.json',
    '/js/AudioSystem.js',
    '/js/Bullet.js',
    '/js/Collectible.js',
    '/js/DifficultySystem.js',
    '/js/Director.js',
    '/js/Enemy.js',
    '/js/Game.js',
    '/js/InputHandler.js',
    '/js/LabelSystem.js',
    '/js/LaserWeapon.js',
    '/js/MetaSystem.js',
    '/js/MobileControls.js',
    '/js/Node.js',
    '/js/Player.js',
    '/js/SingularitySequence.js',
    '/js/SpawnBudget.js',
    '/js/UIController.js',
    '/js/World3D.js'
];

// External CDN resources (cache on first use)
const CDN_RESOURCES = [
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js',
    'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;600;700&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Handle CDN resources with stale-while-revalidate
    if (CDN_RESOURCES.some(cdn => event.request.url.includes(cdn.split('/')[2]))) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        if (networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => cachedResponse);

                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // Handle local assets - cache first
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request).then((networkResponse) => {
                    // Cache successful responses
                    if (networkResponse.ok && url.origin === self.location.origin) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                });
            })
            .catch(() => {
                // Offline fallback for navigation
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            })
    );
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
