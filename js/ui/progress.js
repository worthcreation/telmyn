// Progress tab: this week from real logs only. Bars appear only where the program sets a target.
// Spirit is shown as history, never as a score.
import { h, fill, bar, tile, plural } from './dom.js';
import * as db from '../db.js';
import { journalSheet } from './journal.js';
import { daySheet } from './day.js';
import { areaSheet } from './detail.js';
import { weightList } from './history.js';
import { fluidOz, rowTotals, pullReps, hangSecs, gripCount } from '../log.js';
import { state } from '../state.js';
import { planFor, blockStatus, PROGRAMS } from '../program/index.js';
import { addDays, weekday, WEEKDAYS } from '../clock.js';

export async function renderProgress(root) {
  const today = state.date;
  const { TARGETS } = state.plan.program.data;
  const start = PROGRAMS[0].effective;
  const monday = addDays(today, -((weekday(today) + 6) % 7));
  const dates = Array.from({ length: 7 }, (_, k) => addDays(monday, k));
  const inWeek = r => r.date >= monday && r.date <= dates[6];
  const [days, events, sets, fluids] = await Promise.all([db.all('days'), db.all('events'), db.all('sets'), db.all('fluids')]);
  const dayRec = Object.fromEntries(days.filter(inWeek).map(d => [d.date, d]));
  const ev = events.filter(inWeek), st = sets.filter(inWeek);
  const evOn = d => ev.filter(e => e.date === d);
  const done = (d, id) => { const p = planFor(d); return blockStatus(id, evOn(d), dayRec[d] || null, p) === 'done'; };

  // Week strip: blocks done per day.
  const strip = h('div', { class: 'week' }, dates.map(d => {
    const p = planFor(d);
    const n = p.blocks.filter(b => blockStatus(b.id, evOn(d), dayRec[d] || null, p)).length;
    const frac = p.blocks.length ? n / p.blocks.length : 0;
    const before = d < start;
    const open = d <= today && !before;
    return h(open ? 'button' : 'div', { class: `wk${d === today ? ' today' : ''}${d > today ? ' future' : ''}${before ? ' before' : ''}`, onclick: open ? () => daySheet(d) : null, 'aria-label': open ? `Open the log for ${d}` : null },
      h('span', { class: 'wk-d' }, WEEKDAYS[weekday(d)][0]),
      h('span', { class: 'wk-dot', style: `--p:${before ? 0 : frac}` }),
      h('span', { class: 'wk-n' }, d > today || before ? '' : `${n}/${p.blocks.length}`));
  }));

  const past = dates.filter(d => d <= today && d >= start);   // days the program was running
  const week = area => () => areaSheet(area, monday, dates[6]);
  const elapsed = Math.max(1, past.length);
  const typeOn = d => planFor(d).typeKey;
  const strengthPlanned = past.filter(d => /strength/.test(typeOn(d))).length;
  const strengthDone = past.filter(d => done(d, typeOn(d))).filter(d => /strength/.test(typeOn(d))).length;
  const rowPlanned = past.filter(d => typeOn(d) === 'row').length;
  const rowDone = past.filter(d => typeOn(d) === 'row' && done(d, 'row')).length;
  // Minutes and meters rowed this week, each day from its row block or its imported numbers (one rule: rowTotals).
  const rowed = past.map(d => rowTotals(dayRec[d] || {}, st.filter(s => s.date === d)));
  const rowMin = rowed.reduce((a, r) => a + (r.min || 0), 0), rowM = rowed.reduce((a, r) => a + (r.m || 0), 0);
  const pulls = pullReps(st), hangs = hangSecs(st);
  const hourly = past.reduce((a, d) => a + gripCount(dayRec[d], ev.filter(e => e.date === d)), 0);
  const stretchDays = past.filter(d => done(d, 'stretch')).length;
  const legsDays = past.filter(d => done(d, 'evening_legs')).length;
  const proteinDays = past.filter(d => (dayRec[d]?.protein_g || 0) >= TARGETS.protein_g[0]).length;
  const versesApplied = past.filter(d => dayRec[d]?.verse_applied_notes).length;
  // Fluids per day: imported total plus app entries. Blank days stay out of averages.
  const fluidOn = d => fluidOz(dayRec[d], fluids.filter(f => f.date === d));
  const fluidDays = past.filter(d => (fluidOn(d) || 0) >= TARGETS.fluids_oz[0]).length;
  const avg = vals => { const v = vals.filter(x => x !== null && x !== undefined); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; };
  const avgTile = (label, v, unit, n, onclick) => tile(label, v === null ? null : Math.round(v), v === null ? 'not logged' : `${unit} avg, ${plural(n, 'day')}`, onclick);
  const proteinVals = past.map(d => dayRec[d]?.protein_g ?? null), fluidVals = past.map(fluidOn), weightVals = past.map(d => dayRec[d]?.weight_lb ?? null);
  const nOf = v => v.filter(x => x !== null && x !== undefined).length;

  fill(root,
    h('header', { class: 'top' }, h('p', { class: 'date' }, `Week of ${monday}`), h('h1', { class: 'daytype' }, 'This Week')),
    strip,
    h('section', { class: 'stats' },
      bar('Strength', strengthDone, strengthPlanned || null, `${strengthDone}/${strengthPlanned} sessions${pulls.length ? `, best pull set ${Math.max(...pulls)}` : ''}`, week('strength')),
      bar('Endurance', rowDone, rowPlanned || null, `${rowDone}/${rowPlanned} rows, ${Math.round(rowMin)} min${rowM ? `, ${rowM.toLocaleString('en-US')} m` : ''}`, week('endurance')),
      bar('Grip', hangs.length ? Math.max(...hangs) : 0, 20, `${hourly} grip breaks${hangs.length ? `, best hang ${Math.max(...hangs)} sec` : ''}`, week('grip')),
      bar('Mobility', stretchDays, elapsed, `${stretchDays}/${elapsed} morning stretches`, week('mobility')),
      bar('Fuel', proteinDays, elapsed, `${proteinDays}/${elapsed} days at ${TARGETS.protein_g[0]} g protein`, week('fuel')),
      bar('Hydration', fluidDays, elapsed, `${fluidDays}/${elapsed} days at ${TARGETS.fluids_oz[0]} oz`, week('hydration')),
      bar('Recovery', legsDays, elapsed, `${legsDays}/${elapsed} evenings legs up`, week('recovery')),
      h('button', { class: 'stat spirit', onclick: journalSheet }, h('div', { class: 'stat-top' }, h('span', { class: 'stat-l' }, 'Spirit'),
        h('span', { class: 'stat-d' }, `Verse applied on ${versesApplied} of ${elapsed} days. Tap for your journal.`)))),
    h('section', { class: 'avg', 'aria-label': 'Weekly averages' },
      avgTile('Protein', avg(proteinVals), 'g', nOf(proteinVals), week('fuel')),
      avgTile('Fluids', avg(fluidVals), 'oz', nOf(fluidVals), week('hydration')),
      avgTile('Weight', avg(weightVals), 'lb', nOf(weightVals), weightList)),
    h('p', { class: 'muted small progress-hint' }, 'Tap a day for its log, or anything else for its breakdown.'));
}
