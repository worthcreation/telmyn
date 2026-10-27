// Version comes from the registration URL (sw.js?v=x.y.z), set in js/version.js. One number to bump.
const VERSION = new URL(self.location).searchParams.get('v') || 'dev';
const CACHE = `telmyn-${VERSION}`;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/tokens.css', 'css/app.css',
  'js/main.js', 'js/version.js', 'js/clock.js', 'js/db.js', 'js/schema.js', 'js/state.js', 'js/handoff.js', 'js/verses.js', 'js/xp.js', 'js/flow.js', 'js/config.js', 'js/scripture.js',
  'js/program/index.js', 'js/program/v1.js', 'js/program/v1_1.js', 'js/program/steps.js',
  'js/ui/dom.js', 'js/ui/fx.js', 'js/ui/today.js', 'js/ui/runner.js', 'js/ui/forms.js', 'js/ui/verse.js', 'js/ui/data.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('telmyn-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

// App files: cache first (versioned). Fonts: cache after first load. Everything else: network.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; })));
  }
});

// Phase 2: tight-mode alarms pushed from the Cloudflare Worker. Payload carries only a block name.
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'Telmyn', body: 'Next block is ready.' };
  e.waitUntil(self.registration.showNotification(data.title || 'Telmyn', { body: data.body, icon: 'icons/icon-192.png', tag: data.tag || 'block' }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => list[0]?.focus() || self.clients.openWindow('./')));
});
