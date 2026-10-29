import * as db from './db.js';
import { load, state, onChange } from './state.js';
import { TEST, isoDate, now } from './clock.js';
import { renderShell, startShell } from './ui/shell.js';
import { toast, h } from './ui/dom.js';
import { APP_VERSION } from './version.js';
import { loadPicks } from './ui/media.js';
import { startReminders } from './remind.js';

const root = document.getElementById('app');

// Android Chrome can draw an installed app behind the system buttons without reporting their height.
// Reserve their usual height (48px) so nothing tappable sits under them.
// Android: reserve room for the system buttons only when the app is actually drawn behind them, measured each time
// the window changes (rotation, Chrome updates, call banners), never assumed. If the page already ends above the
// buttons, nothing extra is reserved, so the layout cannot drift up.
function reserveAndroidNav() {
  // Measure what the phone reports for the button area: a hidden probe padded by env(safe-area-inset-bottom).
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)';
  document.body.append(probe);
  // The full height for each orientation: a keyboard, a permission dialog or a call banner only ever shrinks the
  // window for a moment, so the decision uses the largest height seen, and those moments cannot flip the layout.
  const tallest = {};
  const set = () => {
    const key = innerWidth > innerHeight ? 'land' : 'port';
    tallest[key] = Math.max(tallest[key] || 0, innerHeight);
    const inset = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
    const standalone = matchMedia('(display-mode: standalone)').matches;
    // App height short of the screen by less than 45 px (only the status bar) means the buttons cover the app.
    const short = screen.height - tallest[key];
    const behind = standalone && /Android/i.test(navigator.userAgent) && inset === 0 && key === 'port' && short < 45;
    document.documentElement.style.setProperty('--nav-fallback', behind ? '48px' : '0px');
    document.documentElement.dataset.screen = `${innerWidth}x${tallest[key]} of ${screen.width}x${screen.height} (short ${short}), inset ${inset}, ${behind ? 'reserving 48 for buttons' : 'no reserve'}`;
  };
  set(); addEventListener('resize', set); screen.orientation?.addEventListener('change', () => setTimeout(set, 300));
}

// Layers size themselves to the visible screen, so the keyboard never covers what you are writing.
function trackVisibleHeight() {
  const set = () => document.documentElement.style.setProperty('--vvh', `${(visualViewport?.height || innerHeight)}px`);
  set(); visualViewport?.addEventListener('resize', set); addEventListener('resize', set);
}

async function boot() {
  reserveAndroidNav();
  trackVisibleHeight();
  // The test app lives at its own web address, so its storage is separate from the real app's by browser design.
  await db.open(TEST ? 'telmyn-test-app' : 'telmyn');
  if (TEST) document.title = 'Telmyn Test';
  // Remove the old in-app test copy from 0.9.3 (a separate database, never the real one).
  else indexedDB.deleteDatabase?.('telmyn-test');
  navigator.storage?.persist?.();
  await loadPicks();
  onChange(() => { if (!document.querySelector('.layer .log-form')) renderShell(root); });
  startShell(root);
  await load(isoDate());

  // Roll over at midnight; refresh "now" labels each minute.
  let minute = '';
  setInterval(async () => {
    const d = now();
    if (isoDate(d) !== state.date) return load(isoDate(d));
    const m = d.getMinutes();
    if (m !== minute && !document.querySelector('.runner, .layer')) { minute = m; renderShell(root); }
  }, 1000);

  registerSW();
  startReminders();
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
