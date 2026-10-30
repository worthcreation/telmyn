// Program v1.1, effective 2026-10-27 (Ross's request): a warm-up before and a cooldown after every round,
// a short cue on every step, hangs placed before the row on non-strength days.
// Warm-ups are moving stretches; cooldowns are static holds of about 30 sec (Ross is already very flexible,
// so holds stay short; the goal is warming up and settling down, not adding range).
import { step, sets, sides, eachSide, phase } from './steps.js';
import * as v1 from './v1.js';

export const EXERCISES = {
  ...v1.EXERCISES,
  arm_circles: { name: 'Arm circles' },
  wrist_circles: { name: 'Wrist circles' },
  cat_cow: { name: 'Cat-cow' },
  lunge_reach: { name: 'Lunge with reach' },
  calf_wall: { name: 'Calf stretch at wall' },
  hamstring: { name: 'Hamstring stretch' },
  hip_lunge: { name: 'Lunge hip stretch' },
  doorway_chest: { name: 'Doorway chest stretch' },
  forearm: { name: 'Forearm stretch', video: 'https://www.youtube.com/watch?v=mLVLLGUbyfU&t=36s' }, // approved by Ross 2026-10-27, starts at 0:36
  toe_touch: { name: 'Toe touch' },
  // Starting weights (Ross, 2026-10-30): 25 lb for RDLs and squats, 20 lb for arm work (rows and curls). The runner
  // starts each exercise at the weight of your last session and shows it on the step, so step texts name no weight.
  bss: { ...v1.EXERCISES.bss, weight_lb: 25 },
  goblet: { ...v1.EXERCISES.goblet, weight_lb: 25 },
  sl_rdl: { ...v1.EXERCISES.sl_rdl, weight_lb: 25 },
  sa_row: { ...v1.EXERCISES.sa_row, weight_lb: 20 },
  magnet_curl: { ...v1.EXERCISES.magnet_curl, weight_lb: 20 },
  champagne_curl: { ...v1.EXERCISES.champagne_curl, weight_lb: 20 },
};

const C = {
  armCircles: 'Start small and grow. Shoulders down, away from the ears.',
  wrist: 'Slow full circles. Loosens the wrists before grip work.',
  catCow: 'Hands and knees. Breathe in and let the belly drop, breathe out and round the back up.',
  lungeReach: 'Long lunge, back knee off the floor. Squeeze the back glute and reach that same arm up overhead.',
  calf: 'Back heel down, back knee straight, toes forward. Lean into the wall.',
  hamstring: 'Heel forward on the floor, toes up, knee soft. Hinge at the hips with a flat back until the back of the thigh stretches.',
  hipLunge: 'Kneel on the back knee, front foot flat. Tuck the pelvis and squeeze the back glute. Stretch is in the front of the back hip.',
  doorway: 'Field goal arms: forearms on each side of the door frame, elbows at shoulder height. Step one foot through and bend that knee until the chest stretches. Ease off if the arm tingles.',
  forearmUp: 'Arm straight, palm up. Gently pull the fingers back.',
  forearmDown: 'Arm straight, palm down. Gently press the hand down.',
  hold: 'Easy tension, no bouncing. Breathe.',
};

const armCircles = [
  step.do('Arm circles, 15 forward', { exercise: 'arm_circles', cue: C.armCircles }),
  step.do('Arm circles, 15 backward', { exercise: 'arm_circles', cue: C.armCircles }),
];
const forearmHolds = sec => [
  ...eachSide('Forearm stretch, palm up', sec, { exercise: 'forearm', cue: C.forearmUp }, 'arm'),
  ...eachSide('Forearm stretch, palm down', sec, { exercise: 'forearm', cue: C.forearmDown }, 'arm'),
];
const doorway = step.timed('Doorway chest stretch', 30, { exercise: 'doorway_chest', cue: C.doorway });

const PULL_RULE = 'Full range. Stop 1-2 reps short of failure. Under 4 clean reps: 3-5 slow negatives instead.';

const HANG_CUE = 'Shoulders pulled down from the ears, ribs down, arms straight.';
const strengthWarmup = phase('Warm-up', [
  step.timed('Arm circles forward', 30, { exercise: 'arm_circles', cue: C.armCircles }),
  step.timed('Arm circles backward', 30, { exercise: 'arm_circles', cue: C.armCircles, setup: 0 }),
  step.set('scap_pullup', 'Scapular pull-ups, 10 reps', { cue: 'Arms straight. Pull the shoulder blades down, then let them rise.' }),
  step.rest(30),
  step.set('dead_hang', 'Active hang, 15 sec', { log: 'sec', sec: 15, set_no: 1, setup: 5, cue: HANG_CUE }),
  step.rest(30),
  step.set('dead_hang', 'Active hang, 15 sec', { log: 'sec', sec: 15, set_no: 2, setup: 5, cue: HANG_CUE }),
  step.rest(60),
]);

const strengthCooldown = phase('Cooldown', [
  ...eachSide('Calf stretch', 30, { exercise: 'calf_wall', cue: C.calf }, 'leg'),
  step.timed('Hamstring stretch', 30, { exercise: 'hamstring', cue: C.hamstring }),
  doorway,
  ...eachSide('Forearm stretch', 30, { exercise: 'forearm', cue: C.forearmUp }, 'arm'),
]);

const windmills = sets(2, i => step.set('windmills', `Windmills, set ${i}, 15 slow`, { set_no: i, cue: 'Slow forearm rotation. Follow the video.' }), 45);

export const BLOCKS = {
  stretch: {
    name: 'Morning stretch', summary: 'Toe touches, cat-cow, lunges, calf and chest stretches', minutes: 6, video: 'morning_stretch', verseOpens: true,
    steps: [
      step.timed('Standing toe touch, slow, knees soft', 30, { exercise: 'toe_touch', note: 'Note your fingertip reach.', logField: 'toe_touch_notes', cue: 'Let the head hang. No bouncing.' }),
      step.rest(10),
      step.timed('Toe touch again', 30, { exercise: 'toe_touch', cue: 'Let the head hang. No bouncing.' }),
      step.do('Cat-cow, 8 slow reps', { exercise: 'cat_cow', cue: C.catCow }),
      ...eachSide('Lunge with reach', 30, { exercise: 'lunge_reach', cue: C.lungeReach }, 'leg forward'),
      ...eachSide('Calf stretch against wall', 30, { exercise: 'calf_wall', cue: C.calf }, 'leg'),
      doorway,
      ...armCircles,
    ],
  },

  gates: {
    name: 'Fab Five', summary: 'Grip, curls, flies, press, rows, squats, squat hold', minutes: 7, video: 'fab_five', note: '20 lb. Keep the weights in hand until step 6.',
    steps: [
      step.do('Grip warm-up: squeeze and hammer the dumbbells', { cue: 'Squeeze the handles hard, then tilt them like hammers a few times.' }),
      step.do('Curls x10', { cue: 'Elbows stay at your sides. Full stretch at the bottom.' }),
      step.do('Reverse flies x10', { cue: 'Hinge forward, flat back. Squeeze the shoulder blades together.' }),
      step.do('Floor-to-overhead press x10', { cue: 'Hips back to reach the floor, then drive up and press. Brace the core.' }),
      step.do('Reverse rows x10', { cue: 'Hinge forward, pull both weights to your hips, squeeze the shoulder blades.' }),
      step.do('Squats or deadlifts x10, then set the weights down', { cue: 'Weight in the heels, chest up.' }),
      step.timed('Squat hold, 45-60 sec', 60, { cue: 'Sit deep, weight on the heels, chest up. Stop at 45 if needed.' }),
      ...phase('Cooldown', [doorway, ...eachSide('Forearm stretch', 30, { exercise: 'forearm', cue: C.forearmUp }, 'arm')]),
    ],
  },

  strength_a: {
    name: 'Strength A', summary: 'Chin-ups, split squats, push-ups, rows, curls', minutes: 50, xpSkills: ['strength', 'grip'],
    steps: [
      step.rest(180, 'Rest 3 min after the Fab Five'),
      ...strengthWarmup,
      ...sets(3, i => step.set('chin_up', `Chin-ups, set ${i}`, { note: PULL_RULE, modes: ['full', 'negative'], set_no: i, cue: 'Dead hang to chin over the bar. Control the way down.' }), 120),
      ...sides(3, 'bss', 'Bulgarian split squats, 3 sec down', 30, [90, 'Rest 90 sec'], { cue: 'Front shin near vertical. Push through the front heel.' }),
      ...sets(3, i => step.set('pushup', `Push-ups, set ${i}, 3 sec down, near failure`, { set_no: i, cue: 'Body straight as a plank. Chest close to the floor.' }), 90),
      ...sides(3, 'sa_row', 'Single-arm rows, 3 sec down', 0, [90, 'Rest 60-90 sec'], { cue: 'Flat back. Pull toward the hip, squeeze, lower slowly.' }, 'arm'),
      ...sets(3, i => step.set('magnet_curl', `Magnet curls, set ${i}, 3-4 sec down`, { note: 'Stop 1-2 short of failure.', set_no: i }), 60),
      ...windmills,
      ...strengthCooldown,
    ],
  },

  strength_b: {
    name: 'Strength B', summary: 'Pull-ups, single-leg RDLs, goblet squats, paused push-ups, curls', minutes: 50, xpSkills: ['strength', 'grip'],
    steps: [
      step.rest(180, 'Rest 3 min after the Fab Five'),
      ...strengthWarmup,
      ...sets(3, i => step.set('neutral_pullup', `Neutral-grip pull-ups, set ${i}`, { note: PULL_RULE, modes: ['full', 'negative'], set_no: i, cue: 'Palms facing each other. Dead hang to chin over the bar.' }), 120),
      ...sides(3, 'sl_rdl', 'Single-leg RDL, weight in opposite hand', 30, [90, 'Rest 90 sec'], { cue: 'Hips back, flat back, slight knee bend. Keep the hips square.' }),
      ...sets(3, i => step.set('goblet', `Goblet squats, set ${i}, 2 sec pause at bottom`, { set_no: i, cue: 'Weight close to the chest. Sit between the heels.' }), 90),
      ...sets(3, i => step.set('paused_pushup', `Paused push-ups, set ${i}, 2 sec at bottom`, { set_no: i, cue: 'Pause just off the floor and stay tight.' }), 90),
      ...sets(2, i => step.set('magnet_curl', `Magnet curls, set ${i}`, { set_no: i }), 60),
      step.rest(60),
      ...sets(2, i => step.set('champagne_curl', `Champagne curls, set ${i}`, { set_no: i }), 60),
      ...windmills,
      ...strengthCooldown,
    ],
  },

  row: {
    name: 'Row', summary: 'Warm-up, row 2 easy, 15 steady, 1-2 easy, cooldown', minutes: 30, video: 'row', xpSkills: ['endurance'],
    note: 'Damper 3-5. Drive: legs, body, arms. Return: arms, body, knees. Loose grip.',
    steps: [
      ...phase('Warm-up', [
        step.do('Cat-cow, 8 slow reps', { exercise: 'cat_cow', cue: C.catCow }),
        ...eachSide('Lunge with reach', 30, { exercise: 'lunge_reach', cue: C.lungeReach }, 'leg forward'),
        ...armCircles,
      ]),
      step.do('Set the damper to 3-5', { exercise: 'row', cue: 'The lever on the side of the fan. 3-5 feels like a light, quick boat.' }),
      step.timed('Row very easy, 2 min', 120, { exercise: 'row', cue: 'Smooth and light. This finishes the warm-up.' }),
      step.timed('Row steady, 15 min', 900, { exercise: 'row', setup: 0, cue: 'Easy enough to talk in full sentences. Legs, body, arms.' }),
      step.timed('Row easy, 1-2 min', 120, { exercise: 'row', setup: 0, cue: 'Let your breathing settle. Stop at 1 min if you like.' }),
      step.set('row', 'Minutes rowed', { log: 'min', logField: 'row_min', cue: 'Enter the total time from the monitor.' }),
      ...phase('Cooldown', [
        ...eachSide('Calf stretch', 30, { exercise: 'calf_wall', cue: C.calf }, 'leg'),
        step.timed('Hamstring stretch', 30, { exercise: 'hamstring', cue: C.hamstring }),
        ...eachSide('Lunge hip stretch', 30, { exercise: 'hip_lunge', cue: C.hipLunge }),
        doorway,
        ...eachSide('Forearm stretch', 30, { exercise: 'forearm', cue: C.forearmUp }, 'arm'),
      ]),
    ],
  },

  hangs: {
    name: 'Dead hangs', summary: 'Warm-up, 3 active hangs of 10-20 sec, cooldown', minutes: 7, video: 'dead_hang',
    note: 'Bend knees back for a full straight-arm hang. Can replace one grip break.',
    steps: [
      ...phase('Warm-up', [
        ...armCircles,
        step.do('Scapular pull-ups, 5 easy', { exercise: 'scap_pullup', cue: 'Arms straight. Pull the shoulder blades down, then let them rise.' }),
      ]),
      ...sets(3, i => step.set('dead_hang', `Active hang, set ${i}, 10-20 sec`, { log: 'sec', range: [10, 20], set_no: i, setup: 5, cue: HANG_CUE }), 60),
      ...phase('Cooldown', [doorway, ...eachSide('Forearm stretch', 30, { exercise: 'forearm', cue: C.forearmUp }, 'arm')]),
    ],
  },

  hourly: {
    name: 'Grip break', minutes: 3, repeatable: true, workdaysOnly: true,
    note: 'CoC Trainer. Arms extended. Recite the verse during each 5 sec hold.',
    steps: [
      step.do('Palms up or down?', { choice: 'palms', options: ['up', 'down'], cue: 'Alternate each block. The suggestion below follows your last one.' }),
      ...phase('Warm-up', [step.do('Wrist circles, 10 each way', { exercise: 'wrist_circles', cue: C.wrist })]),
      step.do('Left hand: 15 squeezes, calf raise with each', { cue: 'Full squeeze each rep, arm extended.' }),
      step.timed('Left hand: squeeze and hold', 5, { setup: 0, cue: 'Recite the verse.' }),
      step.do('Right hand: 15 squeezes, calf raise with each', { cue: 'Full squeeze each rep, arm extended.' }),
      step.timed('Right hand: squeeze and hold', 5, { setup: 0, cue: 'Recite the verse.' }),
      ...phase('Cooldown', forearmHolds(15)),
    ],
  },

  walk: { name: 'Optional walk', summary: 'Easy pace, counts as recovery', optional: true, steps: [step.do('Walk', { cue: 'Easy pace. Count it as recovery.' })] },

  evening_legs: {
    name: 'Legs up', summary: 'Lie back, legs above heart, 10-15 min', minutes: 15, note: 'Legs above heart level.',
    steps: [step.timed('Legs elevated above heart, 10-15 min', 900, { cue: 'Lie back with heels on the couch or wall. Stop at 10 min if needed.' })],
  },
};

export const DAY_TYPES = v1.DAY_TYPES;
export const SCHEDULE = v1.SCHEDULE;
export const DEFAULT_TIMING = v1.DEFAULT_TIMING;
export const HABITS = v1.HABITS;
export const TARGETS = v1.TARGETS;

// Hangs go before the routine, except on strength days, where they would tire the grip before pull-ups.
export function dayOrder(routine) {
  const strength = routine === 'strength_a' || routine === 'strength_b';
  if (!routine) return ['stretch', 'gates', 'hangs', 'evening_legs'];
  return strength
    ? ['stretch', 'gates', routine, 'hangs', 'evening_legs']
    : ['stretch', 'gates', 'hangs', routine, 'evening_legs'];
}
