// Seconds to get into position before a timed step. Pure function, shared by the runner and the tests.
export function transitionSec(prev, next) {
  if (next.setup !== undefined) return next.setup;                  // set per step in the program (0 = keep going)
  if (!prev) return 5;                                               // block start: get ready
  if (prev.kind === 'rest') return 0;                                // the rest was the transition
  if (prev.exercise && prev.exercise === next.exercise) return 5;    // switch sides, same position
  return 10;                                                         // new position
}
