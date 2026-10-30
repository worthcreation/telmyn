// App frame: status pills on top (every tab), the current tab, and the tab bar at the bottom.
import { h, fill, toast, holdable } from './dom.js';
import { gripList } from './history.js';
import { state, logGripBreak, removeEvent } from '../state.js';
import { fluidTotals } from '../schema.js';
import { hourlyHistory, nextPalms } from '../hourly.js';
import { overdueLevel } from '../status.js';
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

// Grip break lives in the top strip: tap logs one with the next palms; the arrow says which. Undo on the message.
function gripPill(day, rerender) {
  const hist = hourlyHistory(day, state.events);
  const np = nextPalms(hist) || 'down';
  const arrow = np === 'up' ? '↑' : '↓';
  const lvl = overdueLevel(state.events.filter(e => e.type === 'block_done' && e.block === 'hourly').pop()?.at, 60);
  return holdable(h('button', { class: `pill grip${lvl ? ' behind due' : ''}`, 'data-due': lvl || null, 'aria-label': `Grip break, ${hist.length} today. Tap to log one, palms ${np}.`, onclick: async () => {
    const { e, n, palms } = await logGripBreak();
    rerender();
    toast('Grip break logged', { label: 'Undo', fn: async () => { await removeEvent(e); rerender(); toast('Grip break removed'); } }, `${n} today, palms ${palms}`);
  } },
    h('span', { class: 'pill-l' }, `Grip ${arrow}`),
    h('span', { class: 'pill-v' }, String(hist.length), h('small', {}, ' today'))), gripList);
}

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
      plan.hourly ? gripPill(day, rerender) : null),
    view,
    h('nav', { class: 'tabs-bar', 'aria-label': 'Sections' }, TABS.map(x =>
      h('button', { class: x === tab ? 'on' : '', 'aria-current': x === tab ? 'page' : null, onclick: () => { location.hash = `#${x.id}`; } },
        h('span', { class: 'tab-i', 'aria-hidden': 'true' }, x.icon), h('span', {}, x.label)))));
  tab.render(view, rerender);
}

export const startShell = root => addEventListener('hashchange', () => renderShell(root));
