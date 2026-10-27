// Program v1, effective 2026-10-27. Content only, no logic.
// A new program is a new file (v2.js) registered in program/index.js with its effective date. Never edit v1 after v2 exists.

const step = {
  do: (text, o = {}) => ({ kind: 'do', text, ...o }),
  timed: (text, sec, o = {}) => ({ kind: 'timed', text, sec, ...o }),
  rest: (sec, text) => ({ kind: 'rest', sec, text: text || `Rest ${sec >= 60 && sec % 60 === 0 ? sec / 60 + ' min' : sec + ' sec'}` }),
  set: (exercise, text, o = {}) => ({ kind: 'set', exercise, text, log: o.log || 'reps', ...o }),
};

// n sets with a rest step between each (no rest after the last set).
function sets(n, make, restSec, restText) {
  const out = [];
  for (let i = 1; i <= n; i++) { out.push(make(i)); if (i < n) out.push(step.rest(restSec, restText)); }
  return out;
}

// Per-leg or per-arm work: left, short rest, right, round rest.
function sides(n, exercise, text, betweenSec, roundSec, o = {}, word = 'leg') {
  const out = [];
  for (let i = 1; i <= n; i++) {
    out.push(step.set(exercise, `${text}, set ${i}, left ${word}`, { ...o, side: 'L', set_no: i }));
    if (betweenSec) out.push(step.rest(betweenSec));
    out.push(step.set(exercise, `${text}, set ${i}, right ${word}`, { ...o, side: 'R', set_no: i }));
    if (i < n) out.push(step.rest(roundSec[0], roundSec[1]));
  }
  return out;
}

export const EXERCISES = {
  morning_stretch: { name: 'Morning stretch follow-along', video: 'https://www.youtube.com/watch?v=Ptj-NEb5oB4' },
  fab_five: { name: 'Fab Five', video: 'https://www.facebook.com/david.gates.158794/videos/the-best-five-minute-routine-on-the-internet/886741237091022/' },
  scap_pullup: { name: 'Scapular pull-ups', video: 'https://www.youtube.com/shorts/r80W32kushY' },
  dead_hang: { name: 'Active hang', video: 'https://www.youtube.com/watch?v=OT-wTpxP9uo' },
  chin_up: { name: 'Chin-ups', video: 'https://www.youtube.com/shorts/ykPUIEj4-W0', alt: { label: 'Negatives', video: 'https://www.youtube.com/shorts/R8xhOUg8BlU' } },
  neutral_pullup: { name: 'Neutral-grip pull-ups', video: 'https://www.youtube.com/shorts/ykPUIEj4-W0', cue: 'Same as chin-ups with palms facing each other.', alt: { label: 'Negatives', video: 'https://www.youtube.com/shorts/R8xhOUg8BlU' } },
  bss: { name: 'Bulgarian split squats', video: 'https://www.youtube.com/shorts/or1frhkjBDc', weight_lb: 25 },
  pushup: { name: 'Push-ups' },
  paused_pushup: { name: 'Paused push-ups' },
  sa_row: { name: 'Single-arm rows', video: 'https://www.youtube.com/shorts/H8jf3DwlIlo', weight_lb: 25 },
  sl_rdl: { name: 'Single-leg RDL', video: 'https://www.youtube.com/shorts/3Remzb_h59I', weight_lb: 25 },
  goblet: { name: 'Goblet squats', video: 'https://www.youtube.com/shorts/0Qb98XYiuho', weight_lb: 25 },
  magnet_curl: { name: 'Magnet curls', weight_lb: 20, cue: '' },     // no standard video; cues to be written
  champagne_curl: { name: 'Champagne curls', weight_lb: 20, cue: '' },
  windmills: { name: 'Windmills (forearm rotation)', video: 'https://www.youtube.com/watch?v=VV7zsl6LafM' },
  row: { name: 'Rowing', video: 'https://www.youtube.com/watch?v=JunqWhTXTJs', alt: { label: 'Common errors', video: 'https://www.youtube.com/watch?v=ura2mFCdvVs' } },
};

const PULL_RULE = 'Full range. Stop 1-2 reps short of failure. Under 4 clean reps: 3-5 slow negatives instead.';

const warmup = [
  step.timed('Arm circles forward', 30),
  step.timed('Arm circles backward', 30),
  step.set('scap_pullup', 'Scapular pull-ups, 10 reps'),
  step.rest(30),
  step.set('dead_hang', 'Active hang, 15 sec', { log: 'sec', sec: 15, set_no: 1 }),
  step.rest(30),
  step.set('dead_hang', 'Active hang, 15 sec', { log: 'sec', sec: 15, set_no: 2 }),
  step.rest(60),
];

const cooldown = [
  step.timed('Calf stretch', 30),
  step.timed('Hamstring stretch', 30),
  step.timed('Doorway chest stretch', 30),
  step.timed('Forearm stretch', 30),
];

const windmills = sets(2, i => step.set('windmills', `Windmills, set ${i}, 15 slow`, { set_no: i }), 45);

export const BLOCKS = {
  stretch: {
    name: 'Morning stretch', minutes: 6, video: 'morning_stretch', verseOpens: true,
    steps: [
      step.timed('Standing toe touch, slow, knees soft', 30, { note: 'Note your fingertip reach.', logField: 'toe_touch_notes' }),
      step.rest(10),
      step.timed('Toe touch again', 30),
      step.do('Cat-cow, 8 slow reps'),
      step.timed('Lunge with reach, left leg forward', 30),
      step.timed('Lunge with reach, right leg forward', 30),
      step.timed('Calf stretch against wall, left leg', 30),
      step.timed('Calf stretch against wall, right leg', 30),
      step.timed('Doorway chest stretch', 30),
      step.do('Arm circles, 15 forward'),
      step.do('Arm circles, 15 backward'),
    ],
  },
  gates: {
    name: 'Fab Five', minutes: 5, video: 'fab_five', note: '20 lb. Keep the weights in hand until step 6.',
    steps: [
      step.do('Grip warmup: squeeze and hammer the dumbbells'),
      step.do('Curls x10'),
      step.do('Reverse flies x10'),
      step.do('Floor-to-overhead press x10'),
      step.do('Reverse rows x10'),
      step.do('Squats or deadlifts x10, then set the weights down'),
      step.timed('Squat hold, weight on heels, 45-60 sec', 60),
    ],
  },
  strength_a: {
    name: 'Strength A', minutes: 50, xpSkills: ['strength', 'grip'],
    steps: [
      step.rest(180, 'Rest 3 min after the Fab Five'),
      ...warmup,
      ...sets(3, i => step.set('chin_up', `Chin-ups, set ${i}`, { note: PULL_RULE, modes: ['full', 'negative'], set_no: i }), 120),
      ...sides(3, 'bss', 'Bulgarian split squats, 25s, 3 sec down', 30, [90, 'Rest 90 sec']),
      ...sets(3, i => step.set('pushup', `Push-ups, set ${i}, 3 sec down, near failure`, { set_no: i }), 90),
      ...sides(3, 'sa_row', 'Single-arm rows, 25, 3 sec down', 0, [90, 'Rest 60-90 sec'], {}, 'arm'),
      ...sets(3, i => step.set('magnet_curl', `Magnet curls, set ${i}, 20s, 3-4 sec down`, { note: 'Stop 1-2 short of failure.', set_no: i }), 60),
      ...windmills,
      ...cooldown,
    ],
  },
  strength_b: {
    name: 'Strength B', minutes: 50, xpSkills: ['strength', 'grip'],
    steps: [
      step.rest(180, 'Rest 3 min after the Fab Five'),
      ...warmup,
      ...sets(3, i => step.set('neutral_pullup', `Neutral-grip pull-ups, set ${i}`, { note: PULL_RULE, modes: ['full', 'negative'], set_no: i }), 120),
      ...sides(3, 'sl_rdl', 'Single-leg RDL, 25 in opposite hand', 30, [90, 'Rest 90 sec']),
      ...sets(3, i => step.set('goblet', `Goblet squats, set ${i}, 25, 2 sec pause at bottom`, { set_no: i }), 90),
      ...sets(3, i => step.set('paused_pushup', `Paused push-ups, set ${i}, 2 sec at bottom`, { set_no: i }), 90),
      ...sets(2, i => step.set('magnet_curl', `Magnet curls, set ${i}`, { set_no: i }), 60),
      step.rest(60),
      ...sets(2, i => step.set('champagne_curl', `Champagne curls, set ${i}`, { set_no: i }), 60),
      ...windmills,
      ...cooldown,
    ],
  },
  row: {
    name: 'Row', minutes: 20, video: 'row', xpSkills: ['endurance'],
    note: 'Damper 3-5. Drive: legs, body, arms. Return: arms, body, knees. Loose grip.',
    steps: [
      step.do('Set the damper to 3-5'),
      step.timed('Very easy', 120),
      step.timed('Conversational pace', 900),
      step.timed('Easy cooldown, 1-2 min', 120),
      step.set('row', 'Total minutes rowed', { log: 'min', logField: 'row_min' }),
    ],
  },
  hangs: {
    name: 'Dead hangs', minutes: 4, video: 'dead_hang', note: 'Bend knees back for a full straight-arm hang.',
    steps: sets(3, i => step.set('dead_hang', `Active hang, set ${i}, 10-20 sec`, { log: 'sec', set_no: i }), 60),
  },
  hourly: {
    name: 'Hourly block', minutes: 2, repeatable: true, workdaysOnly: true,
    note: 'CoC Trainer. Arms extended. Recite the verse during each 5 sec hold.',
    steps: [
      step.do('Palms', { choice: 'palms', options: ['up', 'down'] }),
      step.do('Left hand: 15 squeezes, calf raise with each, 5 sec hold at the end'),
      step.do('Right hand: 15 squeezes, calf raise with each, 5 sec hold at the end'),
    ],
  },
  walk: { name: 'Optional walk', optional: true, steps: [step.do('Walk')] },
  evening_legs: {
    name: 'Legs up', minutes: 15, note: 'Legs above heart level.',
    steps: [step.timed('Legs elevated above heart, 10-15 min', 900)],
  },
};

export const DAY_TYPES = {
  strength_a: { label: 'Strength A', routine: 'strength_a' },
  strength_b: { label: 'Strength B', routine: 'strength_b' },
  row: { label: 'Row', routine: 'row' },
  off: { label: 'Off', routine: null },
  off_walk: { label: 'Off', routine: 'walk' },
};

// 0 Sun .. 6 Sat
export const SCHEDULE = ['off_walk', 'strength_a', 'row', 'off', 'strength_b', 'row', 'row'];

// Tight blocks have a time and will get alarms (phase 2). Open blocks appear when the previous one is done.
export const DEFAULT_TIMING = {
  workday: { stretch: { mode: 'tight', time: '06:30' } },
  weekend: {},
};

export const HABITS = {
  ankle_pumps: { name: 'Ankle pumps', note: '20 per foot, every 20-30 min while sitting.' },
};

export const TARGETS = { fluids_oz: [100, 120], protein_g: [160, 200] };
