/**
 * Service Worker for Lumin Flow: Utopia Run
 * Enables offline play and caching for PWA/TWA with Network-First freshness
 */

const CACHE_NAME = 'lumin-flow-v4.5.0-eu-de-cyber-studio';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/manifest.json',
    '/favicon.ico',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/lib/three.min.js',
    '/lib/Tone.js',
    '/js/SymbolBadges.js',
    '/js/PlanetAtlas.js',
    '/js/DataScreeningService.js',
    '/js/CopyrightGuard.js',
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
    '/js/MonetizationSystem.js',
    '/js/Node.js',
    '/js/Player.js',
    '/js/SingularitySequence.js',
    '/js/SpawnBudget.js',
    '/js/UIController.js',
    '/js/WeaponEvolution.js',
    '/js/World3D.js',
    '/js/NystromKernel.js',
    '/js/KernelMapper.js',
    '/js/NeuroFlowController.js',
    '/js/CognitiveOverloadDetector.js',
    '/js/GhostConsole.js',
    '/js/EnemyDNA.js',
    '/js/EnemyPool.js',
    '/js/TelemetryService.js',
    '/js/PredictiveAI.js',
    '/js/PredictionEvaluationAdapter.js',
    '/js/PredictionDebugOverlay.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .catch(() => {})
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);

    // Network-first with cache fallback so updates appear immediately
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse.ok && url.origin === self.location.origin) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
