// Reminders: a nudge only when something is overdue, nothing when you are on track.
// Grip break: more than an hour since the last one, during work hours on a workday. Ankle pumps: more than 30 min.
// Weight: nothing logged today and the last one is a day or more old, once a day from 6 am.
// Push (0.15): the Worker checks every minute and pushes when something is due, so alerts arrive with the app closed.
// The phone only tells the Worker its push address, its time zone offset, and when the last grip break, pumps and
// weight happened. Without push (not set up, or a phone that cannot), the in-app checks below still run while open.
import * as db from './db.js';
import { state, onChange } from './state.js';
import { API_BASE } from './config.js';
import { SITE } from './site.js';
import { now, hhmm } from './clock.js';
import { toast, chime } from './ui/dom.js';
import { overdueStatus } from './status.js';

const sent = {};   // tag -> last time we nudged (ms)

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
  return {
    grip: ms(at(e => e.type === 'block_done' && e.block === 'hourly')),
    pumps: ms(at(e => e.type === 'habit' && e.habit === 'ankle_pumps')),
    weight: state.day.weight_lb !== null && state.day.weight_lb !== undefined ? state.date : undefined,
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
// Tell the Worker whenever a grip break, pumps or weight is logged (only those three times are sent).
let lastSent = '';
function reportState() {
  if (!pushActive) return;
  const s = JSON.stringify(lastTimes());
  if (s === lastSent) return;
  lastSent = s;
  post('/push/state', { offset: new Date().getTimezoneOffset(), state: lastTimes() }).catch(() => { lastSent = ''; });
}

async function notify(tag, title, body) {
  const last = sent[tag] || 0;
  if (now().getTime() - last < 55 * 60000) return;      // never nag faster than hourly per kind
  sent[tag] = now().getTime();
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (document.visibilityState === 'visible') { chime(3); toast(`${title}: ${body}`); }
    if (reg?.active) reg.active.postMessage({ type: 'notify', kind: tag, title, body });   // sw.js shapes every notification
    else new Notification(title, { body, tag });
  } catch { /* notifications unavailable here */ }
}

async function check() {
  if (!(await remindersOn()) || Notification.permission !== 'granted') return;
  if (pushActive) return;                                        // the Worker is sending them; no duplicates
  const t = now(), clock = hhmm(t), ms = t.getTime();
  const lastAt = pred => state.events.filter(pred).pop()?.at || null;
  if (state.plan.hourly) {
    const grip = lastAt(e => e.type === 'block_done' && e.block === 'hourly');
    if (overdueStatus(grip, 60) === 'behind') notify('grip', 'Grip break', grip ? 'It has been an hour since the last one.' : 'First grip break of the day.');
    if (overdueStatus(lastAt(e => e.type === 'habit' && e.habit === 'ankle_pumps'), 30) === 'behind') notify('pumps', 'Ankle pumps', '20 per foot. It has been over 30 minutes.');
  }
  if (clock >= '06:00' && (state.day.weight_lb === null || state.day.weight_lb === undefined)) {
    const days = (await db.all('days')).filter(d => d.weight_lb !== null && d.weight_lb !== undefined && d.date < state.date);
    if (!days.length || days.sort((a, b) => b.date.localeCompare(a.date))[0].date < state.date) {
      if (!sent.weightDay || sent.weightDay !== state.date) { sent.weightDay = state.date; notify('weight', 'Weight', 'Nothing logged today. Tap Weight on Today.'); }
    }
  }
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
