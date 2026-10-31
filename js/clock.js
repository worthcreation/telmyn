// Single source of time. Every module asks clock.now(), never new Date() directly,
// so the separate test app can fake the date, the time and the speed of the whole app.
// Test app URL example: ?date=2026-10-29&time=06:25&speed=60 (ignored in the real app).

import { SITE } from './site.js';

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const TEST = SITE === 'test';
const speed = TEST ? Number(params.get('speed') || 1) : 1;
const realStart = Date.now();
let base = realStart;

if (TEST && (params.get('date') || params.get('time'))) {
  const d = new Date();
  if (params.get('date')) { const [y, m, dd] = params.get('date').split('-').map(Number); d.setFullYear(y, m - 1, dd); }
  if (params.get('time')) { const [h, mi] = params.get('time').split(':').map(Number); d.setHours(h, mi, 0, 0); }
  base = d.getTime();
}

export const SPEED = speed;
export const now = () => new Date(base + (Date.now() - realStart) * speed);

const pad = n => String(n).padStart(2, '0');
export const isoDate = (d = now()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hhmm = (d = now()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoDate(d); };
export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
export const weekday = iso => parseISO(iso).getDay(); // 0 Sun .. 6 Sat
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// A date for people: dayLabel('2026-10-31') = "Sat, Oct 31"; long: "Saturday, Oct 31"; year: "Sat, Oct 31, 2026".
export const dayLabel = (iso, { long = false, year = false } = {}) => parseISO(iso).toLocaleDateString('en-US', { weekday: long ? 'long' : 'short', month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) });
// The time of day of an ISO timestamp ("06:45"), or '' for none.
export const atTime = iso => (iso ? hhmm(new Date(iso)) : '');
export const fmtSec = s => s >= 60 ? `${Math.floor(s / 60)}:${pad(Math.round(s % 60))}` : `${Math.round(s)}`;
export const fmtDuration = s => s % 60 === 0 && s >= 60 ? `${s / 60} min` : (s > 60 ? `${Math.floor(s / 60)} min ${s % 60} sec` : `${s} sec`);
