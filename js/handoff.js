// Converts between the chat handoff text and app records, both directions.
// Import keeps the full original text in handoff_raw so nothing is ever lost, then parses what is clean.
import { cleanNumber, blankDay, fluidTotals } from './schema.js';
import { planFor, blockStatus } from './program/index.js';
import { verseFor } from './verses.js';

const KEY = /^\s*([A-Z][A-Z_ ]*[A-Z]):\s?(.*)$/;
const split = v => (v ?? '').split('|').map(s => s.trim());
const orNull = v => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
// A line still holding the template's choices ("none / squeeze / sharp", "done / skipped") was not filled in.
const TEMPLATE = /^[a-z ]+(\s\/\s[a-z ]+)+$/i;
const filled = v => (orNull(v) && !TEMPLATE.test(orNull(v)) ? orNull(v) : null);
const nums = v => (v ?? '').split('/').map(s => cleanNumber(s.replace(/\(.*\)/, ''))).filter(n => n !== null);

export function parseHandoff(text) {
  const raw = {};
  let last = null;
  for (const line of text.replace(/\r/g, '').split('\n')) {
    const m = line.match(KEY);
    if (m) { last = m[1].trim(); raw[last] = m[2].trim(); }
    else if (last && line.trim()) raw[last] += ' ' + line.trim();
  }
  if (!raw.DATE || !/^\d{4}-\d{2}-\d{2}$/.test(raw.DATE)) throw new Error('No valid DATE line found (expected DATE: YYYY-MM-DD).');

  const date = raw.DATE;
  const day = blankDay(date);
  const sets = [];

  day.handoff_raw = text;
  day.day_status = filled(raw.STATUS);

  const prog = split(raw.PROGRAM);
  day.program_version = orNull(prog[0]);
  const wd = (prog[1] || '').match(/Week\s*(\d+),\s*Day\s*(\d+)/i);
  if (wd) { day.week = Number(wd[1]); day.day = Number(wd[2]); }

  const sleep = raw.SLEEP || '';
  day.bed_time = orNull((sleep.match(/bed\s*([^|]*)/i) || [])[1]);
  day.wake_time = orNull((sleep.match(/wake\s*(.*)$/i) || [])[1]);

  for (const k of ['WEIGHT_LB', 'PROTEIN_G', 'WATER_OZ', 'OTHER_DRINKS_OZ', 'ROW_MIN']) day[k.toLowerCase()] = cleanNumber(raw[k]);

  const st = split(raw.STRETCH);
  day.stretch_status = filled(st[0]);
  day.toe_touch_notes = orNull((st.slice(1).join(' | ').match(/reach:\s*(.*)$/i) || [])[1]);
  day.fab_five_status = filled(split(raw.FAB_FIVE)[0]);
  day.routine_status = filled(split(raw.ROUTINE)[1]);

  const pu = split(raw.PULLUPS);
  const puEx = /neutral/i.test(pu[1] || '') ? 'neutral_pullup' : 'chin_up';
  const puMode = /negative/i.test(pu[2] || '') ? 'negative' : 'full';
  nums(pu[0]).forEach((n, i) => sets.push({ date, exercise: puEx, set_no: i + 1, reps: n, mode: puMode, source: 'import' }));

  const legs = split(raw.LEGS);
  const legEx = /rdl/i.test(legs[0] || '') ? 'sl_rdl' : /bulgarian|split/i.test(legs[0] || '') ? 'bss' : null;
  if (legEx) nums(legs[1]).forEach((n, i) => sets.push({ date, exercise: legEx, set_no: i + 1, reps: n, side: 'each', source: 'import' }));

  nums(raw.MAGNET_CURLS).forEach((n, i) => sets.push({ date, exercise: 'magnet_curl', set_no: i + 1, reps: n, source: 'import' }));
  nums(raw.HANGS_SEC).forEach((n, i) => sets.push({ date, exercise: 'dead_hang', set_no: i + 1, sec: n, source: 'import' }));

  const hb = split(raw.HOURLY_BLOCKS);
  day.hourly_blocks_count = cleanNumber(hb[0]);
  day.gripper = orNull(hb[1]);
  day.hourly_palm_notes = orNull(hb.slice(2).join(' | '));

  day.eating_notes = orNull(raw.EATING);
  day.drinks_notes = orNull(raw.DRINKS_NOTES);
  const pinch = split(raw.PINCH);
  day.pinch_level = ['none', 'squeeze', 'sharp'].includes((pinch[0] || '').toLowerCase()) ? pinch[0].toLowerCase() : null;
  day.pinch_notes = filled(pinch.slice(day.pinch_level ? 1 : 0).join(' | '));
  day.ankles_feet_notes = orNull(raw.ANKLES_FEET);
  const verse = split(raw.VERSE);
  day.verse_ref = orNull(verse[0]);
  day.verse_applied_notes = orNull(verse.slice(1).join(' | '));
  day.energy_notes = orNull(raw.ENERGY_NOTES);
  day.flags_notes = orNull(raw.FLAGS_FOR_TOMORROW);
  day.tomorrow_notes = orNull(raw.TOMORROW);
  day.instruction_updates = orNull(raw['INSTRUCTION UPDATES']);

  return { day, sets };
}

// ---------- App to chat ----------

const v = x => (x === null || x === undefined ? '' : x);
const joinSets = (rows, field) => rows.sort((a, b) => a.set_no - b.set_no).map(r => r[field]).join(' / ');

function perLeg(rows, field = 'reps') {
  const bySet = {};
  for (const r of rows) (bySet[r.set_no] ||= {})[r.side || 'each'] = r[field];
  return Object.keys(bySet).sort().map(k => {
    const s = bySet[k];
    if (s.each !== undefined) return s.each;
    return s.L === s.R ? s.L : `L${v(s.L)} R${v(s.R)}`;
  }).join(' / ');
}

const statusWord = (native, imported) => ({ done: 'done', skip: 'skipped', partial: 'partial' }[native] || imported || '');

export function buildHandoff({ day, sets, events, fluids }) {
  const plan = planFor(day.date);
  const verse = verseFor(day.date);
  const totals = fluidTotals(day, fluids);
  const of = ex => sets.filter(s => s.exercise === ex);

  const pullEx = of('chin_up').length ? 'chin_up' : of('neutral_pullup').length ? 'neutral_pullup' : null;
  const pull = pullEx ? of(pullEx) : [];
  const modes = new Set(pull.map(s => s.mode || 'full'));
  const pullMode = !pull.length ? '' : modes.size > 1 ? 'mixed' : modes.has('negative') ? 'negatives' : 'full range';
  const legEx = of('bss').length ? 'bss' : of('sl_rdl').length ? 'sl_rdl' : null;
  const legName = { bss: 'Bulgarian split squats', sl_rdl: 'Single-leg RDL' }[legEx] || '';

  const hourly = events.filter(e => e.type === 'block_done' && e.block === 'hourly');
  const base = day.hourly_blocks_count || 0;
  const hourlyCount = hourly.length ? base + hourly.length : day.hourly_blocks_count;
  const appPalms = hourly.map((e, i) => `block ${base + i + 1} palms ${e.palms || 'not noted'}`).join(', ');
  const palmNotes = [day.hourly_palm_notes, appPalms].filter(Boolean).join(', ');
  const rowMin = sets.find(s => s.exercise === 'row')?.min ?? day.row_min;
  const routine = plan.blocks.find(b => !['stretch', 'gates', 'hangs', 'evening_legs'].includes(b.id));

  const lines = [
    `DATE: ${day.date}`,
    `STATUS: ${v(day.day_status) || 'day in progress'}`,
    `PROGRAM: ${plan.version} | Week ${plan.week}, Day ${plan.day} | ${plan.typeLabel}`,
    `SLEEP: bed ${v(day.bed_time)} | wake ${v(day.wake_time)}`,
    `WEIGHT_LB: ${v(day.weight_lb)}`,
    `STRETCH: ${statusWord(blockStatus('stretch', events), day.stretch_status)} | toe touch reach: ${v(day.toe_touch_notes)}`,
    `FAB_FIVE: ${statusWord(blockStatus('gates', events), day.fab_five_status)}`,
    `ROUTINE: ${plan.typeLabel} | ${routine ? statusWord(blockStatus(routine.id, events), day.routine_status) || 'pending' : 'none'}`,
    `  PULLUPS: ${pull.length ? `${joinSets(pull, 'reps')} | ${pullEx === 'chin_up' ? 'chin-up' : 'neutral'} | ${pullMode}` : ''}`,
    `  LEGS: ${legEx ? `${legName} | ${perLeg(of(legEx))} (per leg)` : ''}`,
    `  MAGNET_CURLS: ${joinSets(of('magnet_curl'), 'reps')}`,
    `  ROW_MIN: ${v(rowMin)}`,
    `HANGS_SEC: ${joinSets(of('dead_hang').filter(s => s.block !== 'strength_a' && s.block !== 'strength_b'), 'sec')}`,
    `HOURLY_BLOCKS: ${v(hourlyCount)} | ${v(day.gripper) || 'CoC Trainer'} | ${v(palmNotes)}`,
    `PROTEIN_G: ${v(day.protein_g)}`,
    `EATING: ${v(day.eating_notes)}`,
    `WATER_OZ: ${v(totals.water_oz)}`,
    `OTHER_DRINKS_OZ: ${v(totals.other_drinks_oz)}`,
    `DRINKS_NOTES: ${v(day.drinks_notes)}`,
    `PINCH: ${v(day.pinch_level)} | ${v(day.pinch_notes)}`,
    `ANKLES_FEET: ${v(day.ankles_feet_notes)}`,
    `VERSE: ${day.verse_ref || verse.ref} | ${v(day.verse_applied_notes)}`,
    `ENERGY_NOTES: ${v(day.energy_notes)}`,
    `FLAGS_FOR_TOMORROW: ${v(day.flags_notes)}`,
    `TOMORROW: ${v(day.tomorrow_notes)}`,
    `INSTRUCTION UPDATES: ${v(day.instruction_updates) || 'none'}`,
  ];
  return lines.join('\n');
}
