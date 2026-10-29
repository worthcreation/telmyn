// One place that judges the day's items: 'met', 'behind', or null (on track or not applicable).
// Pace lines run from the start of the day to its end (fluids 07:00 to 23:00, protein 07:00 to 21:00); "behind"
// means under the pace line by more than the slack. Pumps and grip are overdue by time since the last one, on
// workdays during work hours. Weight is behind when nothing is logged for a day or more.
import { now, hhmm } from './clock.js';

const PACE = { fluids: ['07:00', '23:00', 15], protein: ['07:00', '21:00', 25] };
const WORK = ['08:00', '17:00'];
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export function paceStatus(kind, value, target) {
  if (value === null || value === undefined) value = 0;
  if (value >= target) return 'met';
  const [from, to, slack] = PACE[kind];
  const t = mins(hhmm(now()));
  const due = target * Math.min(1, Math.max(0, (t - mins(from)) / (mins(to) - mins(from))));
  return due - value > slack ? 'behind' : null;
}

// Minutes past the limit (null when not overdue or outside work hours).
function minutesOver(lastAt, limitMin, workdayOnly) {
  const t = now();
  if (workdayOnly) { const wd = t.getDay(), clock = hhmm(t); if (wd < 1 || wd > 5 || clock < WORK[0] || clock > WORK[1]) return null; }
  const base = lastAt ? new Date(lastAt).getTime() : new Date(t.toDateString() + ' ' + WORK[0]).getTime();
  const over = (t.getTime() - base) / 60000 - limitMin;
  return over > 0 ? over : null;
}
export const overdueStatus = (lastAt, limitMin, workdayOnly = true) => (minutesOver(lastAt, limitMin, workdayOnly) === null ? null : 'behind');

// How hard a due item pulses: 0 none, 1 just due, 2 a half hour past, 3 an hour or more past.
export function overdueLevel(lastAt, limitMin, workdayOnly = true) {
  const m = minutesOver(lastAt, limitMin, workdayOnly);
  return m === null ? 0 : m < 30 ? 1 : m < 60 ? 2 : 3;
}
// Weight: due from 6 am when nothing is logged today; stronger at 9 and at noon.
export function weightLevel(ageDays) {
  if (ageDays === 0) return 0;
  const c = hhmm(now());
  return c < '06:00' ? 0 : c < '09:00' ? 1 : c < '12:00' ? 2 : 3;
}

export const staleStatus = (ageDays) => (ageDays === 0 ? 'met' : ageDays === null || ageDays >= 1 ? 'behind' : null);
