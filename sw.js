// ================================================================
// sw.js - Service Worker para caché offline de AstroChat
// ================================================================

const CACHE_NAME = 'astrochat-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Cacheando assets...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activación y limpieza de cachés antiguos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Eliminando caché antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Interceptar peticiones
self.addEventListener('fetch', event => {
    // Intentar servir desde caché, si falla, ir a la red
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).catch(() => {
                    // Si offline y no está en caché, devolver una respuesta de fallback
                    return new Response('Contenido no disponible offline.', {
                        status: 503,
                        statusText: 'Service Unavailable'
                    });
                });
            })
    );
});
