// Cloud copy (0.16): each day you change is sent to the Worker, so Claude can read your recent days from one link.
// Off until the phone holds the write key, which arrives once through the setup link (#sync=KEY) and never leaves
// the phone except to the Worker. The test app never sends. Failed sends are remembered and retried.
import * as db from './db.js';
import { state, onChange } from './state.js';
import { API_BASE } from './config.js';
import { SITE } from './site.js';
import { buildHandoff } from './handoff.js';
import { APP_VERSION } from './version.js';

const KEY = /^[0-9a-f]{32,128}$/;
let timer = null;
let busy = false;

export const syncKey = () => db.getMeta('sync_key', null);
export const syncLast = () => db.getMeta('sync_last', null);

// Everything stored for one date, in the shape the handoff builder and the cloud copy use.
export async function dayRecord(date) {
  const day = { date, ...(await db.get('days', date)) };
  const [events, sets, fluids] = await Promise.all(['events', 'sets', 'fluids'].map(s => db.byDate(s, date)));
  events.sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  return { day, events, sets, fluids };
}

async function send(key, rec, keepalive = false) {
  const r = await fetch(`${API_BASE}/sync/day?site=${SITE === 'test' ? 'test' : 'live'}`, {
    method: 'POST', keepalive,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ date: rec.day.date, handoff: buildHandoff(rec), data: { ...rec, device: document.documentElement.dataset.screen || null, app: APP_VERSION } }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Sync returned ${r.status}.`);
}

// Send the given dates (plus any left over from a failed try). Returns how many went.
export async function syncDates(dates, { keepalive = false } = {}) {
  const key = await syncKey();
  if (!key || SITE === 'test') return 0;
  const pending = [...new Set([...(await db.getMeta('sync_dirty', [])), ...dates])].sort();
  if (!pending.length) return 0;
  const left = [];
  let sent = 0;
  for (const date of pending) {
    try { await send(key, await dayRecord(date), keepalive); sent++; }
    catch { left.push(date); }
  }
  await db.setMeta('sync_dirty', left);
  if (sent) await db.setMeta('sync_last', new Date().toISOString());
  if (left.length && !sent) throw new Error('Sync failed. It will try again.');
  return sent;
}

// Every date that has anything stored.
export async function allDates() {
  const set = new Set((await db.all('days')).map(d => d.date));
  for (const s of ['events', 'sets', 'fluids']) for (const r of await db.all(s)) if (r.date) set.add(r.date);
  return [...set].sort();
}
export const syncAll = async () => syncDates(await allDates());

// Store the key from the setup link, then send everything once.
export async function setSyncKey(key) {
  if (!KEY.test(key || '')) throw new Error('That is not a sync key.');
  await db.setMeta('sync_key', key);
  return syncAll();
}
export async function clearSyncKey() { await db.setMeta('sync_key', null); await db.setMeta('sync_dirty', []); }

// Read #sync=KEY from the setup link and remove it from the address right away.
export function takeLinkKey() {
  const m = location.hash.match(/^#sync=([0-9a-f]+)$/);
  if (!m) return null;
  history.replaceState(null, '', `${location.pathname}${location.search}#me`);
  return m[1];
}

// After any change, send the day on screen 5 seconds after things go quiet; send at once when the app is hidden.
const flush = (keepalive = false) => {
  clearTimeout(timer); timer = null;
  if (busy || !state.date) return;
  busy = true;
  syncDates([state.date], { keepalive }).catch(() => {}).finally(() => { busy = false; });
};
export function startSync() {
  if (SITE === 'test') return;
  onChange(() => { clearTimeout(timer); timer = setTimeout(flush, 5000); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && timer) flush(true); });
  addEventListener('online', () => flush());
  setTimeout(() => flush(), 3000);   // anything left over from last time
}
