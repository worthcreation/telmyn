// Today tab: date and verse, the next block with the day ring, the rest of the day, verse text in spare space,
// hourly palms, and quick adds. Status pills and tabs live in the shell.
import { h, toast, fill } from './dom.js';
import { state, addEvent } from '../state.js';
import { nextBlock, blockStatus } from '../program/index.js';
import { hhmm } from '../clock.js';
import { hourlyHistory, nextPalms } from '../hourly.js';
import { runBlock } from './runner.js';
import { fluidSheet, proteinSheet } from './forms.js';
import { verseSheet } from './verse.js';
import { getVersion, fetchVerse } from '../scripture.js';

const prettyDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
const timeOf = iso => (iso ? hhmm(new Date(iso)) : '');
const arrow = p => (p === 'up' ? '↑' : p === 'down' ? '↓' : '–');

// Day ring: blocks closed out of the day's blocks, drawn around the count.
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
  }).catch(() => versePanel.classList.add('empty'));

  let hourly = null;
  if (plan.hourly) {
    const hist = hourlyHistory(day, events);
    const np = nextPalms(hist) || 'down';
    const other = np === 'up' ? 'down' : 'up';
    const quick = async palms => { await addEvent('block_done', { block: 'hourly', palms, quick: true }); toast(`Hourly block ${hist.length + 1} logged, palms ${palms}`); rerender(); };
    hourly = h('section', { class: 'hourly', 'aria-label': 'Hourly blocks' },
      h('p', { class: 'hourly-line' },
        h('b', {}, `Hourly ${hist.length}`),
        h('span', { class: 'arrows' }, hist.map(x => h('span', { class: x.palms || 'none', title: x.at ? timeOf(x.at) : 'from handoff' }, arrow(x.palms))))),
      h('div', { class: 'hourly-actions' },
        h('button', { class: 'btn', 'aria-label': `Done, palms ${np}`, onclick: () => quick(np) }, `Done ${arrow(np)}`),
        h('button', { class: 'btn ghost', 'aria-label': `Done, palms ${other}`, onclick: () => quick(other) }, arrow(other)),
        h('button', { class: 'btn ghost', onclick: () => runBlock(plan.hourly, { onExit: rerender }) }, 'Guided')));
  }

  // Two columns, each centered on its own: the block and Start on the left, the day ring and Skip on the right.
  const meta = next ? [next.time ? `${next.time}${hhmm() < next.time ? '' : ', now'}` : 'Next', next.minutes ? `about ${next.minutes} min` : ''].filter(Boolean).join(', ') : 'All blocks closed';
  const nextCard = h('section', { class: `next${next ? '' : ' done'}`, 'aria-label': 'Next block' },
    h('div', { class: 'next-main' },
      h('p', { class: 'next-meta' }, meta),
      h('h1', { class: 'next-name' }, next ? next.name : 'Day done'),
      next ? h('button', { class: 'btn big', onclick: () => runBlock(next, { onExit: rerender }) }, 'Start') : null),
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
      h('button', { class: 'chip-btn', onclick: async () => { await addEvent('habit', { habit: 'ankle_pumps' }); toast('Ankle pumps logged'); rerender(); } }, `Ankle pumps ${pumps}`),
      h('button', { class: 'chip-btn', onclick: fluidSheet }, '+ Fluid'),
      h('button', { class: 'chip-btn', onclick: proteinSheet }, '+ Protein')));
}
