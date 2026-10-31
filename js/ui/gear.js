// Gear tab: what Ross trains with, what is in use now, and the rule for moving up. Facts from the program only.
import { h, fill } from './dom.js';
import { state } from '../state.js';
import { pullReps } from '../log.js';

const SHORT = { 'Bulgarian split squats': 'split squats', 'Single-arm rows': 'rows', 'Single-leg RDL': 'RDLs', 'Windmills (forearm rotation)': 'windmills' };
function dumbbellUse() {
  const EX = state.plan.program.data.EXERCISES, by = {};
  for (const e of Object.values(EX)) if (e.weight_lb) (by[e.weight_lb] ||= []).push(SHORT[e.name] || (e.name === 'Fab Five' ? e.name : e.name.toLowerCase()));
  return Object.keys(by).sort((a, b) => a - b).map(lb => `${lb}s: ${by[lb].join(', ')}.`).join(' ');
}

const GEAR = [
  { name: 'Grippers', kind: 'Captains of Crush', ladder: ['Trainer', 'No. 1', 'No. 1.5'], current: 'Trainer', use: 'Grip breaks, 15 squeezes each hand.', rule: 'Owned: Trainer, No. 1, No. 1.5.' },
  // use is built from the program's starting weights (EXERCISES.weight_lb), so it is never out of step with the runner.
  { name: 'Dumbbells', kind: 'Fixed, 3-25 lb', ladder: ['20 lb', '25 lb'], current: null, use: dumbbellUse, rule: '30 clean, slow reps of a movement means the weight is too light for it.' },
  { name: 'Pull-up bar', kind: 'Doorway', ladder: ['Negatives', 'Full reps'], current: null, use: 'Chin-ups (Mon), neutral grip (Thu), hangs. Bend knees back for a straight-arm hang.', rule: 'Add a rep to one set when all 3 sets match two sessions in a row.' },
  { name: 'Rower', kind: 'Damper 3-5', ladder: ['15 min', '20 min'], current: '15 min', use: 'Tue, Fri, Sat: 2 easy, 15 conversational, 1-2 easy.', rule: 'After 3 weeks of comfortable 15 min sessions: 20 min or one interval day.' },
];

export function renderGear(root) {
  const best = Math.max(0, ...pullReps(state.sets));
  fill(root,
    h('header', { class: 'top' }, h('p', { class: 'date' }, 'What you train with'), h('h1', { class: 'daytype' }, 'Gear')),
    h('section', { class: 'gear' }, GEAR.map(g => h('article', { class: 'gear-card' },
      h('div', { class: 'gear-head' }, h('span', { class: 'gear-name' }, g.name), h('span', { class: 'gear-kind' }, g.kind)),
      h('div', { class: 'ladder' }, g.ladder.map(x => h('span', { class: x === g.current ? 'on' : '' }, x))),
      h('p', { class: 'gear-use' }, typeof g.use === 'function' ? g.use() : g.use, g.name === 'Pull-up bar' && best ? ` Best set today: ${best}.` : ''),
      h('p', { class: 'gear-rule' }, g.rule)))));
}
