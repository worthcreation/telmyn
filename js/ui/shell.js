// App frame: status pills on top (every tab), the current tab, and the tab bar at the bottom.
import { h, fill, toast, holdable, TABS as TAB_LIST, tabBar } from './dom.js';
import { gripList, pumpsList } from './history.js';
import { state, logGripBreak, removeEvent, addEvent } from '../state.js';
import { fluidTotals } from '../schema.js';
import { hourlyHistory, nextPalms } from '../hourly.js';
import { overdueLevel, towardBest } from '../status.js';
import * as db from '../db.js';
import { PROGRAMS } from '../program/index.js';
import { TEST, hhmm } from '../clock.js';
import { fluidSheet, proteinSheet } from './forms.js';
import { renderToday } from './today.js';
import { renderProgress } from './progress.js';
import { renderGear } from './gear.js';
import { renderMe } from './me.js';
import { testSheet } from './data.js';

const RENDER = { today: renderToday, progress: renderProgress, gear: renderGear, me: renderMe };
const TABS = TAB_LIST.map(t => ({ ...t, render: RENDER[t.id] }));
const current = () => TABS.find(t => `#${t.id}` === location.hash) || TABS[0];

// Grip break lives in the top strip: tap logs one with the next palms; the arrow says which. Undo on the message.
// Earlier days' grip-break and pumps totals, read once per day (cleared when a restore changes past days).
let pastCache = null;
export const clearPastCounts = () => { pastCache = null; };
async function pastCounts() {
  if (pastCache?.date === state.date) return pastCache.counts;
  const start = PROGRAMS[0].effective;
  const [events, days] = await Promise.all([db.all('events'), db.all('days')]);
  const grip = {}, pumps = {};
  for (const d of days) if (d.date >= start && d.date < state.date && d.hourly_blocks_count) grip[d.date] = d.hourly_blocks_count;
  for (const e of events) {
    if (!(e.date >= start && e.date < state.date)) continue;
    if (e.type === 'block_done' && e.block === 'hourly') grip[e.date] = (grip[e.date] || 0) + 1;
    if (e.type === 'habit' && e.habit === 'ankle_pumps') pumps[e.date] = (pumps[e.date] || 0) + 1;
  }
  pastCache = { date: state.date, counts: { grip: Object.values(grip), pumps: Object.values(pumps) } };
  return pastCache.counts;
}
// The fill and words for a grip or pumps pill: toward your average (plain fill), then toward your best (green).
const paceAttrs = (n, counts, lvl) => {
  const t = towardBest(n, counts);
  return { cls: `pill${t.stage === 'best' || t.stage === 'top' ? ' met' : ''}${lvl ? ' behind due' : ''}`, style: `--p:${t.p}`, label: t.label };
};

function gripPill(day, rerender, past) {
  const hist = hourlyHistory(day, state.events);
  const np = nextPalms(hist) || 'down';
  const arrow = np === 'up' ? '↑' : '↓';
  const lvl = overdueLevel(state.events.filter(e => e.type === 'block_done' && e.block === 'hourly').pop()?.at, 60);
  const a = paceAttrs(hist.length, past.grip, lvl);
  return holdable(h('button', { class: a.cls, style: a.style, 'data-due': lvl || null, 'aria-label': `Grip break, ${hist.length} today${a.label}. Tap to log one, palms ${np}.`, onclick: async () => {
    const { e, n, palms } = await logGripBreak();
    rerender();
    toast('Grip break logged', { label: 'Undo', fn: async () => { await removeEvent(e); rerender(); toast('Grip break removed'); } }, `${n} today, palms ${palms}`);
  } },
    h('span', { class: 'pill-l' }, `Grip ${arrow}`),
    h('span', { class: 'pill-v' }, String(hist.length), h('small', {}, a.label))), gripList);
}

// Ankle pumps live in the top strip too: tap logs a set (20 per foot), hold for today's list. Pulses when due.
function pumpsPill(rerender, past) {
  const list = state.events.filter(e => e.type === 'habit' && e.habit === 'ankle_pumps');
  const lvl = overdueLevel(list[list.length - 1]?.at, 30);
  const a = paceAttrs(list.length, past.pumps, lvl);
  return holdable(h('button', { class: a.cls, style: a.style, 'data-due': lvl || null, 'aria-label': `Ankle pumps, ${list.length} today${a.label}. Tap to log a set.`, onclick: async () => {
    const e = await addEvent('habit', { habit: 'ankle_pumps' });
    rerender();
    toast('Ankle pumps logged', { label: 'Undo', fn: async () => { await removeEvent(e); rerender(); toast('Ankle pumps removed'); } }, `${list.length + 1} today, 20 per foot`);
  } },
    h('span', { class: 'pill-l' }, 'Pumps'),
    h('span', { class: 'pill-v' }, String(list.length), h('small', {}, a.label))), pumpsList);
}

// Labeled fill bar: the numbers sit inside the bar.
function pill(label, value, target, unit, onclick) {
  const p = target ? Math.min(1, (value || 0) / target) : 0;
  return h('button', { class: `pill${p >= 1 ? ' met' : ''}`, onclick, style: `--p:${p}` },
    h('span', { class: 'pill-l' }, label),
    h('span', { class: 'pill-v' }, value === null || value === undefined ? '–' : String(value), target ? h('small', {}, ` / ${target} ${unit}`) : h('small', {}, ` ${unit}`)));
}

// A tab whose content loads from storage (Progress, Me) is built off screen and swapped in whole, so switching tabs
// never shows an empty page that then fills and jumps. Only the newest render is shown.
let renderSeq = 0;
export async function renderShell(root) {
  const seq = ++renderSeq;
  const { plan, day } = state;
  const { TARGETS } = plan.program.data;
  const t = fluidTotals(day, state.fluids);
  const fluids = Math.round(((t.water_oz || 0) + (t.other_drinks_oz || 0)) * 10) / 10;
  const tab = current();
  const view = h('main', { class: `view view-${tab.id}` });
  const rerender = () => renderShell(root);

  const past = await pastCounts();
  await tab.render(view, rerender);
  if (seq !== renderSeq) return;
  fill(root,
    TEST ? h('button', { class: 'test-banner', onclick: testSheet }, `Test app, ${state.date} ${hhmm()}. Tap for controls.`) : null,
    h('nav', { class: 'status', 'aria-label': 'Today at a glance' },
      pill('Fluids', fluids, TARGETS.fluids_oz[0], 'oz', fluidSheet),
      pill('Protein', day.protein_g, TARGETS.protein_g[0], 'g', proteinSheet),
      plan.hourly ? gripPill(day, rerender, past) : null,
      pumpsPill(rerender, past)),
    view,
    tabBar(tab.id));
}

export const startShell = root => addEventListener('hashchange', () => renderShell(root));
