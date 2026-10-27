// Picks the program version in effect for a date and builds that day's plan.
import * as v1 from './v1.js';
import { weekday, daysBetween } from '../clock.js';

export const PROGRAMS = [
  { version: 'v1', effective: '2026-10-27', weekOneMonday: '2026-10-26', data: v1 },
];

export function programFor(iso) {
  const p = [...PROGRAMS].reverse().find(p => iso >= p.effective) || PROGRAMS[0];
  return p;
}

export function weekAndDay(iso) {
  const p = programFor(iso);
  return {
    version: p.version,
    week: Math.floor(daysBetween(p.weekOneMonday, iso) / 7) + 1,
    day: daysBetween(p.effective, iso) + 1,
  };
}

export function planFor(iso) {
  const p = programFor(iso);
  const { BLOCKS, DAY_TYPES, SCHEDULE, DEFAULT_TIMING } = p.data;
  const wd = weekday(iso);
  const workday = wd >= 1 && wd <= 5;
  const typeKey = SCHEDULE[wd];
  const type = DAY_TYPES[typeKey];
  const timing = workday ? DEFAULT_TIMING.workday : DEFAULT_TIMING.weekend;

  const order = ['stretch', 'gates'];
  if (type.routine) order.push(type.routine);
  order.push('hangs', 'evening_legs');

  const blocks = order.map(id => ({
    id,
    ...BLOCKS[id],
    mode: timing[id]?.mode || 'open',
    time: timing[id]?.time || null,
  }));

  return {
    date: iso,
    ...weekAndDay(iso),
    typeKey,
    typeLabel: type.label,
    workday,
    blocks,
    hourly: workday ? { id: 'hourly', ...BLOCKS.hourly } : null,
    program: p,
  };
}

// Status lines from an imported handoff count as closed blocks (the app had no events for them).
function importedStatus(blockId, day, plan) {
  if (!day) return null;
  const routine = plan?.blocks.find(b => !['stretch', 'gates', 'hangs', 'evening_legs'].includes(b.id))?.id;
  const raw = { stretch: day.stretch_status, gates: day.fab_five_status, [routine]: day.routine_status }[blockId];
  return { done: 'done', skipped: 'skip', partial: 'partial' }[(raw || '').toLowerCase()] || null;
}

export function blockStatus(blockId, events, day = null, plan = null) {
  const e = [...events].reverse().find(e => e.block === blockId && ['block_done', 'block_skip', 'block_partial'].includes(e.type));
  return e ? e.type.replace('block_', '') : importedStatus(blockId, day, plan);
}

// The next block is the first one not yet done, skipped or marked partial.
export function nextBlock(plan, events, day = null) {
  return plan.blocks.find(b => !blockStatus(b.id, events, day, plan)) || null;
}
