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

export function overdueStatus(lastAt, limitMin, workdayOnly = true) {
  const t = now();
  if (workdayOnly) { const wd = t.getDay(), clock = hhmm(t); if (wd < 1 || wd > 5 || clock < WORK[0] || clock > WORK[1]) return null; }
  const base = lastAt ? new Date(lastAt).getTime() : new Date(t.toDateString() + ' ' + WORK[0]).getTime();
  return t.getTime() - base > limitMin * 60000 ? 'behind' : null;
}

export const staleStatus = (ageDays) => (ageDays === 0 ? 'met' : ageDays === null || ageDays >= 1 ? 'behind' : null);
