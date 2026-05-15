// service-worker.js - Yeni dosya

const CACHE_NAME = 'physio-tracker-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/login.html',
    '/style.css',
    '/app.js',
    '/manifest.json'
];

// Install
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});

// Fetch
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});

// Offline desteği
self.addEventListener('fetch', (event) => {
    if (!navigator.onLine) {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    return response || new Response('Offline - İnternet bağlantınızı kontrol edin');
                })
        );
    }
});