// Bump with js/version.js on every release (any change to this file makes phones install the new version).
const VERSION = '0.15.1';
const CACHE = `telmyn-${VERSION}`;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/tokens.css', 'css/app.css',
  'js/main.js', 'js/version.js', 'js/clock.js', 'js/db.js', 'js/schema.js', 'js/state.js', 'js/handoff.js', 'js/verses.js', 'js/xp.js', 'js/flow.js', 'js/hourly.js', 'js/foods.js', 'js/site.js', 'js/remind.js', 'js/status.js', 'js/config.js', 'js/scripture.js',
  'js/program/index.js', 'js/program/v1.js', 'js/program/v1_1.js', 'js/program/steps.js',
  'js/ui/dom.js', 'js/ui/shell.js', 'js/ui/progress.js', 'js/ui/gear.js', 'js/ui/me.js', 'js/ui/journal.js', 'js/ui/study-player.js', 'js/ui/fx.js', 'js/ui/today.js', 'js/ui/runner.js', 'js/ui/forms.js', 'js/ui/verse.js', 'js/ui/data.js', 'js/ui/video-block.js', 'js/ui/media.js',
  'data/original.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

// Install and take over right away, so a new release never waits behind an old cached copy.
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('telmyn-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

// App files: network first, so every release shows up as soon as it is published; the cache is the offline fallback.
// Fonts: cache after the first load. Everything else (the verse service): straight to the network.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request, { cache: 'no-cache' })
      .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true })));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; })));
  }
});

// Push reminders: the Worker sends an empty, urgent push; the details come from /push/pending. Vibrates and rings
// through Android's normal notification settings for Telmyn, and stays until dismissed.
const API = 'https://telmyn-api.worthcreation.workers.dev';
const SITE = /telmyn-test/.test(location.hostname) ? 'test' : 'live';
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let list = [];
    try { list = (await (await fetch(`${API}/push/pending?site=${SITE}`)).json()).pending || []; } catch { /* offline */ }
    if (!list.length) list = [{ kind: 'telmyn', title: 'Telmyn', body: 'A reminder is due.' }];
    for (const n of list) {
      await self.registration.showNotification(n.title, { body: n.body, tag: n.kind, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
        renotify: true, requireInteraction: true, silent: false, vibrate: [300, 150, 300, 150, 300], data: { kind: n.kind } });
    }
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow('./#today');
  })());
});
