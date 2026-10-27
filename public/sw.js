// Self-destroying Service Worker to purge stale Workbox caches & force reload into fresh bundle
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch (e) {
        // ignore cache deletion errors
      }
      try {
        await self.registration.unregister();
      } catch (e) {
        // ignore unregister errors
      }
      try {
        const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientsList) {
          if (client.url && 'navigate' in client) {
            await client.navigate(client.url);
          }
        }
      } catch (e) {
        // ignore client navigation errors
      }
    })()
  );
});
