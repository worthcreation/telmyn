// One place that judges the day's items: 'met', 'behind', or null (on track or not applicable).
// Pace lines run from the start of the day to its end (fluids 07:00 to 23:00, protein 07:00 to 21:00); "behind"
// means under the pace line by more than the slack. Grip, pumps and calf raises are overdue by time since the last
// one, on their days and hours. Weight is behind when nothing is logged for a day or more.
import { now, hhmm } from './clock.js';
import { minutesOver } from './reminder-rules.js';

const PACE = { fluids: ['07:00', '23:00', 15], protein: ['07:00', '21:00', 25] };
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export function paceStatus(kind, value, target) {
  if (value === null || value === undefined) value = 0;
  if (value >= target) return 'met';
  const [from, to, slack] = PACE[kind];
  const t = mins(hhmm(now()));
  const due = target * Math.min(1, Math.max(0, (t - mins(from)) / (mins(to) - mins(from))));
  return due - value > slack ? 'behind' : null;
}

// Overdue grip breaks, pumps and calf raises follow the reminder rules (js/reminder-rules.js): their days, hours
// and intervals. kind: 'grip', 'pumps' or 'calf'; lastAt: the last one logged (ISO) or nothing.
const over = (kind, lastAt) => minutesOver(kind, lastAt ? new Date(lastAt).getTime() : null, now().getTime());
export const overdueStatus = (kind, lastAt) => (over(kind, lastAt) === null ? null : 'behind');

// How hard a due item pulses: 0 none, 1 just due, 2 a half hour past, 3 an hour or more past.
export function overdueLevel(kind, lastAt) {
  const m = over(kind, lastAt);
  return m === null ? 0 : m < 30 ? 1 : m < 60 ? 2 : 3;
}
// Weight: due from 6 am when nothing is logged today; stronger at 9 and at noon.
export function weightLevel(ageDays) {
  if (ageDays === 0) return 0;
  const c = hhmm(now());
  return c < '06:00' ? 0 : c < '09:00' ? 1 : c < '12:00' ? 2 : 3;
}

export const staleStatus = (ageDays) => (ageDays === 0 ? 'met' : ageDays === null || ageDays >= 1 ? 'behind' : null);

// Grip and pumps measure against your own days: first toward your daily average, then toward your best day.
// counts: earlier days' totals (days with none are left out, so weekends without grip breaks do not drag it down).
// Returns the fill (0 to 1), the stage, and the words after today's number.
export function towardBest(n, counts) {
  const days = counts.filter(c => c > 0);
  if (!days.length) return { p: 0, stage: null, label: ' today' };
  const avg = Math.round(days.reduce((a, c) => a + c, 0) / days.length), best = Math.max(...days);
  if (n < avg) return { p: n / avg, stage: 'avg', label: ` / ${avg} avg` };
  if (n < best) return { p: (n - avg) / (best - avg), stage: 'best', label: ` / ${best} best` };
  return { p: 1, stage: 'top', label: n > best ? ' new best' : ' best' };
}
