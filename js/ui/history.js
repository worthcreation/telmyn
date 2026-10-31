// Press and hold on Grip, Pumps (Calf on weekends) or Weight: today's entries with their times (or the recent weights), full screen.
// Same list as Fluids and Protein. Removing an entry offers Undo, which puts it back with its original time.
import { h, sheet, toast, fill } from './dom.js';
import * as db from '../db.js';
import { state, removeEvent, restoreEvent } from '../state.js';
import { entryList } from './forms.js';
import { addDays } from '../clock.js';

function eventList(title, pick, what, empty) {
  const body = h('div', { class: 'entries-wrap' });
  const draw = () => {
    const list = state.events.filter(pick).reverse();
    fill(body,
      h('p', { class: 'ent-total' }, h('b', {}, String(list.length)), ' today'),
      entryList(list.map(e => ({ at: e.at, what: what(e), amt: '',
        remove: async () => { await removeEvent(e); draw(); toast('Removed', { label: 'Undo', fn: async () => { await restoreEvent(e); draw(); } }); } })), empty));
  };
  draw();
  sheet(title, body, { full: true });
}

export const gripList = () => eventList('Grip breaks', e => e.type === 'block_done' && e.block === 'hourly',
  e => (e.palms ? `Palms ${e.palms}` : 'Grip break'), 'No grip breaks yet today.');

// leg: the day's leg habit (legToday in state.js).
export const legList = leg => eventList(leg.name, e => e.type === 'habit' && e.habit === leg.key,
  () => leg.amount, `No ${leg.name.toLowerCase()} yet today.`);

// Weight: the last 7 readings with dates, and the average of the last 7 days (the number to judge by).
export async function weightList() {
  const days = (await db.all('days')).filter(d => d.weight_lb !== null && d.weight_lb !== undefined).sort((a, b) => b.date.localeCompare(a.date));
  const since = addDays(state.date, -6);
  const week = days.filter(d => d.date >= since && d.date <= state.date);
  const avg = week.length ? Math.round(week.reduce((t, d) => t + d.weight_lb, 0) / week.length * 10) / 10 : null;
  const pretty = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
  sheet('Weight', h('div', { class: 'entries-wrap' },
    h('p', { class: 'ent-total' }, avg === null ? 'No readings this week' : [h('b', {}, String(avg)), ` lb, 7-day average (${week.length} reading${week.length === 1 ? '' : 's'})`]),
    entryList(days.slice(0, 7).map(d => ({ at: null, what: pretty(d.date), amt: `${d.weight_lb} lb` })), 'No weight logged yet.')), { full: true });
}
