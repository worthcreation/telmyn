// Bump with js/version.js on every release (any change to this file makes phones install the new version).
const VERSION = '0.23.0';
const CACHE = `telmyn-${VERSION}`;
// Fonts keep their own cache across versions: dropping them with each update made every update load with the
// stand-in font first and then jump when the real one arrived.
const FONTS = 'fonts-telmyn';
// The voice-stop engine and speech model (several MB, unchanged between versions) keep their own cache too, so an
// update does not download them again.
const ENGINE = 'engine-telmyn';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/tokens.css', 'css/app.css',
  'js/main.js', 'js/version.js', 'js/clock.js', 'js/db.js', 'js/schema.js', 'js/state.js', 'js/handoff.js', 'js/verses.js', 'js/xp.js', 'js/flow.js', 'js/hourly.js', 'js/foods.js', 'js/site.js', 'js/remind.js', 'js/sync.js', 'js/voice.js', 'js/status.js', 'js/config.js', 'js/scripture.js',
  'js/program/index.js', 'js/program/v1.js', 'js/program/v1_1.js', 'js/program/steps.js',
  'js/ui/dom.js', 'js/ui/shell.js', 'js/ui/progress.js', 'js/ui/gear.js', 'js/ui/me.js', 'js/ui/journal.js', 'js/ui/study-player.js', 'js/ui/fx.js', 'js/ui/today.js', 'js/ui/runner.js', 'js/ui/forms.js', 'js/ui/verse.js', 'js/ui/data.js', 'js/ui/video-block.js', 'js/ui/media.js', 'js/ui/history.js', 'js/ui/day.js', 'js/ui/detail.js', 'js/listen.js',
  'data/original.json', 'icons/star-192.png', 'icons/star-512.png', 'icons/badge-96.png', 'icons/apple-touch-icon.png',
];

// A new version downloads its whole copy fresh (past the browser's own cache) and then waits. No skipWaiting here:
// it takes over only when you tap Update Ready (main.js), so the app never changes under you.
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('telmyn-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

// App files come from this version's own copy, so the app you see is always the version that is in charge: a new
// release waits in its own copy until you tap Update Ready. (It used to fetch app files from the network first,
// which ran new code before the tap and left the update card with nothing to do.) Anything not in the copy is
// fetched and kept. Fonts: cache after the first load. Everything else (the verse service): straight to the network.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin && /\/(js\/vendor|data\/models)\//.test(url.pathname)) {
    e.respondWith(caches.open(ENGINE).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(caches.open(CACHE).then(async c => (await c.match(e.request, { ignoreSearch: true }))
      || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(FONTS).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; })));
  }
});

// Push reminders: the reminders arrive inside the push itself, encrypted for this phone (worker/src/push.js). Rings
// through Android's normal notification settings for Telmyn, and stays until dismissed.
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let list = [];
    try { list = e.data ? e.data.json() : []; } catch { /* unreadable payload */ }
    if (!Array.isArray(list) || !list.length) list = [{ kind: 'telmyn', title: 'Telmyn', body: 'A reminder is due.' }];
    for (const n of list) await show(n.kind, n.title, n.body);
  })());
});
// The one place a Telmyn notification is shaped. The page asks for its own (in-app checks) through postMessage, so
// every alert looks the same: star icon, a star badge that Android can draw as a silhouette, sound and vibration.
const show = (kind, title, body) => self.registration.showNotification(title, { body, tag: kind, icon: 'icons/star-192.png', badge: 'icons/badge-96.png',
  renotify: true, requireInteraction: true, silent: false, vibrate: [300, 150, 300, 150, 300], data: { kind } });
self.addEventListener('message', e => { if (e.data?.type === 'notify') e.waitUntil(show(e.data.kind, e.data.title, e.data.body)); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow('./#today');
  })());
});
