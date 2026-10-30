import * as db from './db.js';
import { load, state, onChange } from './state.js';
import { TEST, isoDate, now } from './clock.js';
import { renderShell, startShell } from './ui/shell.js';
import { toast, h, notices } from './ui/dom.js';
import { APP_VERSION } from './version.js';
import { loadPicks } from './ui/media.js';
import { startReminders } from './remind.js';
import { startSync, takeLinkKey, setSyncKey } from './sync.js';

const root = document.getElementById('app');

// Screen report for the cloud copy (Me and sync read it). The layout itself measures nothing: #app is 100% of the real
// window, because Chrome on Android can resolve 100dvh taller than the window after a reload (an app update) or a
// keyboard, which pushed the tab bar under the system buttons. The report shows both numbers so any gap is visible.
function screenReport() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;height:100dvh;padding-bottom:env(safe-area-inset-bottom,0px)';
  document.body.append(probe);
  const set = () => {
    const dvh = probe.offsetHeight - (parseFloat(getComputedStyle(probe).paddingBottom) || 0);
    const inset = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
    const app = document.getElementById('app')?.offsetHeight || 0;
    const standalone = matchMedia('(display-mode: standalone)').matches;
    document.documentElement.dataset.screen = `window ${innerWidth}x${innerHeight}, app ${app}, 100dvh ${dvh}, screen ${screen.width}x${screen.height}, inset ${inset}, dpr ${devicePixelRatio}, ${standalone ? 'standalone' : 'browser'}`;
  };
  set(); setTimeout(set, 2000); addEventListener('resize', () => requestAnimationFrame(set)); screen.orientation?.addEventListener('change', () => setTimeout(set, 300));
}

// Layers size themselves to the visible screen, so the keyboard never covers what you are writing.
function trackVisibleHeight() {
  const set = () => document.documentElement.style.setProperty('--vvh', `${(visualViewport?.height || innerHeight)}px`);
  set(); visualViewport?.addEventListener('resize', set); addEventListener('resize', set);
}

async function boot() {
  screenReport();
  trackVisibleHeight();
  // Setup link from tools/sync-setup.ps1 (#sync=KEY): take the key out of the address before anything shows.
  const linkKey = TEST ? null : takeLinkKey();
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
  startSync();
  // Keep the setup link's key on the phone and send every stored day once.
  if (linkKey) setSyncKey(linkKey).then(n => toast(`Cloud copy on. ${n} day${n === 1 ? '' : 's'} sent.`)).catch(err => toast(err.message));
}

// A new version installs in the background and waits. It loads only when you tap the update card (or once every
// Telmyn window has closed), never on its own in the middle of something.
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const offer = w => {
    if (!w || document.querySelector('.update')) return;
    notices().prepend(h('button', { class: 'update notice', onclick: e => { e.currentTarget.querySelector('span').textContent = 'Loading…'; w.postMessage('skipWaiting'); } },
      h('b', {}, 'Update ready'), h('span', {}, 'Tap to load it')));
  };
  navigator.serviceWorker.register('sw.js').then(reg => {
    // Installed earlier and still waiting (the app was closed before you tapped): offer it again now.
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
  });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

boot().catch(err => { root.textContent = `Could not start: ${err.message}`; toast(err.message); });
