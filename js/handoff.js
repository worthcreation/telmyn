// Converts between the chat handoff text and app records, both directions.
// Import keeps the full original text in handoff_raw so nothing is ever lost, then parses what is clean.
import { isoDate } from './clock.js';
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

// Exercises beyond the original template lines, one line each, same name every day (blank when not that day's).
// The order here is the order they print. ex: exercise id in the program; block: only sets from that block
// (warm-up sets live inside the strength blocks); sides: per leg or per arm, printed like LEGS.
export const EXTRA = [
  { key: 'SCAP_PULLUPS', ex: 'scap_pullup', blocks: ['strength_a', 'strength_b'] },
  { key: 'WARMUP_HANGS_SEC', ex: 'dead_hang', field: 'sec', blocks: ['strength_a', 'strength_b'] },
  { key: 'PUSHUPS', ex: 'pushup' },
  { key: 'PAUSED_PUSHUPS', ex: 'paused_pushup' },
  { key: 'SA_ROWS', ex: 'sa_row', sides: true, unit: 'per arm' },
  { key: 'GOBLET_SQUATS', ex: 'goblet' },
  { key: 'MAGNET_CURLS', ex: 'magnet_curl' },
  { key: 'CHAMPAGNE_CURLS', ex: 'champagne_curl' },
  { key: 'WINDMILLS', ex: 'windmills' },
];
// Weight on a line: "25 lb" for every set, or "25 / 25 / 20 lb" set by set. Returns set number -> lb (null if none).
function lbParse(v) {
  const list = (v ?? '').replace(/lb/i, '').split('/').map(x => cleanNumber(x)).filter(n => n !== null);
  return k => (list.length > 1 ? list[k - 1] ?? null : list[0] ?? null);
}
// The weight part of a line: one number when every set used it, else set by set. Blank when nothing has a weight.
function lbText(rows) {
  const bySet = {};
  for (const r of rows) if (r.lb != null) bySet[r.set_no || 1] = r.lb;
  const vals = Object.keys(bySet).sort((a, b) => a - b).map(k => bySet[k]);
  if (!vals.length) return '';
  return ` | ${vals.every(x => x === vals[0]) ? vals[0] : vals.join(' / ')} lb`;
}
// "L10 R9 / 8 / L7 R" back into rows; a bare number means both sides did it.
function perLegParse(v) {
  const out = [];
  (v ?? '').replace(/\(.*\)/, '').split('/').forEach((part, k) => {
    const t = part.trim();
    if (!t) return;
    const l = t.match(/L\s*(\d+(?:\.\d+)?)/i), r = t.match(/R\s*(\d+(?:\.\d+)?)/i);
    if (l || r) {
      if (l) out.push({ set_no: k + 1, side: 'L', n: Number(l[1]) });
      if (r) out.push({ set_no: k + 1, side: 'R', n: Number(r[1]) });
    } else if (cleanNumber(t) !== null) out.push({ set_no: k + 1, side: 'each', n: cleanNumber(t) });
  });
  return out;
}

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

  for (const k of ['WEIGHT_LB', 'PROTEIN_G', 'WATER_OZ', 'OTHER_DRINKS_OZ', 'ROW_MIN', 'ROW_M']) day[k.toLowerCase()] = cleanNumber(raw[k]);

  const st = split(raw.STRETCH);
  day.stretch_status = filled(st[0]);
  day.toe_touch_notes = orNull((st.slice(1).join(' | ').match(/reach:\s*(.*)$/i) || [])[1]);
  day.fab_five_status = filled(split(raw.FAB_FIVE)[0]);
  day.routine_status = filled(split(raw.ROUTINE)[1]);

  const pu = split(raw.PULLUPS);
  const puEx = /neutral/i.test(pu[1] || '') ? 'neutral_pullup' : 'chin_up';
  // One mode for every set ("full range"), or one per set ("negatives / full range / full range").
  const puModes = (pu[2] || '').split('/').map(m => (/negative/i.test(m) ? 'negative' : 'full'));
  nums(pu[0]).forEach((n, i) => sets.push({ date, exercise: puEx, set_no: i + 1, reps: n, mode: puModes[puModes.length > 1 ? i : 0] || 'full', source: 'import' }));

  const legs = split(raw.LEGS);
  const legEx = /rdl/i.test(legs[0] || '') ? 'sl_rdl' : /bulgarian|split/i.test(legs[0] || '') ? 'bss' : null;
  const legLb = lbParse(legs[2]);
  if (legEx) perLegParse(legs[1]).forEach(r => sets.push({ date, exercise: legEx, set_no: r.set_no, reps: r.n, side: r.side, lb: legLb(r.set_no), source: 'import' }));

  // Every other logged exercise has its own line (EXTRA below), read back the same way it is written.
  for (const x of EXTRA) {
    const [val, wt] = split(raw[x.key]);
    if (!val) continue;
    const field = x.field || 'reps', lb = lbParse(wt);
    if (x.sides) perLegParse(val).forEach(r => sets.push({ date, exercise: x.ex, block: x.blocks?.[0], set_no: r.set_no, side: r.side, [field]: r.n, lb: lb(r.set_no), source: 'import' }));
    else nums(val).forEach((n, i) => sets.push({ date, exercise: x.ex, block: x.blocks?.[0], set_no: i + 1, [field]: n, lb: lb(i + 1), source: 'import' }));
  }
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
  return Object.keys(bySet).sort((a, b) => a - b).map(k => {
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
  const pull = pullEx ? [...of(pullEx)].sort((a, b) => a.set_no - b.set_no) : [];
  const modeWord = m => (m === 'negative' ? 'negatives' : 'full range');
  const modes = new Set(pull.map(s => s.mode || 'full'));
  // Mixed sets name the mode of each set in order, so progress shows which sets were negatives.
  const pullMode = !pull.length ? '' : modes.size > 1 ? pull.map(s => modeWord(s.mode || 'full')).join(' / ') : modeWord([...modes][0]);
  const legEx = of('bss').length ? 'bss' : of('sl_rdl').length ? 'sl_rdl' : null;
  const legName = { bss: 'Bulgarian split squats', sl_rdl: 'Single-leg RDL' }[legEx] || '';

  const hourly = events.filter(e => e.type === 'block_done' && e.block === 'hourly');
  const base = day.hourly_blocks_count || 0;
  const hourlyCount = hourly.length ? base + hourly.length : day.hourly_blocks_count;
  const appPalms = hourly.map((e, i) => `block ${base + i + 1} palms ${e.palms || 'not noted'}`).join(', ');
  const palmNotes = [day.hourly_palm_notes, appPalms].filter(Boolean).join(', ');
  const rowMin = sets.find(s => s.exercise === 'row')?.min ?? day.row_min;
  const extraLine = x => {
    const rows = of(x.ex).filter(r => !x.blocks || x.blocks.includes(r.block));
    if (!rows.length) return `  ${x.key}: `;
    return `  ${x.key}: ${x.sides ? `${perLeg(rows, x.field || 'reps')} (${x.unit})` : joinSets(rows, x.field || 'reps')}${lbText(rows)}`;
  };
  const pumps = events.filter(e => e.type === 'habit' && e.habit === 'ankle_pumps').length;
  // What was eaten: your own notes, then each logged food's line (skipping any already in the notes from before).
  const eating = [day.eating_notes, ...events.filter(e => e.type === 'food' && e.line && !(day.eating_notes || '').includes(e.line)).map(e => e.line)].filter(Boolean).join(' ');
  // When each block finished, in the phone's local time, in program order (last finish if done more than once).
  const hhmm = iso => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const doneAt = id => [...events].reverse().find(e => e.block === id && e.type === 'block_done')?.done_at;
  const blockTimes = plan.blocks.filter(b => doneAt(b.id)).map(b => `${b.name} ${hhmm(doneAt(b.id))}`).join(' | ');
  const routine = plan.blocks.find(b => !['stretch', 'gates', 'hangs', 'evening_legs'].includes(b.id));

  const lines = [
    `DATE: ${day.date}`,
    `STATUS: ${v(day.day_status) || (day.date && day.date < isoDate() ? 'day complete' : 'day in progress')}`,
    `PROGRAM: ${plan.version} | Week ${plan.week}, Day ${plan.day} | ${plan.typeLabel}`,
    `SLEEP: bed ${v(day.bed_time)} | wake ${v(day.wake_time)}`,
    `WEIGHT_LB: ${v(day.weight_lb)}`,
    `STRETCH: ${statusWord(blockStatus('stretch', events), day.stretch_status)} | toe touch reach: ${v(day.toe_touch_notes)}`,
    `FAB_FIVE: ${statusWord(blockStatus('gates', events), day.fab_five_status)}`,
    `ROUTINE: ${plan.typeLabel} | ${routine ? statusWord(blockStatus(routine.id, events), day.routine_status) || 'pending' : 'none'}`,
    `  PULLUPS: ${pull.length ? `${joinSets(pull, 'reps')} | ${pullEx === 'chin_up' ? 'chin-up' : 'neutral'} | ${pullMode}` : ''}`,
    `  LEGS: ${legEx ? `${legName} | ${perLeg(of(legEx))} (per leg)${lbText(of(legEx))}` : ''}`,
    ...EXTRA.map(extraLine),
    `  ROW_MIN: ${v(rowMin)}`,
    `  ROW_M: ${v(sets.find(s => s.exercise === 'row_dist')?.m ?? day.row_m)}`,
    `HANGS_SEC: ${joinSets(of('dead_hang').filter(s => s.block !== 'strength_a' && s.block !== 'strength_b'), 'sec')}`,
    `HOURLY_BLOCKS: ${v(hourlyCount)} | ${v(day.gripper) || 'CoC Trainer'} | ${v(palmNotes)}`,
    `PUMPS: ${pumps || ''}`,
    `BLOCK_TIMES: ${blockTimes}`,
    `PROTEIN_G: ${v(day.protein_g)}`,
    `EATING: ${eating}`,
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
