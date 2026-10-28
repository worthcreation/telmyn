// Progress tab: this week from real logs only. Bars appear only where the program sets a target.
// Spirit is shown as history, never as a score.
import { h, fill } from './dom.js';
import * as db from '../db.js';
import { journalSheet } from './journal.js';
import { logSheet } from './forms.js';
import { fluidTotals } from '../schema.js';
import { state } from '../state.js';
import { planFor, blockStatus, PROGRAMS } from '../program/index.js';
import { addDays, weekday, WEEKDAYS } from '../clock.js';

function bar(label, value, target, detail) {
  const p = target ? Math.min(1, value / target) : null;
  return h('div', { class: 'stat' },
    h('div', { class: 'stat-top' }, h('span', { class: 'stat-l' }, label), h('span', { class: 'stat-d' }, detail)),
    p === null ? null : h('div', { class: `stat-bar${p >= 1 ? ' met' : ''}` }, h('span', { style: `--p:${p}` })));
}

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
    return h(open ? 'button' : 'div', { class: `wk${d === today ? ' today' : ''}${d > today ? ' future' : ''}${before ? ' before' : ''}`, onclick: open ? () => logSheet(d) : null, 'aria-label': open ? `Open the log for ${d}` : null },
      h('span', { class: 'wk-d' }, WEEKDAYS[weekday(d)][0]),
      h('span', { class: 'wk-dot', style: `--p:${before ? 0 : frac}` }),
      h('span', { class: 'wk-n' }, d > today || before ? '' : `${n}/${p.blocks.length}`));
  }));

  const past = dates.filter(d => d <= today && d >= start);   // days the program was running
  const elapsed = Math.max(1, past.length);
  const typeOn = d => planFor(d).typeKey;
  const strengthPlanned = past.filter(d => /strength/.test(typeOn(d))).length;
  const strengthDone = past.filter(d => done(d, typeOn(d))).filter(d => /strength/.test(typeOn(d))).length;
  const rowPlanned = past.filter(d => typeOn(d) === 'row').length;
  const rowDone = past.filter(d => typeOn(d) === 'row' && done(d, 'row')).length;
  const rowMin = st.filter(s => s.exercise === 'row').reduce((a, s) => a + (s.min || 0), 0) || past.reduce((a, d) => a + (dayRec[d]?.row_min || 0), 0);
  const pulls = st.filter(s => /chin_up|neutral_pullup/.test(s.exercise) && s.reps).map(s => s.reps);
  const hangs = st.filter(s => s.exercise === 'dead_hang' && s.sec).map(s => s.sec);
  const hourly = ev.filter(e => e.block === 'hourly' && e.type === 'block_done').length + past.reduce((a, d) => a + (dayRec[d]?.hourly_blocks_count || 0), 0);
  const stretchDays = past.filter(d => done(d, 'stretch')).length;
  const legsDays = past.filter(d => done(d, 'evening_legs')).length;
  const proteinDays = past.filter(d => (dayRec[d]?.protein_g || 0) >= TARGETS.protein_g[0]).length;
  const versesApplied = past.filter(d => dayRec[d]?.verse_applied_notes).length;
  // Fluids per day: imported total plus app entries. Blank days stay out of averages.
  const fluidOn = d => { const t = fluidTotals(dayRec[d] || {}, fluids.filter(f => f.date === d)); return t.water_oz === null && t.other_drinks_oz === null ? null : (t.water_oz || 0) + (t.other_drinks_oz || 0); };
  const fluidDays = past.filter(d => (fluidOn(d) || 0) >= TARGETS.fluids_oz[0]).length;
  const avg = vals => { const v = vals.filter(x => x !== null && x !== undefined); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; };
  const avgTile = (label, v, unit, n) => h('div', { class: 'avg-tile' }, h('span', { class: 'avg-l' }, label), h('b', {}, v === null ? '–' : `${Math.round(v)}`), h('small', {}, v === null ? 'not logged' : `${unit} avg, ${n} day${n === 1 ? '' : 's'}`));
  const proteinVals = past.map(d => dayRec[d]?.protein_g ?? null), fluidVals = past.map(fluidOn), weightVals = past.map(d => dayRec[d]?.weight_lb ?? null);
  const nOf = v => v.filter(x => x !== null && x !== undefined).length;

  fill(root,
    h('header', { class: 'top' }, h('div', { class: 'top-text' }, h('h1', { class: 'daytype' }, 'This week'), h('p', { class: 'date' }, `Week of ${monday}`))),
    strip,
    h('section', { class: 'stats' },
      bar('Strength', strengthDone, strengthPlanned || null, `${strengthDone}/${strengthPlanned} sessions${pulls.length ? `, best pull set ${Math.max(...pulls)}` : ''}`),
      bar('Endurance', rowDone, rowPlanned || null, `${rowDone}/${rowPlanned} rows, ${Math.round(rowMin)} min`),
      bar('Grip', hangs.length ? Math.max(...hangs) : 0, 20, `${hourly} grip breaks${hangs.length ? `, best hang ${Math.max(...hangs)} sec` : ''}`),
      bar('Mobility', stretchDays, elapsed, `${stretchDays}/${elapsed} morning stretches`),
      bar('Fuel', proteinDays, elapsed, `${proteinDays}/${elapsed} days at ${TARGETS.protein_g[0]} g protein`),
      bar('Hydration', fluidDays, elapsed, `${fluidDays}/${elapsed} days at ${TARGETS.fluids_oz[0]} oz`),
      bar('Recovery', legsDays, elapsed, `${legsDays}/${elapsed} evenings legs up`),
      h('button', { class: 'stat spirit', onclick: journalSheet }, h('div', { class: 'stat-top' }, h('span', { class: 'stat-l' }, 'Spirit'),
        h('span', { class: 'stat-d' }, `Verse applied on ${versesApplied} of ${elapsed} days. Tap for your journal.`)))),
    h('section', { class: 'avg', 'aria-label': 'Weekly averages' },
      avgTile('Protein', avg(proteinVals), 'g', nOf(proteinVals)),
      avgTile('Fluids', avg(fluidVals), 'oz', nOf(fluidVals)),
      avgTile('Weight', avg(weightVals), 'lb', nOf(weightVals))),
    h('p', { class: 'muted small progress-hint' }, 'Tap a day above to open or close out its log.'));
}
