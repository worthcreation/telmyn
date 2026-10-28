import { h, sheet, toast, fill } from './dom.js';
import { state, setField, addFluid, undoFluid, addProtein, addEvent, load } from '../state.js';
import * as db from '../db.js';
import { planFor, blockStatus } from '../program/index.js';
import { hourlyHistory } from '../hourly.js';
import { now, hhmm, addDays } from '../clock.js';
import { DAY_FIELDS, FLUID_KINDS, ozFromMl, cleanNumber, fluidTotals, blankDay } from '../schema.js';

export function fluidSheet() {
  let kind = 'water';
  const body = h('div', { class: 'stack' });
  const draw = () => fill(body, 
    h('div', { class: 'seg wrap' }, FLUID_KINDS.map(k => h('button', { class: kind === k.key ? 'on' : '', onclick: () => { kind = k.key; draw(); } }, k.label))),
    h('div', { class: 'grid4' }, [8, 16.9, 24, 25].map(oz => h('button', { class: 'chip', onclick: () => add(oz) }, `${oz} oz`))),
    h('div', { class: 'row' },
      h('input', { id: 'f-amt', type: 'number', inputmode: 'decimal', placeholder: 'Amount', 'aria-label': 'Amount' }),
      h('button', { class: 'chip', onclick: () => custom('oz') }, 'oz'),
      h('button', { class: 'chip', onclick: () => custom('ml') }, 'ml')),
    state.fluids.length ? h('button', { class: 'btn ghost', onclick: async () => { await undoFluid(); draw(); } }, 'Undo last entry') : null);
  const add = async (oz, ml = null) => { await addFluid(kind, oz, ml); toast(`Logged ${oz} oz ${FLUID_KINDS.find(k => k.key === kind).label.toLowerCase()}`); s.close(); };
  const custom = unit => {
    const n = cleanNumber(document.getElementById('f-amt').value);
    if (n === null) return toast('Enter an amount first');
    unit === 'ml' ? add(ozFromMl(n), n) : add(n);
  };
  draw();
  const s = sheet('Add fluid', body);
}

export function proteinSheet() {
  const body = h('div', { class: 'stack' },
    h('div', { class: 'grid4' }, [20, 30, 40, 50].map(g => h('button', { class: 'chip', onclick: () => add(g) }, `${g} g`))),
    h('div', { class: 'row' },
      h('input', { id: 'p-amt', type: 'number', inputmode: 'numeric', placeholder: 'Grams', 'aria-label': 'Grams' }),
      h('button', { class: 'chip', onclick: () => { const n = cleanNumber(document.getElementById('p-amt').value); n === null ? toast('Enter grams first') : add(n); } }, 'Add')),
    h('p', { class: 'muted small' }, 'Adds to today’s total. Edit the total in Log.'));
  const add = async g => { await addProtein(g); toast(`Protein now ${state.day.protein_g} g`); s.close(); };
  const s = sheet('Add protein', body);
}

const prettyDay = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
const STATUS_WORD = { done: 'done', skip: 'skipped', partial: 'partial' };

// Log for any day. Today edits live state; a past day is read from storage and saved straight back.
// The Day tab closes a day out: status, every block with its result, and the day's totals.
export async function logSheet(date = state.date, group = null) {
  const groups = [...new Set(DAY_FIELDS.map(f => f.group))];
  let current = group || groups[0];
  let ctx;

  async function loadCtx(d) {
    if (d === state.date) {
      ctx = { date: d, rec: state.day, fluids: state.fluids, events: state.events, sets: state.sets, save: (k, v) => setField(k, v) };
    } else {
      const rec = { ...blankDay(d), ...(await db.get('days', d)) };
      const [fluids, events, sets] = await Promise.all([db.byDate('fluids', d), db.byDate('events', d), db.byDate('sets', d)]);
      events.sort((a, b) => a.at.localeCompare(b.at));
      ctx = { date: d, rec, fluids, events, sets, save: async (k, v) => { rec[k] = v; await db.put('days', rec); } };
    }
  }

  const field = f => {
    const val = ctx.rec[f.key];
    const id = `fld-${f.key}`;
    const save = raw => ctx.save(f.key, f.type === 'number' ? cleanNumber(raw) : (raw === '' ? null : raw));
    let input;
    if (f.derivedFrom && ctx.fluids.length) {
      return h('div', { class: 'field' }, h('span', { class: 'lbl' }, `${f.label} (${f.unit})`), h('span', { class: 'derived' }, `${fluidTotals(ctx.rec, ctx.fluids)[f.key] ?? ''} (imported total plus fluid entries)`));
    }
    if (f.type === 'choice') {
      input = h('div', { class: 'seg' }, f.options.map(o => h('button', { class: val === o ? 'on' : '', onclick: async () => { await save(ctx.rec[f.key] === o ? '' : o); draw(); } }, o)));
    } else if (f.type === 'textarea') {
      input = h('textarea', { id, rows: 2, onchange: e => save(e.target.value) }, val ?? '');
    } else {
      input = h('input', { id, type: f.type === 'number' ? 'number' : f.type, inputmode: f.type === 'number' ? 'decimal' : null, step: f.step || null, value: val ?? '', onchange: e => save(e.target.value) });
    }
    return h('div', { class: 'field' }, h('label', { class: 'lbl', for: id }, f.unit ? `${f.label} (${f.unit})` : f.label), input);
  };

  // Mark a block on a past or present day. Logged as an event on that day, flagged as entered afterwards.
  async function mark(blockId, type) {
    const e = { date: ctx.date, type, at: now().toISOString(), block: blockId, entered_later: ctx.date !== state.date };
    if (ctx.date === state.date) { await addEvent(type, { block: blockId }); }
    else { e.id = await db.put('events', e); ctx.events.push(e); }
    draw();
  }

  function daySummary() {
    const plan = planFor(ctx.date);
    const rows = plan.blocks.map(b => {
      const st = blockStatus(b.id, ctx.events, ctx.rec, plan);
      const when = ctx.events.filter(e => e.block === b.id && e.type === 'block_done').pop()?.done_at;
      return h('li', { class: `ds-row ${st || 'open'}` },
        h('span', { class: 'ds-mark' }, st === 'done' ? '✓' : st ? '–' : ''),
        h('span', { class: 'ds-name' }, b.name),
        st ? h('span', { class: 'ds-st' }, `${STATUS_WORD[st]}${when ? `, ${hhmm(new Date(when))}` : ''}`)
          : h('span', { class: 'ds-act' },
            h('button', { class: 'chip', onclick: () => mark(b.id, 'block_done') }, 'Done'),
            h('button', { class: 'chip', onclick: () => mark(b.id, 'block_skip') }, 'Skip')));
    });
    const t = fluidTotals(ctx.rec, ctx.fluids);
    const fluids = (t.water_oz ?? null) === null && (t.other_drinks_oz ?? null) === null ? null : Math.round(((t.water_oz || 0) + (t.other_drinks_oz || 0)) * 10) / 10;
    const rowMin = ctx.sets.filter(x => x.exercise === 'row').reduce((a, x) => a + (x.min || 0), 0) || ctx.rec.row_min || null;
    const hourly = plan.hourly ? hourlyHistory(ctx.rec, ctx.events).length : null;
    const tile = (label, v, unit) => h('div', { class: 'ds-tile' }, h('span', { class: 'ds-tl' }, label), h('b', {}, v === null || v === undefined ? '–' : `${v}`), unit ? h('small', {}, ` ${unit}`) : null);
    return [
      h('ol', { class: 'ds-list', 'aria-label': 'Blocks' }, rows),
      h('div', { class: 'ds-tiles' }, tile('Fluids', fluids, 'oz'), tile('Protein', ctx.rec.protein_g, 'g'),
        hourly !== null ? tile('Grip', hourly) : tile('Row', rowMin, 'min'), tile('Weight', ctx.rec.weight_lb, 'lb')),
    ];
  }

  const body = h('div', { class: 'log-form' });
  const draw = () => {
    const today = ctx.date === state.date;
    fill(body,
      h('div', { class: 'day-nav' },
        h('button', { class: 'icon-btn', 'aria-label': 'Previous day', onclick: () => go(addDays(ctx.date, -1)) }, '‹'),
        h('span', { class: 'day-nav-d' }, today ? `Today, ${prettyDay(ctx.date)}` : prettyDay(ctx.date)),
        h('button', { class: 'icon-btn', 'aria-label': 'Next day', disabled: ctx.date >= state.date, onclick: () => go(addDays(ctx.date, 1)) }, '›')),
      h('div', { class: 'seg wrap tabs' }, groups.map(g => h('button', { class: g === current ? 'on' : '', onclick: () => { current = g; draw(); } }, g))),
      h('div', { class: 'fields' }, DAY_FIELDS.filter(f => f.group === current).map(field), current === 'Day' ? daySummary() : null),
      h('p', { class: 'muted small' }, 'Saves as you go. Empty means not recorded.'));
  };
  const go = async d => { await loadCtx(d); draw(); };
  await loadCtx(date);
  draw();
  // Reload the day on screen once the sheet is gone, so past-day edits show on Progress.
  sheet('Day log', body, { full: true, onClose: () => setTimeout(() => load(state.date), 250) });
}
