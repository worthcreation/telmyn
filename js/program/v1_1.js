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
};

const C = {
  armCircles: 'Start small and grow. Shoulders down, away from the ears.',
  wrist: 'Slow full circles. Loosens the wrists before grip work.',
  catCow: 'On hands and knees. Breathe in as the back drops, out as it rounds.',
  lungeReach: 'Squeeze the back glute, then reach the same-side arm overhead.',
  calf: 'Back heel down, back knee straight, toes forward. Lean into the wall.',
  hamstring: 'Heel forward, toes up. Hinge at the hips with a flat back.',
  hipLunge: 'Back knee down. Tuck the pelvis and squeeze the back glute.',
  doorway: 'Forearm on the frame, elbow at shoulder height. Step through gently.',
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
    name: 'Morning stretch', minutes: 6, video: 'morning_stretch', verseOpens: true,
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
    name: 'Fab Five', minutes: 7, video: 'fab_five', note: '20 lb. Keep the weights in hand until step 6.',
    steps: [
      step.do('Grip warmup: squeeze and hammer the dumbbells', { cue: 'Wakes up the grip before the circuit.' }),
      step.do('Curls x10', { cue: 'Elbows stay at your sides. Full stretch at the bottom.' }),
      step.do('Reverse flies x10', { cue: 'Hinge forward, flat back. Squeeze the shoulder blades together.' }),
      step.do('Floor-to-overhead press x10', { cue: 'Hips back to reach the floor, then drive up and press. Brace the core.' }),
      step.do('Reverse rows x10', { cue: 'Follow the video for form.' }),
      step.do('Squats or deadlifts x10, then set the weights down', { cue: 'Weight in the heels, chest up.' }),
      step.timed('Squat hold, weight on heels, 45-60 sec', 60, { cue: 'Sit deep, heels down, chest up. Stop at 45 if needed.' }),
      ...phase('Cooldown', [doorway, ...eachSide('Forearm stretch', 30, { exercise: 'forearm', cue: C.forearmUp }, 'arm')]),
    ],
  },

  strength_a: {
    name: 'Strength A', minutes: 50, xpSkills: ['strength', 'grip'],
    steps: [
      step.rest(180, 'Rest 3 min after the Fab Five'),
      ...strengthWarmup,
      ...sets(3, i => step.set('chin_up', `Chin-ups, set ${i}`, { note: PULL_RULE, modes: ['full', 'negative'], set_no: i, cue: 'Dead hang to chin over the bar. Control the way down.' }), 120),
      ...sides(3, 'bss', 'Bulgarian split squats, 25s, 3 sec down', 30, [90, 'Rest 90 sec'], { cue: 'Front shin near vertical. Push through the front heel.' }),
      ...sets(3, i => step.set('pushup', `Push-ups, set ${i}, 3 sec down, near failure`, { set_no: i, cue: 'Body straight as a plank. Chest close to the floor.' }), 90),
      ...sides(3, 'sa_row', 'Single-arm rows, 25, 3 sec down', 0, [90, 'Rest 60-90 sec'], { cue: 'Flat back. Pull toward the hip, squeeze, lower slowly.' }, 'arm'),
      ...sets(3, i => step.set('magnet_curl', `Magnet curls, set ${i}, 20s, 3-4 sec down`, { note: 'Stop 1-2 short of failure.', set_no: i }), 60),
      ...windmills,
      ...strengthCooldown,
    ],
  },

  strength_b: {
    name: 'Strength B', minutes: 50, xpSkills: ['strength', 'grip'],
    steps: [
      step.rest(180, 'Rest 3 min after the Fab Five'),
      ...strengthWarmup,
      ...sets(3, i => step.set('neutral_pullup', `Neutral-grip pull-ups, set ${i}`, { note: PULL_RULE, modes: ['full', 'negative'], set_no: i, cue: 'Palms facing each other. Dead hang to chin over the bar.' }), 120),
      ...sides(3, 'sl_rdl', 'Single-leg RDL, 25 in opposite hand', 30, [90, 'Rest 90 sec'], { cue: 'Hips back, flat back, slight knee bend. Keep the hips square.' }),
      ...sets(3, i => step.set('goblet', `Goblet squats, set ${i}, 25, 2 sec pause at bottom`, { set_no: i, cue: 'Weight close to the chest. Sit between the heels.' }), 90),
      ...sets(3, i => step.set('paused_pushup', `Paused push-ups, set ${i}, 2 sec at bottom`, { set_no: i, cue: 'Pause just off the floor and stay tight.' }), 90),
      ...sets(2, i => step.set('magnet_curl', `Magnet curls, set ${i}`, { set_no: i }), 60),
      step.rest(60),
      ...sets(2, i => step.set('champagne_curl', `Champagne curls, set ${i}`, { set_no: i }), 60),
      ...windmills,
      ...strengthCooldown,
    ],
  },

  row: {
    name: 'Row', minutes: 30, video: 'row', xpSkills: ['endurance'],
    note: 'Damper 3-5. Drive: legs, body, arms. Return: arms, body, knees. Loose grip.',
    steps: [
      ...phase('Warm-up', [
        step.do('Cat-cow, 8 slow reps', { exercise: 'cat_cow', cue: C.catCow }),
        ...eachSide('Lunge with reach', 30, { exercise: 'lunge_reach', cue: C.lungeReach }, 'leg forward'),
        ...armCircles,
      ]),
      step.do('Set the damper to 3-5', { exercise: 'row', cue: 'Higher is not harder work, just heavier feel. 3-5 is right.' }),
      step.timed('Very easy', 120, { exercise: 'row', cue: 'Finishes the warm-up. Smooth, no effort.' }),
      step.timed('Conversational pace', 900, { exercise: 'row', setup: 0, cue: 'You could talk in full sentences. Legs, body, arms.' }),
      step.timed('Easy cooldown, 1-2 min', 120, { exercise: 'row', setup: 0, cue: 'Let the heart rate come down.' }),
      step.set('row', 'Total minutes rowed', { log: 'min', logField: 'row_min', cue: 'Enter what the monitor shows.' }),
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
    name: 'Dead hangs', minutes: 7, video: 'dead_hang',
    note: 'Bend knees back for a full straight-arm hang. Can replace one hourly block.',
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
    name: 'Hourly block', minutes: 3, repeatable: true, workdaysOnly: true,
    note: 'CoC Trainer. Arms extended. Recite the verse during each 5 sec hold.',
    steps: [
      step.do('Palms', { choice: 'palms', options: ['up', 'down'] }),
      ...phase('Warm-up', [step.do('Wrist circles, 10 each way', { exercise: 'wrist_circles', cue: C.wrist })]),
      step.do('Left hand: 15 squeezes, calf raise with each', { cue: 'Full squeeze each rep, arm extended.' }),
      step.timed('Left hand: squeeze and hold', 5, { setup: 0, cue: 'Recite the verse.' }),
      step.do('Right hand: 15 squeezes, calf raise with each', { cue: 'Full squeeze each rep, arm extended.' }),
      step.timed('Right hand: squeeze and hold', 5, { setup: 0, cue: 'Recite the verse.' }),
      ...phase('Cooldown', forearmHolds(15)),
    ],
  },

  walk: { name: 'Optional walk', optional: true, steps: [step.do('Walk', { cue: 'Easy pace. Count it as recovery.' })] },

  evening_legs: {
    name: 'Legs up', minutes: 15, note: 'Legs above heart level.',
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
