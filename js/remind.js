// Reminders: a nudge only when something is overdue, nothing when you are on track.
// Grip break: more than an hour since the last one, during work hours on a workday. Ankle pumps: more than 30 min.
// Weight: nothing logged today and the last one is a day or more old, once a day from 6 am.
// These run while Telmyn is open or in the background; Android may pause them when the phone sleeps. Alarms that
// fire with the app closed are the phase 2 push service.
import * as db from './db.js';
import { state } from './state.js';
import { now, hhmm } from './clock.js';
import { toast } from './ui/dom.js';

const WORK = ['08:00', '17:00'];
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
  return on;
}

async function notify(tag, title, body) {
  const last = sent[tag] || 0;
  if (now().getTime() - last < 55 * 60000) return;      // never nag faster than hourly per kind
  sent[tag] = now().getTime();
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', renotify: true });
    else new Notification(title, { body, tag });
  } catch { /* notifications unavailable here */ }
}

async function check() {
  if (!(await remindersOn()) || Notification.permission !== 'granted') return;
  const t = now(), clock = hhmm(t), ms = t.getTime();
  const workday = t.getDay() >= 1 && t.getDay() <= 5 && clock >= WORK[0] && clock <= WORK[1];
  const lastAt = pred => state.events.filter(pred).map(e => new Date(e.at).getTime()).sort((a, b) => b - a)[0] || null;
  if (workday && state.plan.hourly) {
    const grip = lastAt(e => e.type === 'block_done' && e.block === 'hourly');
    const base = grip ?? new Date(`${state.date}T${WORK[0]}:00`).getTime();
    if (ms - base > 60 * 60000) notify('grip', 'Grip break', grip ? 'It has been an hour since the last one.' : 'First grip break of the day.');
    const pumps = lastAt(e => e.type === 'habit' && e.habit === 'ankle_pumps');
    if (ms - (pumps ?? base) > 30 * 60000) notify('pumps', 'Ankle pumps', '20 per foot. It has been over 30 minutes.');
  }
  if (clock >= '06:00' && (state.day.weight_lb === null || state.day.weight_lb === undefined)) {
    const days = (await db.all('days')).filter(d => d.weight_lb !== null && d.weight_lb !== undefined && d.date < state.date);
    if (!days.length || days.sort((a, b) => b.date.localeCompare(a.date))[0].date < state.date) {
      if (!sent.weightDay || sent.weightDay !== state.date) { sent.weightDay = state.date; notify('weight', 'Weight', 'Nothing logged today. Tap Weight on Today.'); }
    }
  }
}

export function startReminders() {
  setInterval(() => { check().catch(() => {}); }, 60000);
  check().catch(() => {});
}
