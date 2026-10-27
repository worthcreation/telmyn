// Runs in the browser (tests/index.html) and in Node (node tests/tests.js).
import { parseHandoff, buildHandoff } from '../js/handoff.js';
import { verseFor } from '../js/verses.js';
import { planFor, weekAndDay, nextBlock } from '../js/program/index.js';
import { cleanNumber, fluidTotals, blankDay } from '../js/schema.js';
import { transitionSec } from '../js/flow.js';

const results = [];
const test = (name, fn) => { try { fn(); results.push([name, true]); } catch (e) { results.push([name, false, e.message]); } };
const eq = (a, b, msg = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

const SAMPLE = `DATE: 2026-10-27
STATUS: day in progress
PROGRAM: v1 | Week 1, Day 1 | Row
SLEEP: bed  | wake 
WEIGHT_LB:
STRETCH: done | toe touch reach: nearly palms flat, legs nearly straight
FAB_FIVE: done
ROUTINE: Row | pending
  PULLUPS:
  LEGS:
  MAGNET_CURLS:
  ROW_MIN:
HANGS_SEC:
HOURLY_BLOCKS: 3 | CoC Trainer | block 1 palm not noted, block 2 palms down, block 3 palms up
PROTEIN_G: 40
EATING: Huel Black Edition, 1 serving
WATER_OZ: 22.9
OTHER_DRINKS_OZ: 24
DRINKS_NOTES: water = 16.9 oz (500 ml) in Huel + about 6 oz plain
PINCH:
ANKLES_FEET: inner ankle spider veins
VERSE: Galatians 6:9 |
ENERGY_NOTES:
FLAGS_FOR_TOMORROW: Book doctor visit
TOMORROW: Wed Off
INSTRUCTION UPDATES: applied in full on 2026-10-27.`;

test('week 1 day 1 on start date', () => eq(weekAndDay('2026-10-27'), { version: 'v1.1', week: 1, day: 1 }));
test('next Monday is week 2', () => eq(weekAndDay('2026-11-02').week, 2));
test('Tue week 1 verse is Galatians 6:9', () => eq(verseFor('2026-10-27').ref, 'Galatians 6:9'));
test('Wed week 1 verse is James 1:5 (Wisdom)', () => { const v = verseFor('2026-10-28'); eq([v.ref, v.theme], ['James 1:5', 'Wisdom']); });
test('Tue week 2 rotates to James 1:12', () => eq(verseFor('2026-11-03').ref, 'James 1:12'));
test('Tue plan is v1.1 Row, hangs before row, stretch at 06:30', () => { const p = planFor('2026-10-27'); eq([p.version, p.typeLabel, p.blocks.map(b => b.id), p.blocks[0].time], ['v1.1', 'Row', ['stretch', 'gates', 'hangs', 'row', 'evening_legs'], '06:30']); });
test('Strength day keeps hangs after the routine', () => eq(planFor('2026-11-02').blocks.map(b => b.id), ['stretch', 'gates', 'strength_a', 'hangs', 'evening_legs']));
test('every v1.1 step has a cue except rests, palms choice and curls without cues', () => {
  for (const b of Object.values(planFor('2026-10-27').program.data.BLOCKS)) for (const s of b.steps) {
    if (s.kind === 'rest' || s.choice || /curls/i.test(s.text)) continue;
    if (!s.cue) throw new Error(`no cue: ${b.name} / ${s.text}`);
  }
});
test('row, hangs, hourly, Fab Five each have warm-up and cooldown', () => {
  const B = planFor('2026-10-27').program.data.BLOCKS;
  for (const k of ['row', 'hangs', 'hourly']) { const ph = new Set(B[k].steps.map(s => s.phase)); if (!ph.has('Warm-up') || !ph.has('Cooldown')) throw new Error(k); }
  if (!B.gates.steps.some(s => s.phase === 'Cooldown')) throw new Error('gates');
});
test('Wed plan has no routine', () => eq(planFor('2026-10-28').blocks.map(b => b.id), ['stretch', 'gates', 'hangs', 'evening_legs']));
test('Sat has no hourly blocks', () => eq(planFor('2026-10-31').hourly, null));
test('cleanNumber keeps blank as null and 0 as 0', () => eq([cleanNumber(''), cleanNumber('0'), cleanNumber('about 6'), cleanNumber('22.9')], [null, 0, null, 22.9]));
test('every rest is its own step', () => {
  for (const b of Object.values(planFor('2026-10-26').program.data.BLOCKS)) for (const s of b.steps) if (s.kind === 'rest' && !s.sec) throw new Error(`rest without sec in ${b.name}`);
});

test('parse sample handoff', () => {
  const { day, sets } = parseHandoff(SAMPLE);
  eq([day.date, day.week, day.day, day.protein_g, day.water_oz, day.other_drinks_oz, day.weight_lb, day.bed_time], ['2026-10-27', 1, 1, 40, 22.9, 24, null, null]);
  eq([day.stretch_status, day.toe_touch_notes, day.routine_status, day.hourly_blocks_count, day.verse_ref], ['done', 'nearly palms flat, legs nearly straight', 'pending', 3, 'Galatians 6:9']);
  eq(sets.length, 0);
});
test('parse sets', () => {
  const { sets } = parseHandoff('DATE: 2026-11-02\nPULLUPS: 5 / 5 / 4 | chin-up | full range\nLEGS: Bulgarian split squats | 8 / 8 / 7 (per leg)\nHANGS_SEC: 20 / 18 / 15');
  eq(sets.filter(s => s.exercise === 'chin_up').map(s => s.reps), [5, 5, 4]);
  eq(sets.filter(s => s.exercise === 'bss').map(s => s.reps), [8, 8, 7]);
  eq(sets.filter(s => s.exercise === 'dead_hang').map(s => s.sec), [20, 18, 15]);
});
test('round trip keeps key lines', () => {
  const { day, sets } = parseHandoff(SAMPLE);
  const out = buildHandoff({ day, sets, events: [], fluids: [] });
  for (const line of ['DATE: 2026-10-27', 'PROGRAM: v1.1 | Week 1, Day 1 | Row', 'PROTEIN_G: 40', 'WATER_OZ: 22.9', 'OTHER_DRINKS_OZ: 24', 'STRETCH: done | toe touch reach: nearly palms flat, legs nearly straight', 'ROUTINE: Row | pending', 'VERSE: Galatians 6:9 | '])
    if (!out.includes(line)) throw new Error(`missing "${line}"`);
});
test('imported done status closes blocks', () => {
  const { day } = parseHandoff(SAMPLE);
  eq(nextBlock(planFor('2026-10-27'), [], day).id, 'hangs');
});
test('fluid entries add up by bucket', () => {
  const t = fluidTotals(blankDay('2026-10-27'), [{ kind: 'huel_water', oz: 16.9 }, { kind: 'water', oz: 6 }, { kind: 'yerba_mate', oz: 24 }]);
  eq(t, { water_oz: 22.9, other_drinks_oz: 24 });
});
test('imported total plus new entries', () => {
  const t = fluidTotals({ ...blankDay('2026-10-27'), water_oz: 22.9, other_drinks_oz: 24 }, [{ kind: 'water', oz: 25 }]);
  eq(t, { water_oz: 47.9, other_drinks_oz: 24 });
});
test('no data stays blank', () => eq(fluidTotals(blankDay('2026-10-27'), []), { water_oz: null, other_drinks_oz: null }));
test('hourly: imported 3 plus 1 in app', () => {
  const { day, sets } = parseHandoff(SAMPLE);
  const out = buildHandoff({ day, sets, events: [{ type: 'block_done', block: 'hourly', palms: 'down' }], fluids: [] });
  if (!out.includes('HOURLY_BLOCKS: 4 | CoC Trainer | block 1 palm not noted, block 2 palms down, block 3 palms up, block 4 palms down')) throw new Error(out.split('\n').find(l => l.startsWith('HOURLY')));
});

test('transitions: start 5, sides 5, new position 10, after rest 0, row segments 0', () => {
  const R = planFor('2026-10-27').program.data.BLOCKS.row.steps;
  const at = t => R.findIndex(s => s.text === t);
  const tr = t => transitionSec(R[at(t) - 1], R[at(t)]);
  eq([tr('Lunge with reach, left leg forward'), tr('Lunge with reach, right leg forward'), tr('Calf stretch, right leg'), tr('Hamstring stretch'), tr('Conversational pace'), tr('Easy cooldown, 1-2 min')], [10, 5, 5, 10, 0, 0]);
  eq(transitionSec(undefined, { kind: 'timed' }), 5);
  eq(transitionSec({ kind: 'rest' }, { kind: 'timed' }), 0);
});
const failed = results.filter(r => !r[1]);
if (typeof document !== 'undefined') {
  document.body.innerHTML = `<h1>${failed.length ? failed.length + ' failed' : 'All ' + results.length + ' passed'}</h1>` +
    results.map(([n, ok, m]) => `<p style="color:${ok ? 'green' : 'crimson'}">${ok ? 'PASS' : 'FAIL'} ${n}${m ? ': ' + m : ''}</p>`).join('');
} else {
  for (const [n, ok, m] of results) console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${m ? ': ' + m : ''}`);
  console.log(failed.length ? `${failed.length} failed` : `All ${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}
