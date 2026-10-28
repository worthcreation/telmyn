// App frame: status pills on top (every tab), the current tab, and the tab bar at the bottom.
import { h, fill } from './dom.js';
import { state } from '../state.js';
import { fluidTotals } from '../schema.js';
import { hourlyHistory } from '../hourly.js';
import { TEST, hhmm } from '../clock.js';
import { fluidSheet, proteinSheet } from './forms.js';
import { renderToday } from './today.js';
import { renderProgress } from './progress.js';
import { renderGear } from './gear.js';
import { renderMe } from './me.js';
import { testSheet } from './data.js';

const TABS = [
  { id: 'today', label: 'Today', icon: '◉', render: renderToday },
  { id: 'progress', label: 'Progress', icon: '▤', render: renderProgress },
  { id: 'gear', label: 'Gear', icon: '◆', render: renderGear },
  { id: 'me', label: 'Me', icon: '☰', render: renderMe },
];
const current = () => TABS.find(t => `#${t.id}` === location.hash) || TABS[0];

// Labeled fill bar: the numbers sit inside the bar.
function pill(label, value, target, unit, onclick) {
  const p = target ? Math.min(1, (value || 0) / target) : 0;
  return h('button', { class: `pill${p >= 1 ? ' met' : ''}`, onclick, style: `--p:${p}` },
    h('span', { class: 'pill-l' }, label),
    h('span', { class: 'pill-v' }, value === null || value === undefined ? '–' : String(value), target ? h('small', {}, ` / ${target} ${unit}`) : h('small', {}, ` ${unit}`)));
}

export function renderShell(root) {
  const { plan, day } = state;
  const { TARGETS } = plan.program.data;
  const t = fluidTotals(day, state.fluids);
  const fluids = Math.round(((t.water_oz || 0) + (t.other_drinks_oz || 0)) * 10) / 10;
  const tab = current();
  const view = h('main', { class: `view view-${tab.id}` });
  const rerender = () => renderShell(root);

  fill(root,
    TEST ? h('button', { class: 'test-banner', onclick: testSheet }, `Test app, ${state.date} ${hhmm()}. Tap for controls.`) : null,
    h('nav', { class: 'status', 'aria-label': 'Today at a glance' },
      pill('Fluids', fluids, TARGETS.fluids_oz[0], 'oz', fluidSheet),
      pill('Protein', day.protein_g, TARGETS.protein_g[0], 'g', proteinSheet),
      plan.hourly ? pill('Hourly', hourlyHistory(day, state.events).length, null, 'today', () => { location.hash = '#today'; }) : null),
    view,
    h('nav', { class: 'tabs-bar', 'aria-label': 'Sections' }, TABS.map(x =>
      h('button', { class: x === tab ? 'on' : '', 'aria-current': x === tab ? 'page' : null, onclick: () => { location.hash = `#${x.id}`; } },
        h('span', { class: 'tab-i', 'aria-hidden': 'true' }, x.icon), h('span', {}, x.label)))));
  tab.render(view, rerender);
}

export const startShell = root => addEventListener('hashchange', () => renderShell(root));
