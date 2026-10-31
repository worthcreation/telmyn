// Runs in the browser (tests/index.html) and in Node (node tests/tests.js).
import { parseHandoff, buildHandoff } from '../js/handoff.js';
import { verseFor } from '../js/verses.js';
import { planFor, weekAndDay, nextBlock } from '../js/program/index.js';
import { cleanNumber, fluidTotals, blankDay } from '../js/schema.js';
import { transitionSec } from '../js/flow.js';
import { hourlyHistory, nextPalms } from '../js/hourly.js';
import { FOODS, foodByKey, foodLine, addLine, removeLine } from '../js/foods.js';
import { sameKey, readText } from '../worker/src/sync.js';
import { encryptPayload } from '../worker/src/push.js';
import { fmtDuration, pickDaily } from '../js/scripture.js';

const results = [];
// Every result is filed under the group named last, so the run prints one line per group (failures by name).
let GROUP = 'App rules';
const group = g => { GROUP = g; };
results.push = function (...rows) { for (const r of rows) r[3] ??= GROUP; return Array.prototype.push.apply(this, rows); };
const waits = [];   // async tests finish before the results are counted
const test = (name, fn) => {
  try { const r = fn(); if (r?.then) { const slot = [name, false, 'did not finish']; results.push(slot); waits.push(r.then(() => { slot[1] = true; slot[2] = undefined; }, e => { slot[2] = e.message; })); } else results.push([name, true]); }
  catch (e) { results.push([name, false, e.message]); }
};
const eq = (a, b, msg = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

group('Reminders');
test('sync keys must match exactly', () => {
  eq(sameKey('ab12', 'ab12'), true); eq(sameKey('ab12', 'ab13'), false); eq(sameKey('ab1', 'ab12'), false);
  eq(sameKey('', ''), false); eq(sameKey(undefined, 'ab12'), false);
});
test('sync read text lists days newest first with the sync time', () => {
  const t = readText([{ date: '2026-10-29', handoff: 'DATE: 2026-10-29', updated_at: 'T2' }, { date: '2026-10-28', handoff: 'DATE: 2026-10-28', updated_at: 'T1' }], 'NOW');
  eq(t.startsWith('TELMYN SYNC (read NOW, 2 days, newest first)'), true);
  eq(t.indexOf('2026-10-29') < t.indexOf('2026-10-28'), true);
  eq(t.includes('SYNCED_AT: T2'), true);
  eq(readText([], 'NOW').includes('No days synced yet.'), true);
});

// Push payloads are encrypted for the phone (RFC 8291). Decrypt here as a phone would and check the text survives.
test('push payload decrypts to the reminders', async () => {
  const S = globalThis.crypto.subtle, b64u = b => Buffer.from(b).toString('base64url');
  const ua = await S.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const uaPub = new Uint8Array(await S.exportKey('raw', ua.publicKey)), auth = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const text = JSON.stringify([{ kind: 'grip', title: 'Grip break', body: 'It has been an hour since the last one.' }]);
  const msg = await encryptPayload({ keys: { p256dh: b64u(uaPub), auth: b64u(auth) } }, text);
  const salt = msg.slice(0, 16), idlen = msg[20], asPub = msg.slice(21, 21 + idlen), sealed = msg.slice(21 + idlen);
  const hk = async (salt, ikm, info, n) => new Uint8Array(await S.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await S.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8));
  const asKey = await S.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await S.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const te = new TextEncoder(), cat = (...p) => Uint8Array.from(p.flatMap(x => [...x]));
  const ikm = await hk(auth, shared, cat(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  const cek = await hk(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await hk(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const plain = new Uint8Array(await S.decrypt({ name: 'AES-GCM', iv: nonce }, await S.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), sealed));
  eq(plain[plain.length - 1], 2);
  eq(new TextDecoder().decode(plain.slice(0, -1)), text);
});

group('Verses');
test('video lengths read as m:ss or h:mm:ss', () => { eq(fmtDuration(526), '8:46'); eq(fmtDuration(59), '0:59'); eq(fmtDuration(3725), '1:02:05'); eq(fmtDuration(null), ''); });

test('daily video: newest not shown in the last 13 days, never two days running', () => {
  const v = [{ id: 'new' }, { id: 'mid' }, { id: 'old' }];
  eq(pickDaily(v, {}, '2026-10-30').id, 'new');
  eq(pickDaily(v, { new: '2026-10-29' }, '2026-10-30').id, 'mid');
  eq(pickDaily(v, { new: '2026-10-17' }, '2026-10-30').id, 'mid');
  eq(pickDaily(v, { new: '2026-10-16' }, '2026-10-30').id, 'new');
  eq(pickDaily(v, { new: '2026-10-30' }, '2026-10-30').id, 'new');
  eq(pickDaily(v, { new: '2026-10-29', mid: '2026-10-25', old: '2026-10-20' }, '2026-10-30').id, 'old');
});

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

group('Program');
test('week 1 day 1 on start date', () => eq(weekAndDay('2026-10-27'), { version: 'v1.1', week: 1, day: 1 }));
test('next Monday is week 2', () => eq(weekAndDay('2026-11-02').week, 2));
group('Verses');
test('Tue week 1 verse is Galatians 6:9', () => eq(verseFor('2026-10-27').ref, 'Galatians 6:9'));
test('Wed week 1 verse is James 1:5 (Wisdom)', () => { const v = verseFor('2026-10-28'); eq([v.ref, v.theme], ['James 1:5', 'Wisdom']); });
test('Tue week 2 rotates to James 1:12', () => eq(verseFor('2026-11-03').ref, 'James 1:12'));
group('Program');
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
group('Data');
test('cleanNumber keeps blank as null and 0 as 0', () => eq([cleanNumber(''), cleanNumber('0'), cleanNumber('about 6'), cleanNumber('22.9')], [null, 0, null, 22.9]));
group('Program');
test('every rest is its own step', () => {
  for (const b of Object.values(planFor('2026-10-26').program.data.BLOCKS)) for (const s of b.steps) if (s.kind === 'rest' && !s.sec) throw new Error(`rest without sec in ${b.name}`);
});

group('Data');
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
test('template choices left in a handoff are not imported as values', () => {
  const t = SAMPLE.replace(/^PINCH:.*$/m, 'PINCH: none / squeeze / sharp | notes').replace(/^FAB_FIVE:.*$/m, 'FAB_FIVE: done / skipped');
  const { day } = parseHandoff(t);
  eq([day.pinch_level, day.fab_five_status], [null, null]);
});
group('Program');
test('Sunday offers the optional walk', () => eq(planFor('2026-11-01').blocks.some(b => b.id === 'walk'), true));
test('weekdays have no walk', () => eq(planFor('2026-11-02').blocks.some(b => b.id === 'walk'), false));
group('Data');
test('status: met at target, blank never crashes', async () => { const { paceStatus, staleStatus } = await import('../js/status.js'); eq([paceStatus('fluids', 100, 100), paceStatus('protein', null, 160) === 'met', staleStatus(0), staleStatus(null), staleStatus(2)], ['met', false, 'met', 'behind', 'behind']); });
group('Reminders');
test('push rules: grip after an hour on a workday, weight once, nothing on weekends when logged', async () => {
  const { due } = await import('../worker/src/push.js');
  const t = s => Date.parse(s), off = 300;
  const rec = { offset: off, state: { grip: t('2026-10-28T14:00:00Z'), pumps: t('2026-10-28T14:40:00Z'), weight: '2026-10-27' }, sent: {} };
  eq([due(rec, t('2026-10-28T15:05:00Z')).map(d => d.kind).join(), due(rec, t('2026-10-28T14:30:00Z')).map(d => d.kind).join(),
    due({ ...rec, state: { ...rec.state, weight: '2026-10-31' } }, t('2026-10-31T15:05:00Z')).length, due({ ...rec, sent: { weight: '2026-10-28', grip: t('2026-10-28T15:00:00Z') } }, t('2026-10-28T15:05:00Z')).length],
    ['grip,weight', 'weight', 0, 0]);
});
group('Data');
test('no data stays blank', () => eq(fluidTotals(blankDay('2026-10-27'), []), { water_oz: null, other_drinks_oz: null }));
test('hourly: imported 3 plus 1 in app', () => {
  const { day, sets } = parseHandoff(SAMPLE);
  const out = buildHandoff({ day, sets, events: [{ type: 'block_done', block: 'hourly', palms: 'down' }], fluids: [] });
  if (!out.includes('HOURLY_BLOCKS: 4 | CoC Trainer | block 1 palm not noted, block 2 palms down, block 3 palms up, block 4 palms down')) throw new Error(out.split('\n').find(l => l.startsWith('HOURLY')));
});

test('every routine exercise prints, with per-set pull-up modes, per-arm rows, warm-up kept apart', () => {
  const d = '2026-10-29';
  const S = (exercise, set_no, n, o = {}) => ({ date: d, exercise, set_no, reps: n, block: 'strength_b', ...o });
  const sets = [
    S('scap_pullup', 1, 10), S('dead_hang', 1, null, { sec: 15, reps: undefined }), S('dead_hang', 2, null, { sec: 16, reps: undefined }),
    S('neutral_pullup', 1, 2, { mode: 'negative' }), S('neutral_pullup', 2, 5, { mode: 'full' }), S('neutral_pullup', 3, 5, { mode: 'full' }),
    S('sl_rdl', 1, 10, { side: 'L' }), S('sl_rdl', 1, 10, { side: 'R' }), S('sl_rdl', 2, 9, { side: 'L' }), S('sl_rdl', 2, 8, { side: 'R' }),
    S('goblet', 1, 12), S('goblet', 2, 11), S('paused_pushup', 1, 15), S('champagne_curl', 1, 10), S('windmills', 1, 15), S('windmills', 2, 15),
    { date: d, exercise: 'dead_hang', set_no: 1, sec: 24, block: 'hangs' },
  ];
  const events = [{ type: 'block_done', block: 'stretch', done_at: new Date(2026, 9, 29, 6, 41).toISOString() }, { type: 'habit', habit: 'ankle_pumps' }, { type: 'habit', habit: 'ankle_pumps' }];
  const out = buildHandoff({ day: blankDay(d), sets, events, fluids: [] });
  for (const line of ['  PULLUPS: 2 / 5 / 5 | neutral | negatives / full range / full range', '  LEGS: Single-leg RDL | 10 / L9 R8 (per leg)',
    '  SCAP_PULLUPS: 10', '  WARMUP_HANGS_SEC: 15 / 16', '  GOBLET_SQUATS: 12 / 11', '  PAUSED_PUSHUPS: 15', '  CHAMPAGNE_CURLS: 10', '  WINDMILLS: 15 / 15',
    '  SA_ROWS: ', 'HANGS_SEC: 24', 'PUMPS: 2', 'BLOCK_TIMES: Morning stretch 06:41'])
    if (!out.includes(line)) throw new Error(`missing "${line}"`);
  // And back again: the same sets come out of the text.
  const back = parseHandoff(out).sets;
  eq(back.filter(x => x.exercise === 'neutral_pullup').map(x => x.mode), ['negative', 'full', 'full']);
  eq(back.filter(x => x.exercise === 'sl_rdl').map(x => `${x.side}${x.reps}`), ['each10', 'L9', 'R8']);
  eq(back.filter(x => x.exercise === 'goblet').map(x => x.reps), [12, 11]);
  eq(back.filter(x => x.exercise === 'dead_hang' && x.block === 'strength_a').map(x => x.sec), [15, 16]);
  eq(buildHandoff({ day: blankDay(d), sets: back, events: [], fluids: [] }).includes('HANGS_SEC: 24'), true);
});
group('Data');
test('weights print and read back, one number or set by set', () => {
  const d = '2026-10-29';
  const sets = [1, 2, 3].map(k => ({ date: d, exercise: 'goblet', set_no: k, reps: 10, lb: 25, block: 'strength_b' }))
    .concat([{ date: d, exercise: 'magnet_curl', set_no: 1, reps: 10, lb: 20 }, { date: d, exercise: 'magnet_curl', set_no: 2, reps: 8, lb: 15 }])
    .concat([1, 2].flatMap(k => ['L', 'R'].map(side => ({ date: d, exercise: 'sl_rdl', set_no: k, reps: 10, side, lb: 20 }))));
  const out = buildHandoff({ day: blankDay(d), sets, events: [], fluids: [] });
  for (const line of ['  GOBLET_SQUATS: 10 / 10 / 10 | 25 lb', '  MAGNET_CURLS: 10 / 8 | 20 / 15 lb', '  LEGS: Single-leg RDL | 10 / 10 (per leg) | 20 lb'])
    if (!out.includes(line)) throw new Error(`missing "${line}"`);
  const back = parseHandoff(out).sets;
  eq(back.filter(x => x.exercise === 'magnet_curl').map(x => x.lb), [20, 15]);
  eq(back.filter(x => x.exercise === 'sl_rdl').map(x => x.lb), [20, 20]);
  eq(back.filter(x => x.exercise === 'goblet').map(x => `${x.reps}@${x.lb}`), ['10@25', '10@25', '10@25']);
});
test('a logged food shows once in EATING, whether or not old notes already hold its line', () => {
  const line = '08:50: Huel Black Edition, 1 serving (40 g protein, 400 kcal per label), 500 ml water.';
  const ev = [{ type: 'food', food: 'huel', protein_g: 40, line }];
  const once = (notes) => buildHandoff({ day: { ...blankDay('2026-10-30'), eating_notes: notes }, sets: [], events: ev, fluids: [] }).split('\n').find(l => l.startsWith('EATING:'));
  eq(once(null), `EATING: ${line}`);
  eq(once(line), `EATING: ${line}`);
  eq(once('Eggs and rice.'), `EATING: Eggs and rice. ${line}`);
});
test('quick amounts are the last 4 different ones, topped up from the starting set', async () => {
  const { lastFour } = await import('../js/ui/forms.js');
  eq(lastFour([12, 12, 20, 8, 30, 40], [8, 16.9, 24, 25]), [12, 20, 8, 30]);
  eq(lastFour([12], [8, 16.9, 24, 25]), [12, 8, 16.9, 24]);
});
test('grip and pumps fill toward your average, then your best', async () => {
  const { towardBest } = await import('../js/status.js');
  const past = [5, 7, 8, 0];                 // a day with none is left out: average 7 (6.7), best 8
  eq(towardBest(3, []), { p: 0, stage: null, label: ' today' });
  eq(towardBest(5, past).label, ' / 7 avg'); eq(towardBest(5, past).stage, 'avg');
  eq(towardBest(7, past), { p: 0, stage: 'best', label: ' / 8 best' });
  eq(towardBest(8, past), { p: 1, stage: 'top', label: ' best' });
  eq(towardBest(9, past).label, ' new best');
});
test('voice stop counts only "stop" as the best guess, past the mark, twice in a row', async () => {
  const { judge } = await import('../js/listen.js');
  const S = (stop, noise = 0.1) => [noise, 0.05, 0.05, stop];   // background, unknown, go, stop
  eq([S(0.9), S(0.1)].map(x => judge(x, 3, 0.6)), [false, false]);          // a lone spike never counts
  eq([S(0.55, 0.4), S(0.58, 0.3), S(0.6, 0.2)].map(x => judge(x, 3, 0.6)), [false, false, false]);
  eq([S(0.7, 0.8), S(0.7, 0.8)].map(x => judge(x, 3, 0.6)), [false, false]); // noise is the best guess
  eq([S(0.7), S(0.75)].map(x => judge(x, 3, 0.6)), [false, true]);          // two in a row: stop
});
test('meters rowed: logged in the row block, printed and read back', () => {
  const plan = planFor('2026-10-30');
  const steps = plan.program.data.BLOCKS.row.steps.filter(s => s.kind === 'set').map(s => `${s.exercise}:${s.log}`);
  eq(steps, ['row:min', 'row_dist:m']);
  const out = buildHandoff({ day: blankDay('2026-10-30'), sets: [{ date: '2026-10-30', exercise: 'row', min: 18, block: 'row' }, { date: '2026-10-30', exercise: 'row_dist', m: 3747, block: 'row' }], events: [], fluids: [] });
  if (!out.includes('  ROW_M: 3747')) throw new Error('ROW_M missing');
  eq(parseHandoff('DATE: 2026-10-30\n  ROW_M: 3747').day.row_m, 3747);
});
group('Program');
test('push tips follow the progression rules and your last session', async () => {
  const { pushTip } = await import('../js/ui/detail.js');
  const EX = planFor('2026-10-29').program.data.EXERCISES;
  const S = (n, o = {}) => ({ reps: n, ...o });
  const prev = rows => ({ date: '2026-10-26', rows });
  const step = (...a) => pushTip(...a).step;
  eq(step('neutral_pullup', [S(2), S(2), S(5, { mode: 'negative' })], null, EX), 'Turn a negative into full reps');
  eq(step('chin_up', [S(5), S(5), S(5)], prev([S(5), S(5), S(5)]), EX), 'Add a rep to one set');
  eq(step('goblet', [S(30, { lb: 25 }), S(28, { lb: 25 })], prev([S(25)]), EX), '30 reps at 25 lb: go heavier');
  eq(step('goblet', [S(12), S(12)], prev([S(11), S(11)]), EX), 'Up 2. Keep building');
  eq(step('paused_pushup', [S(10)], prev([S(10)]), EX), 'Same as last. +1 on set 1');
  eq(pushTip('windmills', [S(15)], null, EX), { name: 'Windmills (forearm rotation)', step: 'Beat 15 at 20 lb', rule: false });
  eq(step('sl_rdl', [S(10, { side: 'L', lb: 20 }), S(10, { side: 'R', lb: 20 })], null, EX), 'Beat 10 a side at 20 lb');
  eq(step('dead_hang', [{ sec: 25 }], prev([{ sec: 20 }]), EX), 'Up 5 sec. Keep it active');
});
test('transitions: start 5, sides 5, new position 10, after rest 0, row segments 0', () => {
  const R = planFor('2026-10-27').program.data.BLOCKS.row.steps;
  const at = t => R.findIndex(s => s.text === t);
  const tr = t => transitionSec(R[at(t) - 1], R[at(t)]);
  eq([tr('Lunge with reach, left leg forward'), tr('Lunge with reach, right leg forward'), tr('Calf stretch, right leg'), tr('Hamstring stretch'), tr('Row steady, 15 min'), tr('Row easy, 1-2 min')], [10, 5, 5, 10, 0, 0]);
  eq(transitionSec(undefined, { kind: 'timed' }), 5);
  eq(transitionSec({ kind: 'rest' }, { kind: 'timed' }), 0);
});
group('Data');
test('hourly history: imported palms plus app blocks, next alternates', () => {
  const { day } = parseHandoff(SAMPLE);
  const hist = hourlyHistory(day, [{ type: 'block_done', block: 'hourly', palms: 'down', at: '2026-10-27T19:00:00Z' }]);
  eq(hist.map(x => x.palms), [null, 'down', 'up', 'down']);
  eq(nextPalms(hist), 'up');
});
await Promise.all(waits);
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
  group('Verses');
  results.push(['every bank verse has Greek or Hebrew key words', !missingWords.length, missingWords.join(', ')]);
  if (missingWords.length) failed.push(results[results.length - 1]);
  // The service worker must parse, or phones silently stop taking updates.
  group('App rules');
  try { new Function(fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8')); results.push(['sw.js parses', true]); }
  catch (e) { results.push(['sw.js parses', false, e.message]); failed.push(results[results.length - 1]); }
  { const swText = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
    const install = (swText.match(/addEventListener\('install'[^\n]*/) || [''])[0];
    results.push(['an update waits for the tap (no skipWaiting on install)', !/skipWaiting/.test(install) && /'skipWaiting'/.test(swText), install]);
    // App files must come from the version in charge, or new code runs before the tap.
    const own = swText.slice(swText.indexOf('if (url.origin === location.origin)'));
    results.push(['app files come from the version in charge', own.indexOf('c.match(') > -1 && own.indexOf('c.match(') < own.indexOf('fetch(e.request')]); }
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
  // Verse study: key words of James 1:5 are found in the NKJV text and highlighted.
  const { markKeyWords } = await import('../js/ui/verse.js');
  const nkjv = 'If any of you lacks wisdom, let him ask of God, who gives to all liberally and without reproach, and it will be given to him.';
  const mk = markKeyWords(nkjv, orig.verses['James 1:5'].words);
  const hl = mk.parts.filter(p => p.w).map(p => p.t.toLowerCase());
  const okKw = ['lacks', 'wisdom', 'ask', 'god'].every(x => hl.includes(x)) && mk.parts.map(p => p.t).join('') === nkjv;
  group('Verses');
  results.push(['verse study highlights key words without changing the text', okKw, hl.join(', ')]);
  if (!okKw) failed.push(results[results.length - 1]);
  // Every key word lands inside the verse text (no separate chips), for James 1:5 and Galatians 6:9 in NKJV.
  {
    const { markWords } = await import('../js/ui/verse.js');
    const cases = [['James 1:5', nkjv, { liberally: 'generously', 'without reproach': 'finding fault' }],
      ['Galatians 6:9', 'And let us not grow weary while doing good, for in due season we shall reap if we do not lose heart.', { good: 'in well', season: 'in time', 'lose heart': 'giving up' }]];
    for (const [ref, t, expect] of cases) {
      const r = markWords(t, orig.verses[ref].words);
      const map = Object.fromEntries(r.parts.filter(p => p.w).map(p => [p.t.toLowerCase(), p.w.en]));
      const ok = !r.leftover.length && r.parts.map(p => p.t).join('') === t && Object.entries(expect).every(([k, v]) => map[k] === v);
      results.push([`${ref}: every key word sits inside the text`, ok, JSON.stringify(map)]);
      if (!ok) failed.push(results[results.length - 1]);
    }
  }
  group('App rules');
  // Design-system guards: every size and color comes from tokens.css, every selector is defined once, and text is
  // only ever fitted by the one routine in dom.js.
  {
    const css = fs.readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
    const rawSize = [...css.matchAll(/font(?:-size)?\s*:\s*([^;}]*)/g)].map(m => m[1]).filter(v => /\d+px/.test(v) && !/var\(--fs-/.test(v));
    results.push(['no text size outside the type scale', !rawSize.length, rawSize.slice(0, 3).join(' | ')]);
    if (rawSize.length) failed.push(results[results.length - 1]);
    const rawColor = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)].map(m => m[0]).filter(c => !/^#000$|^rgb\((0 0 0|255 255 255|16 18 21)\b/.test(c));
    results.push(['no color outside the tokens', !rawColor.length, rawColor.slice(0, 3).join(' | ')]);
    if (rawColor.length) failed.push(results[results.length - 1]);
    // Selectors defined twice in the same scope (top level, or inside the same @media block).
    const scopes = [];
    let depth = 0, cur = [], mediaKey = 'top';
    for (const line of css.split('\n')) {
      const t = line.trim();
      if (t.startsWith('@media')) { if (/\}\s*$/.test(t) && (t.match(/\{/g) || []).length === (t.match(/\}/g) || []).length) continue; mediaKey = t.replace(/\s*\{.*$/, ''); cur = []; scopes.push([mediaKey, cur]); depth = 1; continue; }
      if (depth === 1 && t === '}') { depth = 0; mediaKey = 'top'; continue; }
      const m = t.match(/^([^@{}/][^{]*)\{/);
      if (m) { const target = depth === 1 ? cur : (scopes.find(x => x[0] === 'top') || scopes[scopes.push(['top', []]) - 1])[1]; target.push(m[1].trim().replace(/\s+/g, ' ')); }
    }
    const dupes = scopes.flatMap(([k, list]) => list.filter((x, i) => list.indexOf(x) !== i).map(x => `${x} (${k})`));
    results.push(['every selector defined once per scope', !dupes.length, [...new Set(dupes)].slice(0, 4).join(' | ')]);
    if (dupes.length) failed.push(results[results.length - 1]);
    // Line height 1 cuts off descenders (the g in "hangs") wherever a box clips; nothing may use it.
    const lh1 = [...css.matchAll(/(?:line-height:\s*1\s*[;}]|\/1\s+var\()/g)].length;
    results.push(['no line height of 1 (descenders stay whole)', !lh1, `${lh1} found`]);
    if (lh1) failed.push(results[results.length - 1]);
    const sizers = jsFiles.filter(f => !f.endsWith('dom.js') && /style\.fontSize/.test(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')));
    results.push(['text is fitted only by dom.js fitText', !sizers.length, sizers.join(', ')]);
    if (sizers.length) failed.push(results[results.length - 1]);
  }
  // One line per group; a failing test is named under its group with the reason.
  for (const g of [...new Set(['Program', 'Data', 'Verses', 'Reminders', 'App rules', ...results.map(r => r[3])])]) {
    const rs = results.filter(r => r[3] === g), bad = rs.filter(r => !r[1]);
    console.log(`${g.padEnd(10)} ${bad.length ? `${bad.length} of ${rs.length} failed` : `${rs.length} passed`}`);
    for (const [n, , m] of bad) console.log(`  FAIL ${n}${m ? ': ' + m : ''}`);
  }
  console.log(failed.length ? `${failed.length} failed` : `All ${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}
