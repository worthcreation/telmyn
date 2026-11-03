// What happened: every question about a day's events, sets and fluids is answered here, once. Today, the Day log,
// the breakdowns, This week, the pills, the handoff and the reminders all call these instead of filtering on their
// own, so a change to how something is recorded is one edit. Pure functions; nothing here reads storage.
import { FLUID_KINDS } from './schema.js';

export const isDone = (e, block) => e.type === 'block_done' && e.block === block;

// Block events: the last finish of a block (its time, start and end), or nothing.
export const doneEvent = (events, block) => [...events].reverse().find(e => isDone(e, block)) || null;

// Grip breaks: the ones logged in the app, and the day's total with any carried in from a chat handoff.
export const gripBreaks = events => events.filter(e => isDone(e, 'hourly'));
export const gripCount = (day, events) => gripBreaks(events).length + (day?.hourly_blocks_count || 0);

// Leg habits (ankle pumps, calf raises): each tap is one set.
export const habitSets = (events, key) => events.filter(e => e.type === 'habit' && e.habit === key);

// Sets by exercise. Pull sets are chin-ups or neutral-grip pull-ups; hangs are the hangs block's (not the strength
// warm-up's two short ones).
export const PULL = /^(chin_up|neutral_pullup)$/;
export const pullReps = sets => sets.filter(s => PULL.test(s.exercise) && s.reps).map(s => s.reps);
export const hangSecs = sets => sets.filter(s => s.exercise === 'dead_hang' && s.sec && !/^strength_/.test(s.block || '')).map(s => s.sec);

// Minutes and meters rowed: the row block's logged sets, or the numbers carried in from an imported handoff.
// Blank stays blank.
export function rowTotals(day, sets) {
  const sum = (ex, f) => { const r = sets.filter(s => s.exercise === ex && s[f] != null); return r.length ? r.reduce((a, s) => a + s[f], 0) : null; };
  return { min: sum('row', 'min') ?? day?.row_min ?? null, m: sum('row_dist', 'm') ?? day?.row_m ?? null };
}
// "19 min, 3,747 m", or '' when nothing was rowed.
export const rowText = r => [r.min != null ? `${r.min} min` : '', r.m != null ? `${r.m.toLocaleString('en-US')} m` : ''].filter(Boolean).join(', ');

// Fluids: the number carried in from an imported handoff (if any) plus every drink logged in the app, per bucket.
// Blank stays blank when there is neither.
export function fluidTotals(day, fluids) {
  const t = { water_oz: day?.water_oz ?? null, other_drinks_oz: day?.other_drinks_oz ?? null };
  for (const f of fluids) {
    const k = FLUID_KINDS.find(k => k.key === f.kind)?.bucket || 'other_drinks_oz';
    t[k] = Math.round(((t[k] || 0) + f.oz) * 10) / 10;
  }
  return t;
}
// All fluids as one number (null when nothing is recorded).
export function fluidOz(day, fluids) {
  const t = fluidTotals(day, fluids);
  return t.water_oz === null && t.other_drinks_oz === null ? null : Math.round(((t.water_oz || 0) + (t.other_drinks_oz || 0)) * 10) / 10;
}

// ---------- Beat your past self: one set against the same set last session ----------

// The last session of an exercise before a date: { date, rows } or null. Only sets with a number count.
export function lastSessionOf(allSets, exercise, before) {
  const prior = allSets.filter(r => r.exercise === exercise && r.date < before && (r.reps != null || r.sec != null || r.min != null || r.m != null));
  const date = prior.map(r => r.date).sort().pop();
  return date ? { date, rows: prior.filter(r => r.date === date) } : null;
}
// From that session, the same set and side, or its last set of that side when it had fewer.
export function sameSetLast(rows, set) {
  const same = (rows || []).filter(r => (r.side || 'each') === (set.side || 'each') || r.side === 'each' || !r.side);
  return same.find(r => (r.set_no || 1) === (set.set_no || 1)) || [...same].sort((a, b) => (a.set_no || 1) - (b.set_no || 1)).pop() || null;
}
// How a set compares with the ghost (that set last time) on one measure (reps or sec):
//   { result: 'up' | 'tie' | 'down', by, heavier } or null when there is nothing to compare.
// Up means more at the same weight, at least as much at a heavier weight, or full reps where last time was negatives.
// A lighter weight, or negatives where last time was full reps, never counts as up.
export function versusLast(set, ghost, field) {
  const a = set?.[field], b = ghost?.[field];
  if (a == null || a === '' || b == null) return null;
  const n = Number(a), was = Number(b), by = n - was;
  const neg = x => x?.mode === 'negative';
  if (neg(set) !== neg(ghost)) return { result: neg(ghost) && n > 0 ? 'up' : 'down', by, heavier: false, mode: true };
  const lb = set.lb ?? null, wasLb = ghost.lb ?? null;
  if (lb != null && wasLb != null && lb !== wasLb) {
    if (lb > wasLb && n >= was) return { result: 'up', by, heavier: lb - wasLb };
    return { result: 'down', by, heavier: lb > wasLb ? lb - wasLb : -(wasLb - lb) };
  }
  return { result: by > 0 ? 'up' : by === 0 ? 'tie' : 'down', by, heavier: 0 };
}
