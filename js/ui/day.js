// Day view: one day in the same look as This week (circles for the blocks, bars against the targets, tiles), with
// arrows to step between days. Every circle, bar and tile opens its breakdown for this day; "Edit this day" opens the full form.
import { h, fill, sheet } from './dom.js';
import { state } from '../state.js';
import { dayRecord } from '../sync.js';
import { planFor, blockStatus, PROGRAMS, legHabit } from '../program/index.js';
import { fluidTotals, rowTotals } from '../schema.js';
import { addDays, hhmm } from '../clock.js';
import { logSheet } from './forms.js';
import { areaSheet, BLOCK_AREA } from './detail.js';
import { weightList } from './history.js';
import { journalSheet } from './journal.js';

const pretty = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }); };
const STATUS = { done: 1, partial: .5, skip: 0 };

function bar(label, value, target, detail, onclick) {
  const p = target ? Math.min(1, value / target) : null;
  return h(onclick ? 'button' : 'div', { class: 'stat', onclick },
    h('div', { class: 'stat-top' }, h('span', { class: 'stat-l' }, label), h('span', { class: 'stat-d' }, detail)),
    p === null ? null : h('div', { class: `stat-bar${p >= 1 ? ' met' : ''}` }, h('span', { style: `--p:${p}` })));
}
const tile = (label, v, sub, onclick) => h('button', { class: 'tile', onclick }, h('span', { class: 'tile-l' }, label), h('b', {}, v ?? '–'), h('small', {}, sub));

export function daySheet(date = state.date) {
  const body = h('div', { class: 'dayview' });
  let d = date;
  const draw = async () => {
    const { day, events, sets, fluids } = await dayRecord(d);
    const plan = planFor(d), { TARGETS } = plan.program.data;
    const lastAt = id => [...events].reverse().find(e => e.block === id && e.type === 'block_done')?.at;
    const circles = h('div', { class: 'week dayblocks', style: `--n:${plan.blocks.length}` }, plan.blocks.map(b => {
      const st = blockStatus(b.id, events, day, plan), at = lastAt(b.id);
      return h('button', { class: 'wk', onclick: () => areaSheet(BLOCK_AREA[b.id] || 'recovery', d), 'aria-label': `${b.name}: open its breakdown` },
        h('span', { class: 'wk-d' }, b.name),
        h('span', { class: 'wk-dot', style: `--p:${STATUS[st] ?? 0}` }),
        h('span', { class: 'wk-n' }, st === 'done' ? (at ? hhmm(new Date(at)) : 'done') : st === 'skip' ? 'skipped' : st === 'partial' ? 'partial' : ''));
    }));
    const routineId = plan.program.data.DAY_TYPES[plan.typeKey]?.routine;
    const routine = routineId ? plan.blocks.find(b => b.id === routineId) : null;
    const routineSt = routine ? blockStatus(routine.id, events, day, plan) : null;
    const pulls = sets.filter(s => /chin_up|neutral_pullup/.test(s.exercise) && s.reps).map(s => s.reps);
    const hangs = sets.filter(s => s.exercise === 'dead_hang' && s.sec).map(s => s.sec);
    const grips = events.filter(e => e.type === 'block_done' && e.block === 'hourly').length || day.hourly_blocks_count || 0;
    const leg = legHabit(d), legN = leg ? events.filter(e => e.type === 'habit' && e.habit === leg.key).length : 0;
    const rowed = rowTotals(day, sets);
    const rowText = [rowed.min != null ? `${rowed.min} min` : '', rowed.m != null ? `${rowed.m} m` : ''].filter(Boolean).join(', ');
    const ft = fluidTotals(day, fluids), oz = Math.round(((ft.water_oz || 0) + (ft.other_drinks_oz || 0)) * 10) / 10;
    const protein = day.protein_g || 0;
    const open = area => () => areaSheet(area, d);
    fill(body,
      h('div', { class: 'dv-nav' },
        h('button', { class: 'icon-btn', 'aria-label': 'Previous day', disabled: d <= PROGRAMS[0].effective, onclick: () => { d = addDays(d, -1); draw(); } }, '‹'),
        h('div', { class: 'dv-title' }, h('b', {}, pretty(d)), h('span', {}, `${plan.typeLabel}, Week ${plan.week}, Day ${plan.day}`)),
        h('button', { class: 'icon-btn', 'aria-label': 'Next day', disabled: d >= state.date, onclick: () => { d = addDays(d, 1); draw(); } }, '›')),
      circles,
      h('section', { class: 'stats' },
        routine ? bar(routine.name, STATUS[routineSt] ?? 0, 1, `${routineSt === 'done' ? 'done' : routineSt || 'not yet'}${pulls.length ? `, pull sets ${pulls.join(' / ')}` : ''}${rowText ? `, ${rowText}` : ''}`, open(BLOCK_AREA[routine.id] || 'strength')) : null,
        bar('Grip', hangs.length ? Math.max(...hangs) : 0, 20, `${grips} grip break${grips === 1 ? '' : 's'}${hangs.length ? `, hangs ${hangs.join(' / ')} sec` : ''}`, open('grip')),
        bar('Fuel', protein, TARGETS.protein_g[0], `${Math.round(protein * 10) / 10} of ${TARGETS.protein_g[0]} g protein`, open('fuel')),
        bar('Hydration', oz, TARGETS.fluids_oz[0], `${oz} of ${TARGETS.fluids_oz[0]} oz`, open('hydration')),
        h('button', { class: 'stat spirit', onclick: journalSheet }, h('div', { class: 'stat-top' }, h('span', { class: 'stat-l' }, 'Spirit'),
          h('span', { class: 'stat-d dv-note' }, day.verse_applied_notes || 'No note yet. Tap for your journal.')))),
      h('section', { class: 'avg' },
        tile('Weight', day.weight_lb ?? null, 'lb', weightList),
        tile(leg?.short || 'Pumps', String(legN), 'sets', open('recovery')),
        tile('Sleep', day.bed_time || null, day.wake_time ? `to ${day.wake_time}` : 'not logged', open('recovery'))),
      h('button', { class: 'btn ghost', onclick: () => logSheet(d) }, 'Edit this day'));
  };
  draw();
  sheet('Day', body, { full: true });
}
