// Breakdowns: tap any part of This week or a Day log and it opens here, at the level you were on. A week shows each
// day of that area; a day shows that area's parts. Rows say only what was done; tap a row for its sets, reps and
// times. Strength, Endurance and Grip end with how to push next time, worked out from your own last session.
import { h, fill, sheet } from './dom.js';
import * as db from '../db.js';
import { state } from '../state.js';
import { planFor, blockStatus, PROGRAMS } from '../program/index.js';
import { fluidTotals, FLUID_KINDS } from '../schema.js';
import { addDays, hhmm, weekday, WEEKDAYS } from '../clock.js';
import { foodByKey } from '../foods.js';

export const AREAS = {
  strength: 'Strength', endurance: 'Endurance', grip: 'Grip', mobility: 'Mobility',
  fuel: 'Fuel', hydration: 'Hydration', recovery: 'Recovery',
};
// Which area a block belongs to, so a block's circle opens the right breakdown.
export const BLOCK_AREA = { stretch: 'mobility', gates: 'strength', strength_a: 'strength', strength_b: 'strength', row: 'endurance', hangs: 'grip', hourly: 'grip', evening_legs: 'recovery', walk: 'endurance' };

const t = iso => (iso ? hhmm(new Date(iso)) : '');
const span = (a, b) => (a && b ? `${t(a)} to ${t(b)}, ${Math.max(1, Math.round((new Date(b) - new Date(a)) / 60000))} min` : b ? `finished ${t(b)}` : '');
const dayName = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }); };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const round = n => Math.round(n * 10) / 10;

// One expandable row: the summary always shows; the detail lines only when opened.
function row(summary, lines, extra = null) {
  const more = (lines || []).filter(Boolean);
  if (!more.length && !extra) return h('div', { class: 'dl-row' }, h('span', { class: 'dl-sum' }, summary));
  return h('details', { class: 'dl-row' }, h('summary', { class: 'dl-sum' }, summary),
    h('div', { class: 'dl-more' }, more.map(l => h('p', {}, l)), extra));
}

async function load(from, to) {
  const inRange = r => r.date >= from && r.date <= to;
  const [days, events, sets, fluids] = await Promise.all(['days', 'events', 'sets', 'fluids'].map(s => db.all(s)));
  return { days: Object.fromEntries(days.filter(inRange).map(d => [d.date, d])), events: events.filter(inRange), sets: sets.filter(inRange), allSets: sets, fluids: fluids.filter(inRange) };
}

// ---------- How to push: from the program's progression rules and your previous session ----------

const total = rows => rows.reduce((a, r) => a + (r.reps || 0), 0);
function lastSession(allSets, ex, before) {
  const prior = allSets.filter(s => s.exercise === ex && s.date < before && (s.reps || s.sec || s.min));
  if (!prior.length) return null;
  const date = prior.map(s => s.date).sort().pop();
  return { date, rows: prior.filter(s => s.date === date) };
}
export function pushTip(ex, rows, prev, EX) {   // rows and prev are reassigned below for per-side work
  const full = EX[ex]?.name || ex, name = full[0].toLowerCase() + full.slice(1);   // "single-leg RDL", not "rdl"
  if (ex === 'dead_hang') {
    const best = Math.max(...rows.map(r => r.sec || 0));
    if (!prev) return `Best hang ${best} sec. That is the hold to beat.`;
    const was = Math.max(...prev.rows.map(r => r.sec || 0));
    return best > was ? `Best hang up ${best - was} sec from last time. Stay active: shoulders down, ribs down.` : best === was ? `Matched your best of ${best} sec. Add 2-3 sec to the first hang next time.` : `Best hang ${best} sec, ${was - best} under last time. Grip may be tired from grip breaks; keep the form.`;
  }
  if (ex === 'row') {
    const min = rows.reduce((a, r) => a + (r.min || 0), 0);
    return `${min} min rowed. Program step: after 3 weeks of comfortable 15 min sessions, move to 20 min or one interval day.`;
  }
  // Per-side exercises count one side (the left, or whichever was logged), so 10 a leg reads as 10, not 20.
  const oneSide = list => (list.some(r => r.side === 'L' || r.side === 'R') ? list.filter(r => r.side === (list.some(x => x.side === 'L') ? 'L' : 'R')) : list);
  rows = oneSide(rows); if (prev) prev = { ...prev, rows: oneSide(prev.rows) };
  const reps = rows.map(r => r.reps || 0), best = Math.max(...reps), sum = total(rows);
  const w = EX[ex]?.weight_lb;
  if (w && best >= 30) return `${best} clean reps on ${name}: ${w} lb is now too light for this one. Time for the next step up.`;
  if (/pullup|chin_up/.test(ex)) {
    const negs = rows.filter(r => r.mode === 'negative').length;
    if (negs) return `${plural(negs, 'set')} of negatives builds the pull. Next time, turn one of those into a full rep.`;
    const flat = reps.length === 3 && reps.every(r => r === reps[0]);
    const prevReps = prev?.rows.filter(r => r.mode !== 'negative').map(r => r.reps) || [];
    if (flat && prevReps.length === 3 && prevReps.every(r => r === reps[0])) return `All 3 sets at ${reps[0]} two sessions running. Add a rep to one set next time.`;
  }
  if (!prev) return `First ${name} on record: ${sum} reps${rows.some(r => r.side) ? ' a side' : ''}. That is the number to beat.`;
  const was = total(prev.rows), diff = sum - was;
  if (diff > 0) return `Up ${diff} rep${diff === 1 ? '' : 's'} on ${name} from last time.${w ? ` Best set ${best} of the 30 that means a heavier step.` : ''}`;
  if (diff === 0) return `Same ${sum} reps on ${name} as last time. One more rep in the first set moves it up.`;
  return `${-diff} under last time on ${name}. Recovery and form first; it still counts.`;
}

// ---------- One day of an area: rows, plus tips where they apply ----------

const setLine = (rows, field = 'reps') => {
  const bySet = {};
  for (const r of rows) (bySet[r.set_no || 1] ||= []).push(r);
  return Object.keys(bySet).sort((a, b) => a - b).map(k => bySet[k].map(r => `${r.side && r.side !== 'each' ? r.side : ''}${r[field]}${r.mode === 'negative' ? ' neg' : ''}`).join(' ')).join(' / ');
};
const UNIT = { reps: 'reps', sec: 'sec', min: 'min' };
const fieldOf = rows => (rows.some(r => r.sec) ? 'sec' : rows.some(r => r.min) ? 'min' : 'reps');

function dayArea(area, date, data, tips) {
  const plan = planFor(date), EX = plan.program.data.EXERCISES, rec = data.days[date] || {};
  const ev = data.events.filter(e => e.date === date), st = data.sets.filter(s => s.date === date), fl = data.fluids.filter(f => f.date === date);
  const status = id => blockStatus(id, ev, rec, plan);
  const doneEv = id => [...ev].reverse().find(e => e.block === id && e.type === 'block_done');
  const blockRow = (id, label) => {
    const st2 = status(id);
    if (!st2) return null;
    const e = doneEv(id);
    return row(`${label} ${st2 === 'done' ? 'done' : st2 === 'skip' ? 'skipped' : st2}`, [e ? span(e.started_at, e.done_at || e.at) : null]);
  };
  // Every logged exercise in a block, in program order, each with its sets behind a tap.
  const exerciseRows = (blockId, filter = () => true) => {
    const order = (plan.program.data.BLOCKS[blockId]?.steps || []).filter(s => s.kind === 'set').map(s => s.exercise);
    const used = [...new Set(order)].filter(ex => st.some(s => s.exercise === ex && s.block === blockId && filter(s)));
    // Imported days have no block on their sets; show them under the routine.
    const loose = [...new Set(st.filter(s => !s.block && order.includes(s.exercise) && (s.exercise !== 'dead_hang' || blockId === 'hangs')).map(s => s.exercise))].filter(ex => !used.includes(ex));
    return [...used, ...loose].map(ex => {
      const rows = st.filter(s => s.exercise === ex && (s.block === blockId || !s.block) && filter(s));
      const field = fieldOf(rows);
      const sets = new Set(rows.map(r => r.set_no || 1)).size;
      const times = rows.map(r => r.at).filter(Boolean).sort();
      if (ex !== 'scap_pullup' && !(ex === 'dead_hang' && blockId !== 'hangs')) tips.push({ ex, text: pushTip(ex, rows, lastSession(data.allSets, ex, date), EX) });
      return row(`${EX[ex]?.name || ex}, ${plural(sets, 'set')}`, [`${setLine(rows, field)} ${UNIT[field]}`, times.length ? (times.length > 1 ? `${t(times[0])} to ${t(times[times.length - 1])}` : t(times[0])) : null]);
    });
  };
  const routine = plan.program.data.DAY_TYPES[plan.typeKey]?.routine;
  const out = [];
  if (area === 'strength') {
    out.push(blockRow('gates', 'Fab Five'));
    if (/strength/.test(routine || '')) { out.push(blockRow(routine, plan.blocks.find(b => b.id === routine)?.name)); out.push(...exerciseRows(routine)); }
  } else if (area === 'endurance') {
    if (routine === 'row') { out.push(blockRow('row', 'Row')); out.push(...exerciseRows('row')); if (!st.some(s => s.exercise === 'row') && rec.row_min) out.push(row(`Rowed ${rec.row_min} min`, [])); }
    out.push(blockRow('walk', 'Walk'));
  } else if (area === 'grip') {
    const breaks = ev.filter(e => e.type === 'block_done' && e.block === 'hourly');
    const n = breaks.length + (rec.hourly_blocks_count || 0);
    if (n) out.push(row(plural(n, 'grip break'), [...breaks.map(e => `${t(e.done_at || e.at)}, palms ${e.palms || 'not noted'}`), rec.hourly_palm_notes ? `Earlier: ${rec.hourly_palm_notes}` : null]));
    out.push(blockRow('hangs', 'Dead hangs'));
    out.push(...exerciseRows('hangs'));
  } else if (area === 'mobility') {
    out.push(row(`Morning stretch ${status('stretch') === 'done' ? 'done' : status('stretch') || 'not done'}`, [doneEv('stretch') ? span(doneEv('stretch').started_at, doneEv('stretch').done_at) : null, rec.toe_touch_notes ? `Toe touch: ${rec.toe_touch_notes}` : null]));
  } else if (area === 'fuel') {
    const target = plan.program.data.TARGETS.protein_g[0], g = rec.protein_g || 0;
    const timed = ev.filter(e => (e.type === 'protein' || e.type === 'food') && e.protein_g);
    out.push(row(g >= target ? `Protein met, ${round(g)} g` : `Protein ${round(g)} of ${target} g`, [...timed.map(e => `${t(e.at)}, ${e.type === 'food' ? (foodByKey(e.food)?.label || 'Food') : 'Added'} ${e.protein_g} g`), rec.eating_notes]));
  } else if (area === 'hydration') {
    const target = plan.program.data.TARGETS.fluids_oz[0], ft = fluidTotals(rec, fl);
    const oz = round((ft.water_oz || 0) + (ft.other_drinks_oz || 0));
    out.push(row(oz >= target ? `Fluids met, ${oz} oz` : `Fluids ${oz} of ${target} oz`, [...[...fl].sort((a, b) => (a.at || '').localeCompare(b.at || '')).map(f => `${t(f.at)}, ${FLUID_KINDS.find(k => k.key === f.kind)?.label || f.kind} ${f.oz} oz`), rec.drinks_notes]));
  } else if (area === 'recovery') {
    out.push(blockRow('evening_legs', 'Legs up'));
    const pumps = ev.filter(e => e.type === 'habit' && e.habit === 'ankle_pumps');
    if (pumps.length) out.push(row(`Ankle pumps ${plural(pumps.length, 'time')}`, [pumps.map(e => t(e.at)).join(', ')]));
    if (rec.bed_time || rec.wake_time) out.push(row(`Sleep ${rec.bed_time || '?'} to ${rec.wake_time || '?'}`, []));
  }
  return out.filter(Boolean);
}

// ---------- The sheet ----------

// area: a key of AREAS. from/to: one date for a day, or the week's range.
export async function areaSheet(area, from, to = from) {
  const body = h('div', { class: 'dl' }, h('p', { class: 'muted small' }, 'Loading…'));
  const single = from === to;
  sheet(single ? `${AREAS[area]}, ${dayName(from).split(',')[0]}` : `${AREAS[area]} this week`, body, { full: true });
  const start = PROGRAMS[0].effective, end = to > state.date ? state.date : to;
  const data = await load(from, end);
  const dates = [];
  for (let d = from; d <= end; d = addDays(d, 1)) if (d >= start) dates.push(d);
  const tips = [];
  const list = h('div', { class: 'dl-list' });
  let any = false;
  const { daySheet } = await import('./day.js');
  const { logSheet } = await import('./forms.js');
  for (const d of [...dates].reverse()) {
    const rows = dayArea(area, d, data, tips);
    if (single) { list.append(...rows); any = rows.length > 0; continue; }
    if (!rows.length) continue;
    any = true;
    list.append(h('button', { class: 'dl-day', onclick: () => daySheet(d) }, `${WEEKDAYS[weekday(d)]}, ${planFor(d).typeLabel}`, h('span', {}, 'Day log ›')), ...rows);
  }
  if (!any) list.append(h('p', { class: 'muted small' }, single ? 'Nothing logged here for this day yet.' : 'Nothing logged here this week yet.'));
  // Newest session of each exercise only (days were read newest first).
  const seen = new Set();
  // Rule-based steps first (negatives, add a rep, weight too light, up or down from last time); first records last.
  const push = tips.filter(x => !seen.has(x.ex) && seen.add(x.ex)).map(x => x.text).sort((a, b) => a.startsWith('First') - b.startsWith('First'));
  const group = { fuel: 'Fuel', hydration: 'Fuel', recovery: 'Body' }[area] || 'Day';
  fill(body,
    // One step shows; the rest open from the card, so the list below keeps the room.
    push.length ? (push.length === 1
      ? h('div', { class: 'dl-push card' }, h('p', { class: 'lbl' }, single ? 'Next time' : 'Latest sessions'), h('p', {}, push[0]))
      : h('details', { class: 'dl-push card' }, h('summary', {}, h('span', { class: 'lbl' }, `${single ? 'Next time' : 'Latest sessions'}, ${push.length} steps`), h('p', {}, push[0])), push.slice(1).map(x => h('p', {}, x)))) : null,
    list,
    single ? h('button', { class: 'btn ghost', onclick: () => logSheet(from, group) }, 'Edit this day') : null);
}
