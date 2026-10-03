// Service worker di PTT: rende l'app installabile e ne tiene in cache i file.
// Pagine e config.json: prima la rete (dati e versioni sempre aggiornati), la cache solo senza rete.
// File con hash (assets/): prima la cache. Le chiamate agli archivi (GitHub, Supabase) non passano di qui.
const CACHE = 'tt-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icona.svg'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((chiavi) => Promise.all(chiavi.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(
        (trovata) =>
          trovata ||
          fetch(e.request).then((r) => {
            const copia = r.clone();
            if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, copia));
            return r;
          }),
      ),
    );
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request).then((c) => c || caches.match('./index.html'))),
  );
});
