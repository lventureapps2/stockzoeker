/*
 * Stockzoeker – service worker.
 * Bewaart de app zelf op het toestel, zodat ze ook zonder wifi start. De
 * stocklijst staat niet hier maar in localStorage (zie index.html).
 *
 * Werking: de app start altijd meteen vanaf het toestel. Bij elke start met
 * netwerk worden alle bestanden samen opnieuw opgehaald; alleen als ze
 * ALLEMAAL binnen zijn, vervangen ze de oude. Een nieuwe versie is dus
 * zichtbaar vanaf de tweede start na de update, en nooit half.
 * Aanvragen naar Google gaan nooit via deze cache.
 *
 * Dit bestand staat in de map stockzoeker/ en bedient alleen die map. De
 * service worker van Palletscan (in de hoofdmap) raakt deze map niet.
 */
var CACHE = 'stockzoeker-v1';
var SHELL = ['./', './index.html', './zoeklogic.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

function fetchShell() {
  return Promise.all(SHELL.map(function (u) {
    return fetch(u, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok || res.redirected) throw new Error('niet opgehaald: ' + u);
      return [u, res];
    });
  }));
}
function storeShell(pairs) {
  return caches.open(CACHE).then(function (cache) {
    return Promise.all(pairs.map(function (p) { return cache.put(p[0], p[1]); }));
  });
}

self.addEventListener('install', function (event) {
  event.waitUntil(fetchShell().then(storeShell).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      // Alleen de eigen oude caches opruimen; Palletscan en andere apps op hetzelfde adres blijven staan.
      return Promise.all(keys.filter(function (k) { return k.indexOf('stockzoeker-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') event.waitUntil(fetchShell().then(storeShell).catch(function () {}));

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true });
    }).then(function (hit) { return hit || fetch(req); })
  );
});
