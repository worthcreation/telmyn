// Runs in the browser (tests/index.html) and in Node (node tests/tests.js).
import { parseHandoff, buildHandoff } from '../js/handoff.js';
import { verseFor } from '../js/verses.js';
import { planFor, weekAndDay, nextBlock } from '../js/program/index.js';
import { cleanNumber, fluidTotals, blankDay } from '../js/schema.js';
import { transitionSec } from '../js/flow.js';
import { hourlyHistory, nextPalms } from '../js/hourly.js';
import { FOODS, foodByKey, foodLine, addLine, removeLine } from '../js/foods.js';

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
    if (s.kind === 'rest' || /curls/i.test(s.text)) continue;
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
test('Huel preset adds 40 g protein and 16.9 oz (500 ml) water', () => { const f = foodByKey('huel'); eq([f.protein_g, f.fluid.kind, f.fluid.oz, f.fluid.ml], [40, 'huel_water', 16.9, 500]); });
test('food note line adds and undoes cleanly', () => {
  const line = foodLine(FOODS[0], '08:10');
  eq(removeLine(addLine(null, line), line), null, 'blank stays blank');
  eq(removeLine(addLine('Eggs.', line), line), 'Eggs.', 'other notes kept');
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
  eq([tr('Lunge with reach, left leg forward'), tr('Lunge with reach, right leg forward'), tr('Calf stretch, right leg'), tr('Hamstring stretch'), tr('Row steady, 15 min'), tr('Row easy, 1-2 min')], [10, 5, 5, 10, 0, 0]);
  eq(transitionSec(undefined, { kind: 'timed' }), 5);
  eq(transitionSec({ kind: 'rest' }, { kind: 'timed' }), 0);
});
test('hourly history: imported palms plus app blocks, next alternates', () => {
  const { day } = parseHandoff(SAMPLE);
  const hist = hourlyHistory(day, [{ type: 'block_done', block: 'hourly', palms: 'down', at: '2026-10-27T19:00:00Z' }]);
  eq(hist.map(x => x.palms), [null, 'down', 'up', 'down']);
  eq(nextPalms(hist), 'up');
});
const failed = results.filter(r => !r[1]);
if (typeof document !== 'undefined') {
  document.body.innerHTML = `<h1>${failed.length ? failed.length + ' failed' : 'All ' + results.length + ' passed'}</h1>` +
    results.map(([n, ok, m]) => `<p style="color:${ok ? 'green' : 'crimson'}">${ok ? 'PASS' : 'FAIL'} ${n}${m ? ': ' + m : ''}</p>`).join('');
} else {
  // Node only: the release number must match in both files, or phones won't update.
  const fs = await import('fs');
  const app = fs.readFileSync(new URL('../js/version.js', import.meta.url), 'utf8').match(/APP_VERSION = '([^']+)'/)[1];
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8').match(/const VERSION = '([^']+)'/)[1];
  const orig = JSON.parse(fs.readFileSync(new URL('../data/original.json', import.meta.url), 'utf8'));
  const { BANK } = await import('../js/verses.js');
  const missingWords = BANK.flat().filter(ref => !orig.verses[ref]?.words?.length);
  results.push(['every bank verse has Greek or Hebrew key words', !missingWords.length, missingWords.join(', ')]);
  if (missingWords.length) failed.push(results[results.length - 1]);
  // The service worker must parse, or phones silently stop taking updates.
  try { new Function(fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8')); results.push(['sw.js parses', true]); }
  catch (e) { results.push(['sw.js parses', false, e.message]); failed.push(results[results.length - 1]); }
  results.push(['version.js and sw.js versions match', app === sw, app === sw ? '' : `version.js ${app}, sw.js ${sw}`]);
  if (app !== sw) failed.push(results[results.length - 1]);
  // The real app must never ship as the test app.
  const site = fs.readFileSync(new URL('../js/site.js', import.meta.url), 'utf8');
  results.push(['real app ships as live, not test', /SITE = 'live'/.test(site)]);
  if (!/SITE = 'live'/.test(site)) failed.push(results[results.length - 1]);
  // Every Watch video in the library must play in the app (YouTube or Facebook), and nothing opens another site.
  const { parseVideo } = await import('../js/ui/media.js');
  const { EXERCISES } = await import('../js/program/v1_1.js');
  const urls = Object.values(EXERCISES).flatMap(e => [e.video, e.alt?.video]).filter(Boolean);
  const bad = urls.filter(u => !parseVideo(u));
  results.push(['every Watch video plays in the app', !bad.length, bad.join(', ')]);
  if (bad.length) failed.push(results[results.length - 1]);
  const fv = parseVideo('https://www.youtube.com/watch?v=mLVLLGUbyfU&t=36s');
  results.push(['forearm video starts at 0:36', fv?.id === 'mLVLLGUbyfU' && fv.start === 36]);
  if (!(fv?.id === 'mLVLLGUbyfU' && fv.start === 36)) failed.push(results[results.length - 1]);
  const { readdirSync } = await import('fs');
  const jsFiles = ['js', 'js/ui', 'js/program'].flatMap(d => readdirSync(new URL(`../${d}/`, import.meta.url)).filter(f => f.endsWith('.js')).map(f => `${d}/${f}`));
  const ext = jsFiles.filter(f => /target:\s*'_blank'/.test(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')));
  results.push(['no links open another site', !ext.length, ext.join(', ')]);
  if (ext.length) failed.push(results[results.length - 1]);
  // Every module the app imports must be in the offline cache list, or the app breaks offline.
  const swText = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const { dirname, join, normalize } = await import('path');
  const seen = new Set(), queue = ['js/main.js'];
  while (queue.length) {
    const f = queue.shift(); if (seen.has(f)) continue; seen.add(f);
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(/(?:import|from)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) queue.push(normalize(join(dirname(f), m[1])).replace(/\\/g, '/'));
  }
  const uncached = [...seen].filter(f => !swText.includes(`'${f}'`));
  results.push(['every app module is cached for offline', !uncached.length, uncached.join(', ')]);
  if (uncached.length) failed.push(results[results.length - 1]);
  // Every release is in the changelog.
  const log = fs.readFileSync(new URL('../docs/CHANGELOG.md', import.meta.url), 'utf8');
  results.push(['changelog has this version', log.includes(`## ${app} (`), app]);
  if (!log.includes(`## ${app} (`)) failed.push(results[results.length - 1]);
  for (const [n, ok, m] of results) console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${m ? ': ' + m : ''}`);
  console.log(failed.length ? `${failed.length} failed` : `All ${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}
