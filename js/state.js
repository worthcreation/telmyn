// Holds the day on screen. UI reads state.*, writes through these functions, then calls render().
import * as db from './db.js';
import { blankDay } from './schema.js';
import { planFor } from './program/index.js';
import { verseFor } from './verses.js';
import { now } from './clock.js';

export const state = { date: null, plan: null, verse: null, day: null, events: [], sets: [], fluids: [] };

const listeners = new Set();
export const onChange = fn => listeners.add(fn);
const emit = () => listeners.forEach(fn => fn(state));

export async function load(date) {
  state.date = date;
  state.plan = planFor(date);
  state.verse = verseFor(date);
  state.day = { ...blankDay(date), ...(await db.get('days', date)) };
  state.events = (await db.byDate('events', date)).sort((a, b) => a.at.localeCompare(b.at));
  state.sets = await db.byDate('sets', date);
  state.fluids = await db.byDate('fluids', date);
  emit();
}

const stamp = () => now().toISOString();

export async function setField(key, value) {
  state.day[key] = value;
  await db.put('days', state.day);
  emit();
}

export async function addEvent(type, data = {}) {
  const e = { date: state.date, type, at: stamp(), ...data };
  e.id = await db.put('events', e);
  state.events.push(e);
  emit();
  return e;
}

export async function addSet(row) {
  const s = { date: state.date, at: stamp(), source: 'app', ...row };
  s.id = await db.put('sets', s);
  state.sets.push(s);
  emit();
  return s;
}

export async function addFluid(kind, oz, ml = null) {
  const f = { date: state.date, at: stamp(), kind, oz, ml };
  f.id = await db.put('fluids', f);
  state.fluids.push(f);
  emit();
}

export async function undoFluid() {
  const f = state.fluids.pop();
  if (f) { await db.del('fluids', f.id); emit(); }
}

export async function addProtein(g) {
  await setField('protein_g', (state.day.protein_g || 0) + g);
}

// Import a parsed handoff: imported fields fill blanks only, app-recorded data always wins.
export async function importDay({ day, sets }) {
  const existing = (await db.get('days', day.date)) || {};
  const merged = { ...day };
  for (const [k, val] of Object.entries(existing)) if (val !== null && val !== undefined && val !== '') merged[k] = val;
  merged.handoff_raw = day.handoff_raw;
  await db.put('days', merged);
  await db.deleteWhere('sets', day.date, r => r.source === 'import');
  for (const s of sets) await db.put('sets', s);
  if (day.date === state.date) await load(day.date);
}
