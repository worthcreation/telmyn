// Today tab: date and verse, the next block with the day ring, the rest of the day, verse text in spare space,
// and the weight button in the header until weight is logged. Status pills (Fluids, Protein, Grip, Pumps) and tabs live in the shell.
import { h, fill, fitText, holdable } from './dom.js';
import { weightList } from './history.js';
import { state, addEvent } from '../state.js';
import * as db from '../db.js';
import { weightLevel } from '../status.js';
import { nextBlock, blockStatus } from '../program/index.js';
import { hhmm, daysBetween, dayLabel } from '../clock.js';
import { runBlock } from './runner.js';
import { weightSheet, lastWeight } from './forms.js';
import { verseSheet } from './verse.js';
import { getVersion, fetchVerse } from '../scripture.js';


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

// Today's verse, kept in memory once loaded, so each redraw of Today starts with the text already in place.
let verseMem = null;
const waitAtMost = (promise, ms) => Promise.race([promise, new Promise(r => setTimeout(() => r(null), ms))]);

// Today is rebuilt every minute and after every change, so everything on it is gathered first and the screen is
// built complete before it is shown. (Filling the verse and the weight button in afterwards made them blink.)
export async function renderToday(root, rerender) {
  const { plan, verse, day, events } = state;
  const next = nextBlock(plan, events, day);
  const resumeAt = next ? await db.getMeta(`resume:${next.id}:${state.date}`) : null;
  const status = b => blockStatus(b.id, events, day, plan);
  const closed = plan.blocks.filter(status);
  const open = plan.blocks.filter(b => !status(b));

  const dayList = h('ol', { class: 'daylist' },
    closed.length ? h('li', { class: 'closed-summary' }, h('span', { class: 'dl-mark' }, '✓'),
      h('span', { class: 'dl-name' }, closed.map(b => b.name + ({ skip: ' (skipped)', partial: ' (partial)' }[status(b)] || '')).join(', '))) : null,
    open.filter(b => b !== next).map(b => h('li', {},
      h('button', { onclick: () => runBlock(b, { onExit: rerender }) },
        h('span', { class: 'dl-mark' }, ''),
        h('span', { class: 'dl-name' }, b.name),
        h('span', { class: 'dl-when' }, [b.time, b.minutes ? `${b.minutes} min` : ''].filter(Boolean).join(', '))))));

  const version = await getVersion();
  const key = `${version}:${verse.ref}`;
  if (verseMem?.key !== key) {
    const d = await waitAtMost(fetchVerse(verse.ref, version).catch(() => null), 800);
    if (d) verseMem = { key, d };
  }
  const known = verseMem?.key === key ? verseMem.d : null;
  const verseText = h('span', { class: `vp-text${known ? '' : ' loading'}` }, known ? known.text : ' ');
  const verseRef = h('span', { class: 'vp-ref' }, known ? `${verse.ref} ${known.version}` : verse.ref);
  const versePanel = h('button', { class: 'verse-card', onclick: verseSheet, 'aria-label': `Today's verse, ${verse.ref}` },
    h('span', { class: 'vp-theme' }, verse.theme), verseText, verseRef);
  // A passage too long for the card ends with … and the reference says how to read the rest. Fitted right away
  // (resize notices arrive before the screen is drawn), and the text fades in only once it is sized, so it never
  // shows at one size and then jumps to another.
  const fit = () => {
    fitText(versePanel, verseText, { clamp: true });
    verseRef.dataset.more = verseText.classList.contains('clamped') ? 'yes' : '';
  };
  new ResizeObserver(fit).observe(versePanel);
  document.fonts?.ready.then(fit);
  // Only the very first load (nothing in memory yet, slow connection) fills in afterwards and fades in.
  if (!known) fetchVerse(verse.ref, version).then(d => {
    verseMem = { key, d };
    verseText.textContent = d.text;
    verseRef.textContent = `${verse.ref} ${d.version}`;
    fit();
    verseText.classList.remove('loading');
  }).catch(() => { verseText.textContent = 'Tap to read today’s verse.'; verseText.classList.remove('loading'); verseText.classList.add('offline'); });

  // Weight, once a day: a small floating button in the header corner, pulsing as the morning goes on, gone once
  // today's weight is logged (it floats, so nothing moves when it goes). Hold it for the last 7 readings.
  const { date: weighedOn } = await lastWeight();
  const weightAge = weighedOn ? daysBetween(weighedOn, state.date) : null;
  const weigh = weightAge === 0 ? null : holdable(h('button', { class: 'weigh', onclick: () => weightSheet(rerender), 'aria-label': 'Log today’s weight' }, 'Weight'), weightList);
  if (weigh) dueMark(weigh, weightLevel(weightAge));

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
  if (next && resumeAt?.i > 0) { const n = nextCard.querySelector('.go-name'); if (n) n.textContent = `Resume ${next.name}`; }

  fill(root,
    h('header', { class: 'top' },
      h('p', { class: 'date' }, dayLabel(plan.date), h('span', { class: 'wkday' }, `Week ${plan.week}, Day ${plan.day}`)),
      h('h1', { class: 'daytype' }, `${plan.typeLabel} Day`),
      weigh),
    versePanel,
    nextCard,
    h('section', { class: 'day', 'aria-label': 'Rest of today' }, dayList));
}
