// Today tab: date and verse, the next block with the day ring, the rest of the day, verse text in spare space,
// hourly palms, and quick adds. Status pills and tabs live in the shell.
import { h, toast, fill, fitText, holdable } from './dom.js';
import { pumpsList, weightList } from './history.js';
import { state, addEvent, addFood, undoFood, removeEvent } from '../state.js';
import * as db from '../db.js';
import { FOODS } from '../foods.js';
import { fluidTotals } from '../schema.js';
import { paceStatus, overdueStatus, overdueLevel, staleStatus, weightLevel } from '../status.js';
import { nextBlock, blockStatus } from '../program/index.js';
import { hhmm, daysBetween } from '../clock.js';
import { runBlock } from './runner.js';
import { fluidSheet, proteinSheet, weightSheet, lastWeight } from './forms.js';
import { verseSheet } from './verse.js';
import { getVersion, fetchVerse } from '../scripture.js';

const prettyDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };

// Day ring: blocks closed out of the day's blocks, drawn around the count.
// A due reminder pulses like a slow heartbeat on the item it is about, stronger the longer it waits (styles: .due).
function dueMark(el, lvl) { el.classList.toggle('due', !!lvl); if (lvl) el.dataset.due = lvl; else delete el.dataset.due; }

function ring(done, total) {
  const r = 26, c = 2 * Math.PI * r, p = total ? done / total : 0;
  const svg = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="ring-bg"/>` +
    `<circle cx="32" cy="32" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/></svg>`;
  return h('div', { class: 'ring', role: 'img', 'aria-label': `${done} of ${total} blocks done` },
    h('div', { html: svg }), h('span', { class: 'ring-n' }, h('b', {}, done), `/${total}`));
}

export function renderToday(root, rerender) {
  const { plan, verse, day, events } = state;
  const next = nextBlock(plan, events, day);
  const status = b => blockStatus(b.id, events, day, plan);
  const closed = plan.blocks.filter(status);
  const open = plan.blocks.filter(b => !status(b));
  const pumps = events.filter(e => e.type === 'habit' && e.habit === 'ankle_pumps').length;
  // Every quick chip carries its own state: red when behind or overdue, green when met, plain when on track.
  const { TARGETS } = plan.program.data;
  const totals = fluidTotals(day, state.fluids);
  const lastPumps = events.filter(e => e.type === 'habit' && e.habit === 'ankle_pumps').pop()?.at;
  const pumpsLvl = overdueLevel(lastPumps, 30);
  const st = {
    pumps: overdueStatus(lastPumps, 30),
    fluid: paceStatus('fluids', (totals.water_oz || 0) + (totals.other_drinks_oz || 0), TARGETS.fluids_oz[0]),
    protein: paceStatus('protein', day.protein_g, TARGETS.protein_g[0]),
    huel: events.some(e => e.type === 'food' && e.food === 'huel') ? 'met' : null,
  };
  const chipClass = s => `chip raised${s ? ` ${s}` : ''}`;

  const dayList = h('ol', { class: 'daylist' },
    closed.length ? h('li', { class: 'closed-summary' }, h('span', { class: 'dl-mark' }, '✓'),
      h('span', { class: 'dl-name' }, closed.map(b => b.name + ({ skip: ' (skipped)', partial: ' (partial)' }[status(b)] || '')).join(', '))) : null,
    open.filter(b => b !== next).map(b => h('li', {},
      h('button', { onclick: () => runBlock(b, { onExit: rerender }) },
        h('span', { class: 'dl-mark' }, ''),
        h('span', { class: 'dl-name' }, b.name),
        h('span', { class: 'dl-when' }, [b.time, b.minutes ? `${b.minutes} min` : ''].filter(Boolean).join(', '))))));

  const verseText = h('span', { class: 'vp-text loading' }, ' ');
  const verseRef = h('span', { class: 'vp-ref' }, verse.ref);
  const versePanel = h('button', { class: 'verse-card', onclick: verseSheet, 'aria-label': `Today's verse, ${verse.ref}` },
    h('span', { class: 'vp-theme' }, verse.theme), verseText, verseRef);
  // A passage too long for the card ends with … and the reference says how to read the rest.
  const fit = () => requestAnimationFrame(() => {
    fitText(versePanel, verseText, { clamp: true });
    verseRef.dataset.more = verseText.classList.contains('clamped') ? 'yes' : '';
  });
  new ResizeObserver(fit).observe(versePanel);
  document.fonts?.ready.then(() => requestAnimationFrame(fit));
  getVersion().then(v => fetchVerse(verse.ref, v)).then(d => {
    verseText.textContent = d.text; verseText.classList.remove('loading');
    verseRef.textContent = `${verse.ref} ${d.version}`;
    requestAnimationFrame(fit);
  }).catch(() => { verseText.textContent = 'Tap to read today’s verse.'; verseText.classList.remove('loading'); verseText.classList.add('offline'); });

  // Weight: a chip in the quick row (used once a day). Red when nothing has been logged for a day or more.
  const weightChip = holdable(h('button', { class: 'chip raised weight-chip', onclick: () => weightSheet(rerender) }, 'Weight'), weightList);
  lastWeight().then(({ value, date }) => {
    const age = date ? daysBetween(date, state.date) : null;
    const s2 = staleStatus(age); weightChip.classList.toggle('behind', s2 === 'behind'); weightChip.classList.toggle('met', s2 === 'met');
    dueMark(weightChip, weightLevel(age));
    weightChip.title = value === null ? 'Not logged yet' : `${value} lb, ${age === 0 ? 'today' : `${age} day${age === 1 ? '' : 's'} ago`}`;
  });

  // Two columns, each centered on its own. Left: what's next and what it involves, and the button named for it.
  // Right: the day ring and Skip.
  const after = open.filter(b => b !== next)[0];
  const meta = next ? [next.time ? `${next.time}${hhmm() < next.time ? '' : ', now'}` : 'Next', next.minutes ? `about ${next.minutes} min` : ''].filter(Boolean).join(', ') : 'All blocks closed';
  const nextCard = h('section', { class: `next${next ? '' : ' done'}`, 'aria-label': 'Next block' },
    h('div', { class: 'next-main' },
      h('p', { class: 'next-meta' }, meta),
      next ? h('p', { class: 'next-sum' }, next.summary || `${next.steps.length} steps`) : h('h1', { class: 'next-name' }, 'Day done'),
      next && after ? h('p', { class: 'next-then' }, `Then: ${after.name}`) : null,
      next ? h('button', { class: 'btn big go', 'aria-label': `Start ${next.name}`, onclick: () => runBlock(next, { onExit: rerender }) },
        h('span', { class: 'go-i', 'aria-hidden': 'true' }, '▶'), h('span', { class: 'go-name' }, next.name)) : null),
    h('div', { class: 'next-side' },
      ring(closed.length, plan.blocks.length),
      next ? h('button', { class: 'btn ghost', onclick: async () => { await addEvent('block_skip', { block: next.id }); rerender(); } }, next.optional ? 'Not today' : 'Skip') : null));

  // A block left mid-way earlier today offers to resume.
  if (next) db.getMeta(`resume:${next.id}:${state.date}`).then(r => { if (r?.i > 0) { const n = root.querySelector('.go-name'); if (n) n.textContent = `Resume ${next.name}`; } });

  fill(root,
    h('header', { class: 'top' },
      h('div', { class: 'top-text' },
        h('h1', { class: 'daytype' }, `${plan.typeLabel} day`),
        h('p', { class: 'date' }, prettyDate(plan.date), h('span', { class: 'wkday' }, `Week ${plan.week}, Day ${plan.day}`)))),
    versePanel,
    nextCard,
    h('section', { class: 'day', 'aria-label': 'Rest of today' }, dayList),
    h('section', { class: 'quick', 'aria-label': 'Quick add' },
      holdable(h('button', { class: `${chipClass(st.pumps)}${pumpsLvl ? ' due' : ''}`, 'data-due': pumpsLvl || null, 'aria-label': `Ankle pumps, ${pumps} today. Hold for the list.`, onclick: async () => { const e = await addEvent('habit', { habit: 'ankle_pumps' }); rerender(); toast('Ankle pumps logged', { label: 'Undo', fn: async () => { await removeEvent(e); rerender(); toast('Ankle pumps removed'); } }, `${pumps + 1} today, 20 per foot`); } }, `Pumps ${pumps}`), pumpsList),
      h('button', { class: chipClass(st.fluid), onclick: fluidSheet }, 'Fluid'),
      h('button', { class: chipClass(st.protein), onclick: proteinSheet }, 'Protein'),
      FOODS.map(f => h('button', { class: chipClass(f.key === 'huel' ? st.huel : null), onclick: async () => {
        const e = await addFood(f);
        const parts = [f.protein_g ? `${f.protein_g} g protein` : '', f.fluid ? `${f.fluid.oz} oz water` : ''].filter(Boolean).join(', ');
        toast(`${f.label}: ${parts}`, { label: 'Undo', fn: async () => { await undoFood(e); toast(`${f.label} removed`); } });
      } }, f.label)),
      weightChip));
}
