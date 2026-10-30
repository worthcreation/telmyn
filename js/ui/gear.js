// Gear tab: what Ross trains with, what is in use now, and the rule for moving up. Facts from the program only.
import { h, fill } from './dom.js';
import { state } from '../state.js';

const GEAR = [
  { name: 'Grippers', kind: 'Captains of Crush', ladder: ['Trainer', 'No. 1', 'No. 1.5'], current: 'Trainer', use: 'Grip breaks, 15 squeezes each hand.', rule: 'Owned: Trainer, No. 1, No. 1.5.' },
  { name: 'Dumbbells', kind: 'Fixed, 3-25 lb', ladder: ['20 lb', '25 lb'], current: null, use: '20s: Fab Five, magnet and champagne curls. 25s: split squats, rows, RDLs, goblet squats.', rule: '30 clean, slow reps of a movement means the weight is too light for it.' },
  { name: 'Pull-up bar', kind: 'Doorway', ladder: ['Negatives', 'Full reps'], current: null, use: 'Chin-ups (Mon), neutral grip (Thu), hangs. Bend knees back for a straight-arm hang.', rule: 'Add a rep to one set when all 3 sets match two sessions in a row.' },
  { name: 'Rower', kind: 'Damper 3-5', ladder: ['15 min', '20 min'], current: '15 min', use: 'Tue, Fri, Sat: 2 easy, 15 conversational, 1-2 easy.', rule: 'After 3 weeks of comfortable 15 min sessions: 20 min or one interval day.' },
];

export function renderGear(root) {
  const best = ex => Math.max(0, ...state.sets.filter(s => ex.test(s.exercise) && s.reps).map(s => s.reps));
  fill(root,
    h('header', { class: 'top' }, h('p', { class: 'date' }, 'What you train with'), h('h1', { class: 'daytype' }, 'Gear')),
    h('section', { class: 'gear' }, GEAR.map(g => h('article', { class: 'gear-card' },
      h('div', { class: 'gear-head' }, h('span', { class: 'gear-name' }, g.name), h('span', { class: 'gear-kind' }, g.kind)),
      h('div', { class: 'ladder' }, g.ladder.map(x => h('span', { class: x === g.current ? 'on' : '' }, x))),
      h('p', { class: 'gear-use' }, g.use, g.name === 'Pull-up bar' && best(/chin_up|neutral_pullup/) ? ` Best set today: ${best(/chin_up|neutral_pullup/)}.` : ''),
      h('p', { class: 'gear-rule' }, g.rule)))));
}
