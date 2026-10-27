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

// The next block is the first one with no done or skipped event today.
export function nextBlock(plan, events) {
  const closed = new Set(events.filter(e => e.type === 'block_done' || e.type === 'block_skip').map(e => e.block));
  return plan.blocks.find(b => !closed.has(b.id)) || null;
}

export function blockStatus(blockId, events) {
  const e = [...events].reverse().find(e => e.block === blockId && ['block_done', 'block_skip', 'block_partial'].includes(e.type));
  return e ? e.type.replace('block_', '') : null;
}
