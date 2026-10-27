import * as db from './db.js';
import { load, state, onChange } from './state.js';
import { TEST, isoDate, now } from './clock.js';
import { renderToday } from './ui/today.js';
import { toast, h } from './ui/dom.js';
import { APP_VERSION } from './version.js';

const root = document.getElementById('app');

async function boot() {
  // Test mode writes to its own database so practice runs never touch real logs.
  await db.open(TEST ? 'telmyn-test' : 'telmyn');
  navigator.storage?.persist?.();
  onChange(() => { if (!document.querySelector('.sheet-wrap .log-form')) renderToday(root); });
  await load(isoDate());

  // Roll over at midnight; refresh "now" labels each minute.
  let minute = '';
  setInterval(async () => {
    const d = now();
    if (isoDate(d) !== state.date) return load(isoDate(d));
    const m = d.getMinutes();
    if (m !== minute && !document.querySelector('.runner, .sheet-wrap')) { minute = m; renderToday(root); }
  }, 1000);

  registerSW();
}

function registerSW() {
  if (!('serviceWorker' in navigator) || TEST) return;
  navigator.serviceWorker.register(`sw.js?v=${APP_VERSION}`).then(reg => {
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
