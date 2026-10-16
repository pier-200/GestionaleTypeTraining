// Service worker del Gestionale Type Training: rende l'app installabile e ne tiene in cache i file.
// Pagine e config.json: prima la rete (dati e versioni sempre aggiornati), la cache solo senza rete.
// File con hash (assets/): prima la cache. Le chiamate agli archivi (GitHub) non passano di qui.
const CACHE = 'tt-v4';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icona.svg'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const vecchie = (await caches.keys()).filter((k) => k !== CACHE);
      await Promise.all(vecchie.map((k) => caches.delete(k)));
      await self.clients.claim();
      // è uscita una versione nuova: le schede aperte si ricaricano, altrimenti resterebbe in uso quella precedente
      if (vecchie.length) for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => undefined);
    })(),
  );
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
    // senza la cache HTTP del browser: GitHub Pages la concede per 10 minuti e farebbe usare la versione precedente
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then((r) => {
        const copia = r.clone();
        if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request).then((c) => c || caches.match('./index.html'))),
  );
});
