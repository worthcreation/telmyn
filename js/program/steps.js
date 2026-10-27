// Step builders shared by program versions from v1.1 on. (v1.js keeps its own copy and is frozen.)
// Every step: kind, text, and optionally cue (one short form or purpose line), exercise (for Watch links), sec.

export const step = {
  do: (text, o = {}) => ({ kind: 'do', text, ...o }),
  timed: (text, sec, o = {}) => ({ kind: 'timed', text, sec, ...o }),
  rest: (sec, text) => ({ kind: 'rest', sec, text: text || `Rest ${sec >= 60 && sec % 60 === 0 ? sec / 60 + ' min' : sec + ' sec'}` }),
  set: (exercise, text, o = {}) => ({ kind: 'set', exercise, text, log: o.log || 'reps', ...o }),
};

// n sets with a rest step between each (no rest after the last).
export function sets(n, make, restSec, restText) {
  const out = [];
  for (let i = 1; i <= n; i++) { out.push(make(i)); if (i < n) out.push(step.rest(restSec, restText)); }
  return out;
}

// Left, short rest, right, round rest.
export function sides(n, exercise, text, betweenSec, round, o = {}, word = 'leg') {
  const out = [];
  for (let i = 1; i <= n; i++) {
    out.push(step.set(exercise, `${text}, set ${i}, left ${word}`, { ...o, side: 'L', set_no: i }));
    if (betweenSec) out.push(step.rest(betweenSec));
    out.push(step.set(exercise, `${text}, set ${i}, right ${word}`, { ...o, side: 'R', set_no: i }));
    if (i < n) out.push(step.rest(round[0], round[1]));
  }
  return out;
}

// A timed hold done on each side as two steps.
export const eachSide = (text, sec, o = {}, word = 'side') => [
  step.timed(`${text}, left ${word}`, sec, o),
  step.timed(`${text}, right ${word}`, sec, o),
];

// Tag a list of steps with a phase so the runner can label warm-up and cooldown.
export const phase = (name, steps) => steps.map(s => ({ ...s, phase: name }));
