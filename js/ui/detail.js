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

// One expandable row, the same everywhere. The summary says what was done; a green check marks a target met or a
// block done, a thin meter shows progress toward a target, and a green "up" tag marks a session that beat the last.
// Opened, it lists the entries as time, what, amount (the Fluids and Protein list rows), then plain lines, and any
// notes behind their own "Notes" line.
const isEnt = x => x && typeof x === 'object' && 'what' in x;
const entRow = x => h('div', { class: 'ent' }, h('span', { class: 'ent-at' }, x.at ? t(x.at) : ''), h('span', { class: 'ent-what' }, x.what), h('span', { class: 'ent-amt' }, x.amt || ''), h('span'));
function row(summary, lines, { ok = false, meter = null, tag = null, notes = null } = {}) {
  const more = (lines || []).filter(Boolean);
  const head = [h('span', { class: 'dl-text' }, ok ? h('span', { class: 'dl-ok', 'aria-label': 'done' }, '✓') : null, summary),
    tag ? h('span', { class: 'dl-tag' }, tag) : null];
  const bar = meter ? h('div', { class: `stat-bar${meter[0] >= meter[1] ? ' met' : ''}` }, h('span', { style: `--p:${Math.min(1, meter[0] / meter[1])}` })) : null;
  if (!more.length && !notes) return h('div', { class: 'dl-row' }, h('div', { class: 'dl-sum' }, ...head), bar);
  return h('details', { class: 'dl-row' }, h('summary', { class: 'dl-sum' }, ...head), bar,
    h('div', { class: 'dl-more' },
      more.some(isEnt) ? h('div', { class: 'entries dl-ents' }, more.filter(isEnt).map(entRow)) : null,
      more.filter(x => !isEnt(x)).map(l => h('p', {}, l)),
      notes ? h('details', { class: 'dl-notes' }, h('summary', {}, 'Notes'), h('p', {}, notes)) : null));
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
// The next step for one exercise, short enough to read at a glance: { name, step, rule }. rule marks steps that come
// from the progression rules (they sort first); "beat" steps are first sessions with nothing to compare yet.
export function pushTip(ex, rows, prev, EX) {
  const name = EX[ex]?.name || ex;
  const tip = (step, rule = true) => ({ name, step, rule });
  if (ex === 'dead_hang') {
    const best = Math.max(...rows.map(r => r.sec || 0));
    if (!prev) return tip(`Beat ${best} sec`, false);
    const was = Math.max(...prev.rows.map(r => r.sec || 0));
    return tip(best > was ? `Up ${best - was} sec. Keep it active` : best === was ? `Add 2-3 sec to the first hang` : `${was - best} sec under. Grip may be tired`);
  }
  if (ex === 'row') return tip('20 min after 3 weeks of easy 15s');
  // Per-side exercises count one side, so 10 a leg reads as 10, not 20.
  const oneSide = list => (list.some(r => r.side === 'L' || r.side === 'R') ? list.filter(r => r.side === (list.some(x => x.side === 'L') ? 'L' : 'R')) : list);
  rows = oneSide(rows); if (prev) prev = { ...prev, rows: oneSide(prev.rows) };
  const reps = rows.map(r => r.reps || 0), best = Math.max(...reps), sum = total(rows);
  const lb = Math.max(0, ...rows.map(r => r.lb ?? EX[ex]?.weight_lb ?? 0)) || null;
  const side = rows.some(r => r.side) ? ' a side' : '';
  if (lb && best >= 30) return tip(`${best} reps at ${lb} lb: go heavier`);
  if (/pullup|chin_up/.test(ex)) {
    const negs = rows.filter(r => r.mode === 'negative').length;
    if (negs) return tip(`Turn ${negs === 1 ? 'a negative' : `${negs} negatives`} into full reps`);
    const flat = reps.length === 3 && reps.every(r => r === reps[0]);
    const prevReps = prev?.rows.filter(r => r.mode !== 'negative').map(r => r.reps) || [];
    if (flat && prevReps.length === 3 && prevReps.every(r => r === reps[0])) return tip('Add a rep to one set');
  }
  if (!prev) return tip(`Beat ${sum}${side}${lb ? ` at ${lb} lb` : ''}`, false);
  const diff = sum - total(prev.rows);
  if (diff > 0) return tip(`Up ${diff}${side}. Keep building`);
  if (diff === 0) return tip('Same as last. +1 on set 1');
  return tip(`${-diff} under last. Form first`);
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
    return row(`${label}${st2 === 'done' ? '' : st2 === 'skip' ? ' skipped' : ` ${st2}`}`, [e ? span(e.started_at, e.done_at || e.at) : null], { ok: st2 === 'done' });
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
      if (ex !== 'scap_pullup' && !(ex === 'dead_hang' && blockId !== 'hangs')) tips.push({ ex, ...pushTip(ex, rows, lastSession(data.allSets, ex, date), EX) });
      const lbs = [...new Set(rows.filter(r => r.lb != null).map(r => r.lb))];
      // Beat last time? Same count as the next-time step uses (one side for per-side work).
      const last = lastSession(data.allSets, ex, date);
      const one = list => (list.some(r => r.side === 'L') ? list.filter(r => r.side === 'L') : list);
      const amount = list => one(list).reduce((a, r) => a + (r[field] || 0), 0);
      const gain = last ? amount(rows) - amount(last.rows) : 0;
      return row(`${EX[ex]?.name || ex}, ${plural(sets, 'set')}`, [`${setLine(rows, field)} ${UNIT[field]}${lbs.length ? ` at ${lbs.join(' / ')} lb` : ''}`, times.length ? (times.length > 1 ? `${t(times[0])} to ${t(times[times.length - 1])}` : t(times[0])) : null],
        { tag: gain > 0 ? `up ${gain}` : null });
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
    if (n) out.push(row(plural(n, 'grip break'), breaks.map(e => ({ at: e.done_at || e.at, what: 'Grip break', amt: `palms ${e.palms || '?'}` })), { notes: rec.hourly_palm_notes }));
    out.push(blockRow('hangs', 'Dead hangs'));
    out.push(...exerciseRows('hangs'));
  } else if (area === 'mobility') {
    out.push(row(`Morning stretch${status('stretch') === 'done' ? '' : ` ${status('stretch') || 'not done'}`}`, [doneEv('stretch') ? span(doneEv('stretch').started_at, doneEv('stretch').done_at) : null, rec.toe_touch_notes ? `Toe touch: ${rec.toe_touch_notes}` : null], { ok: status('stretch') === 'done' }));
  } else if (area === 'fuel') {
    const target = plan.program.data.TARGETS.protein_g[0], g = rec.protein_g || 0;
    const timed = ev.filter(e => (e.type === 'protein' || e.type === 'food') && e.protein_g);
    // Notes without the food lines older versions copied into them (the food entries already show those).
    let notes = rec.eating_notes || '';
    for (const e of timed) if (e.line) notes = notes.replace(e.line, '');
    notes = notes.replace(/\s{2,}/g, ' ').trim();
    out.push(row(`Protein ${Math.round(g)} of ${target} g`, timed.map(e => ({ at: e.at, what: e.type === 'food' ? (foodByKey(e.food)?.label || 'Food') : 'Added', amt: `${Math.round(e.protein_g)} g` })),
      { ok: g >= target, meter: [g, target], notes: notes || null }));
  } else if (area === 'hydration') {
    const target = plan.program.data.TARGETS.fluids_oz[0], ft = fluidTotals(rec, fl);
    const oz = round((ft.water_oz || 0) + (ft.other_drinks_oz || 0));
    out.push(row(`Fluids ${oz} of ${target} oz`, [...fl].sort((a, b) => (a.at || '').localeCompare(b.at || '')).map(f => ({ at: f.at, what: FLUID_KINDS.find(k => k.key === f.kind)?.label || f.kind, amt: `${f.oz} oz` })),
      { ok: oz >= target, meter: [oz, target], notes: rec.drinks_notes }));
  } else if (area === 'recovery') {
    out.push(blockRow('evening_legs', 'Legs up'));
    const pumps = ev.filter(e => e.type === 'habit' && e.habit === 'ankle_pumps');
    if (pumps.length) out.push(row(`Ankle pumps, ${plural(pumps.length, 'set')}`, pumps.map(e => ({ at: e.at, what: 'Ankle pumps', amt: '20 a foot' }))));
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
  const seen = new Set();
  // Newest session of each exercise only (days were read newest first); rule-based steps first.
  const push = tips.filter(x => !seen.has(x.ex) && seen.add(x.ex)).sort((a, b) => b.rule - a.rule);
  const group = { fuel: 'Fuel', hydration: 'Fuel', recovery: 'Body' }[area] || 'Day';
  fill(body,
    // Read at a glance: the same name-and-detail rows as This week, one per exercise.
    push.length ? h('section', { class: 'dl-push card' }, h('p', { class: 'lbl' }, 'Next time'),
      push.map(x => h('div', { class: 'stat-top' }, h('span', { class: 'dl-ex' }, x.name), h('span', { class: 'stat-d' }, x.step)))) : null,
    list,
    single ? h('button', { class: 'btn ghost', onclick: () => logSheet(from, group) }, 'Edit this day') : null);
}
