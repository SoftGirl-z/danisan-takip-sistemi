// service-worker.js — Stulio PWA

const CACHE_NAME = 'stulio-v1';
const urlsToCache = [
    './',
    './index.html',
    './login.html',
    './landing.html',
    './style.css',
    './app.js',
    './notifications.js',
    './payments.js',
    './dashboard.js',
    './settings.js',
    './export.js',
    './firebase-config.js',
];

// Yükle
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache).catch(err => {
                console.warn('Cache hatası:', err);
            });
        })
    );
});

// Aktif et — eski cache'leri temizle
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — önce network, olmadı cache
self.addEventListener('fetch', (event) => {
    // Firebase isteklerini cache'leme
    if (event.request.url.includes('firestore') ||
        event.request.url.includes('firebase') ||
        event.request.url.includes('googleapis')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
