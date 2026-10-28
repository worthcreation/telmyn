import * as db from './db.js';
import { load, state, onChange } from './state.js';
import { TEST, isoDate, now } from './clock.js';
import { renderShell, startShell } from './ui/shell.js';
import { toast, h } from './ui/dom.js';
import { APP_VERSION } from './version.js';
import { loadPicks } from './ui/media.js';

const root = document.getElementById('app');

// Android Chrome can draw an installed app behind the system buttons without reporting their height.
// Reserve their usual height (48px) so nothing tappable sits under them.
function reserveAndroidNav() {
  const standalone = matchMedia('(display-mode: standalone)').matches;
  if (standalone && /Android/i.test(navigator.userAgent)) document.documentElement.style.setProperty('--nav-fallback', '48px');
}

async function boot() {
  reserveAndroidNav();
  // The test app lives at its own web address, so its storage is separate from the real app's by browser design.
  await db.open(TEST ? 'telmyn-test-app' : 'telmyn');
  if (TEST) document.title = 'Telmyn Test';
  // Remove the old in-app test copy from 0.9.3 (a separate database, never the real one).
  else indexedDB.deleteDatabase?.('telmyn-test');
  navigator.storage?.persist?.();
  await loadPicks();
  onChange(() => { if (!document.querySelector('.sheet-wrap .log-form')) renderShell(root); });
  startShell(root);
  await load(isoDate());

  // Roll over at midnight; refresh "now" labels each minute.
  let minute = '';
  setInterval(async () => {
    const d = now();
    if (isoDate(d) !== state.date) return load(isoDate(d));
    const m = d.getMinutes();
    if (m !== minute && !document.querySelector('.runner, .sheet-wrap')) { minute = m; renderShell(root); }
  }, 1000);

  registerSW();
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          const b = h('button', { class: 'update', onclick: () => { w.postMessage('skipWaiting'); } }, 'Update ready. Tap to load it.');
          document.body.append(b);
        }
      });
    });
  });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

boot().catch(err => { root.textContent = `Could not start: ${err.message}`; toast(err.message); });
