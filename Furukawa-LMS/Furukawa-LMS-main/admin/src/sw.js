import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

self.skipWaiting();
clientsClaim();

// Precache all build assets injected by vite-plugin-pwa.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Static images, icons, logos.
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// Google Fonts stylesheets and font files.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  })
);

// API requests are never served from cache to avoid stale dashboards/exams.
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());

// App navigations: try the network first, fall back to whatever page the
// user already visited this session, then to the offline placeholder.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages-cache',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  })
);

setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    return (await caches.match('/offline.html')) || Response.error();
  }
  return Response.error();
});

// Push notifications — no backend is wired up yet, kept as stubs for future integration.
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from Furukawa Minda LMS',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      { action: 'explore', title: 'View Details', icon: '/icons/icon-192x192.png' },
      { action: 'close', title: 'Close', icon: '/icons/icon-192x192.png' },
    ],
  };

  event.waitUntil(self.registration.showNotification('Furukawa Minda LMS', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(self.clients.openWindow('/'));
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    // Reserved for future offline-write replay (e.g. queued exam submissions).
  }
});
