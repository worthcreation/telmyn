// Today tab: date and verse, the next block with the day ring, the rest of the day, verse text in spare space,
// hourly palms, and quick adds. Status pills and tabs live in the shell.
import { h, toast, fill } from './dom.js';
import { state, addEvent, addFood, undoFood, removeEvent } from '../state.js';
import { FOODS } from '../foods.js';
import { nextBlock, blockStatus } from '../program/index.js';
import { hhmm } from '../clock.js';
import { hourlyHistory, nextPalms } from '../hourly.js';
import { runBlock } from './runner.js';
import { fluidSheet, proteinSheet } from './forms.js';
import { verseSheet } from './verse.js';
import { getVersion, fetchVerse } from '../scripture.js';

const prettyDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
const arrow = p => (p === 'up' ? '↑' : p === 'down' ? '↓' : '–');

// Day ring: blocks closed out of the day's blocks, drawn around the count.
function ring(done, total) {
  const r = 26, c = 2 * Math.PI * r, p = total ? done / total : 0;
  const svg = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="ring-bg"/>` +
    `<circle cx="32" cy="32" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/></svg>`;
  return h('div', { class: 'ring', role: 'img', 'aria-label': `${done} of ${total} blocks done` },
    h('div', { html: svg }), h('span', { class: 'ring-n' }, h('b', {}, done), `/${total}`));
}

// The verse fills whatever space is left. Shrink the type until it fits; if even small type won't fit, hide it
// rather than cut it off. (Long verses on a busy day hand the space back to the day.)
function fitVerse(el) {
  const t = el.querySelector('.vp-text');
  if (!t) return;
  let size = 22;
  t.style.fontSize = `${size}px`;
  while (el.scrollHeight > el.clientHeight + 1 && size > 15) { size -= 1; t.style.fontSize = `${size}px`; }
  el.classList.toggle('empty', el.scrollHeight > el.clientHeight + 1);
}

export function renderToday(root, rerender) {
  const { plan, verse, day, events } = state;
  const next = nextBlock(plan, events, day);
  const status = b => blockStatus(b.id, events, day, plan);
  const closed = plan.blocks.filter(status);
  const open = plan.blocks.filter(b => !status(b));
  const pumps = events.filter(e => e.type === 'habit' && e.habit === 'ankle_pumps').length;

  const dayList = h('ol', { class: 'daylist' },
    closed.length ? h('li', { class: 'closed-summary' }, h('span', { class: 'dl-mark' }, '✓'),
      h('span', { class: 'dl-name' }, closed.map(b => b.name + ({ skip: ' (skipped)', partial: ' (partial)' }[status(b)] || '')).join(', '))) : null,
    open.filter(b => b !== next).map(b => h('li', {},
      h('button', { onclick: () => runBlock(b, { onExit: rerender }) },
        h('span', { class: 'dl-mark' }, ''),
        h('span', { class: 'dl-name' }, b.name),
        h('span', { class: 'dl-when' }, [b.time, b.minutes ? `${b.minutes} min` : ''].filter(Boolean).join(', '))))));

  const versePanel = h('button', { class: 'verse-panel', onclick: verseSheet, 'aria-label': 'Open today’s verse' });
  getVersion().then(v => fetchVerse(verse.ref, v)).then(d => {
    fill(versePanel, h('span', { class: 'vp-text' }, d.text), h('span', { class: 'vp-ref' }, `${verse.ref} ${d.version}`));
    requestAnimationFrame(() => fitVerse(versePanel));
  }).catch(() => versePanel.classList.add('empty'));

  // Grip break (the hourly block): one button. Logs the next palms in the alternation; Undo if it was wrong.
  let hourly = null;
  if (plan.hourly) {
    const hist = hourlyHistory(day, events);
    const np = nextPalms(hist) || 'down';
    hourly = h('button', { class: 'btn ghost grip-btn', 'aria-label': `Grip break done, palms ${np}. ${hist.length} today.`, onclick: async () => {
      const e = await addEvent('block_done', { block: 'hourly', palms: np, quick: true });
      rerender();
      toast(`Grip break ${hist.length + 1}, palms ${np}`, { label: 'Undo', fn: async () => { await removeEvent(e); rerender(); } });
    } }, h('span', {}, `Grip break ${arrow(np)}`), h('small', {}, `${hist.length} today`));
  }

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
        h('span', { class: 'go-i', 'aria-hidden': 'true' }, '▶'), h('span', {}, next.name)) : null),
    h('div', { class: 'next-side' },
      ring(closed.length, plan.blocks.length),
      next ? h('button', { class: 'btn ghost', onclick: async () => { await addEvent('block_skip', { block: next.id }); rerender(); } }, next.optional ? 'Not today' : 'Skip') : null));

  fill(root,
    h('header', { class: 'top' },
      h('div', { class: 'top-text' },
        h('h1', { class: 'daytype' }, `${plan.typeLabel} day`),
        h('p', { class: 'date' }, prettyDate(plan.date), h('span', { class: 'wkday' }, `Week ${plan.week}, Day ${plan.day}`))),
      h('button', { class: 'verse-pill', onclick: verseSheet, 'aria-label': `Today's verse, ${verse.ref}` },
        h('span', { class: 'verse-ref' }, verse.ref), h('span', { class: 'pill-theme' }, verse.theme))),
    nextCard,
    h('section', { class: 'day', 'aria-label': 'Rest of today' }, dayList),
    versePanel,
    hourly,
    h('section', { class: 'quick', 'aria-label': 'Quick add' },
      h('button', { class: 'chip-btn', 'aria-label': `Ankle pumps, ${pumps} today`, onclick: async () => { await addEvent('habit', { habit: 'ankle_pumps' }); toast('Ankle pumps logged'); rerender(); } }, `Pumps ${pumps}`),
      h('button', { class: 'chip-btn', onclick: fluidSheet }, '+ Fluid'),
      h('button', { class: 'chip-btn', onclick: proteinSheet }, '+ Protein'),
      FOODS.map(f => h('button', { class: 'chip-btn food', onclick: async () => {
        const e = await addFood(f);
        const parts = [f.protein_g ? `${f.protein_g} g protein` : '', f.fluid ? `${f.fluid.oz} oz water` : ''].filter(Boolean).join(', ');
        toast(`${f.label}: ${parts}`, { label: 'Undo', fn: async () => { await undoFood(e); toast(`${f.label} removed`); } });
      } }, `+ ${f.label}`))));
}
