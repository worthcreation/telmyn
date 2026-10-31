// Reminders: a nudge only when something is overdue, nothing when you are on track. The rules (grip hourly and ankle
// pumps every 30 min on weekdays, calf raises hourly on weekends, weight from 6 am, and a follow-up every 15 min
// while one goes unanswered) live in js/reminder-rules.js, shared with the Worker.
// Push (0.15): the Worker checks every minute and pushes when something is due, so alerts arrive with the app closed.
// The phone only tells the Worker its push address, its time zone offset, when the last grip break, pumps, calf
// raises and weight happened, and the amounts to show. Without push (not set up, or a phone that cannot), the same
// rules run in the app while it is open.
import * as db from './db.js';
import { state, onChange } from './state.js';
import { planFor } from './program/index.js';
import { due } from './reminder-rules.js';
import { API_BASE } from './config.js';
import { SITE } from './site.js';
import { now } from './clock.js';
import { toast, chime } from './ui/dom.js';

const sent = {};   // kind -> last time we nudged (ms), for the in-app checks

export const remindersOn = () => db.getMeta('reminders', false);
export async function setReminders(on) {
  if (on) {
    if (!('Notification' in window)) { toast('This phone does not support notifications.'); return false; }
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') { toast('Notifications are blocked for Telmyn in the phone settings.'); return false; }
    }
  }
  await db.setMeta('reminders', on);
  await syncPush(on).catch(() => {});
  return on;
}

// ---- Push
const site = SITE === 'test' ? 'test' : 'live';
const b64ToBytes = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
let pushActive = false;
async function post(path, body) {
  const r = await fetch(`${API_BASE}${path}?site=${site}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Push service unavailable.');
}
function lastTimes() {
  const at = pred => state.events.filter(pred).pop()?.at;
  const ms = v => (v ? new Date(v).getTime() : undefined);
  const H = planFor(state.date).program.data.HABITS || {};
  return {
    grip: ms(at(e => e.type === 'block_done' && e.block === 'hourly')),
    pumps: ms(at(e => e.type === 'habit' && e.habit === 'ankle_pumps')),
    calf: ms(at(e => e.type === 'habit' && e.habit === 'calf_raises')),
    weight: state.day.weight_lb !== null && state.day.weight_lb !== undefined ? state.date : undefined,
    say: { pumps: H.ankle_pumps?.amount, calf: H.calf_raises?.amount },
  };
}
export async function syncPush(on) {
  const reg = await navigator.serviceWorker?.ready;
  if (!reg?.pushManager) return (pushActive = false);
  if (!on) { (await reg.pushManager.getSubscription())?.unsubscribe(); await post('/push/subscribe', { off: true }).catch(() => {}); return (pushActive = false); }
  const k = await (await fetch(`${API_BASE}/push/key?site=${site}`)).json().catch(() => ({}));
  if (!k.key) return (pushActive = false);                     // the Worker has no push keys yet: in-app checks only
  const old = await reg.pushManager.getSubscription();
  if (old) await old.unsubscribe();                             // fresh each time, so a new key never strands an old one
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(k.key) });
  await post('/push/subscribe', { sub: sub.toJSON(), offset: new Date().getTimezoneOffset(), state: lastTimes() });
  pushActive = true;
  toast('Reminders will arrive even with Telmyn closed.');
  return true;
}
// Tell the Worker whenever a grip break, pumps, calf raises or weight is logged (only those times are sent).
let lastSent = '';
function reportState() {
  if (!pushActive) return;
  const s = JSON.stringify(lastTimes());
  if (s === lastSent) return;
  lastSent = s;
  post('/push/state', { offset: new Date().getTimezoneOffset(), state: lastTimes() }).catch(() => { lastSent = ''; });
}

async function notify(kind, title, body) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (document.visibilityState === 'visible') { chime(3); toast(`${title}: ${body}`); }
    if (reg?.active) reg.active.postMessage({ type: 'notify', kind, title, body });   // sw.js shapes every notification
    else new Notification(title, { body, tag: kind });
  } catch { /* notifications unavailable here */ }
}

async function check() {
  if (!(await remindersOn()) || Notification.permission !== 'granted') return;
  if (pushActive) return;                                        // the Worker is sending them; no duplicates
  const t = now().getTime();
  for (const d of due({ offset: now().getTimezoneOffset(), state: lastTimes(), sent }, t)) { sent[d.kind] = t; notify(d.kind, d.title, d.body); }
}

export async function startReminders() {
  if (await remindersOn()) {
    const reg = await navigator.serviceWorker?.ready.catch(() => null);
    pushActive = !!(await reg?.pushManager?.getSubscription().catch(() => null));
  }
  onChange(reportState);
  setInterval(() => { check().catch(() => {}); }, 60000);
  check().catch(() => {});
  reportState();
}
