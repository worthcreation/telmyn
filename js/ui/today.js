// Today tab: date and verse, the next block with the day ring, the rest of the day, verse text in spare space,
// and the weight button in the header until weight is logged. Status pills (Fluids, Protein, Grip, Pumps) and tabs live in the shell.
import { h, fill, fitText, holdable, toast } from './dom.js';
import { weightList } from './history.js';
import { state, addEvent, removeEvent } from '../state.js';
import * as db from '../db.js';
import { weightLevel } from '../status.js';
import { nextBlock, blockStatus, dailyHabits } from '../program/index.js';
import { takenDoses, takenGrams, habitMet } from '../log.js';
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

// Today's verse, kept in memory once loaded, so each redraw of Today starts with the text already in place, at the
// size it was last fitted to (Today is rebuilt every minute and after every change).
let verseMem = null;
// The verse font (Source Serif) sets taller than the fallback. Until it has loaded, the verse stays hidden, so it is
// first seen in its own font at its fitted size instead of jumping when the font arrives (Ross, 2026-11-03).
let fontsDone = false;
// (fonts.ready alone can resolve before the font has even been asked for, so the verse faces are loaded by name.)
const fontsReady = Promise.all(['400 30px "Source Serif 4"', '600 14px "Source Serif 4"'].map(f => document.fonts?.load(f)))
  .catch(() => null).then(() => { fontsDone = true; });
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

  // Daily habits (creatine): each tap logs one dose; the row stays, showing doses taken, until the day's doses are
  // all taken, then it joins the done line with the day's grams.
  const daily = dailyHabits(state.date);
  const taken = daily.filter(x => habitMet(day, events, x)), toTake = daily.filter(x => !habitMet(day, events, x));
  const take = x => async () => {
    const n = takenDoses(events, x.key).length + 1;
    const e = await addEvent('habit', { habit: x.key });
    rerender();
    toast(`${x.name} logged${x.times > 1 ? `, dose ${n} of ${x.times}` : ''}`, { label: 'Undo', fn: async () => { await removeEvent(e); rerender(); toast(`${x.name} removed`); } }, x.amount);
  };
  const doneNames = [...closed.map(b => b.name + ({ skip: ' (skipped)', partial: ' (partial)' }[status(b)] || '')), ...taken.map(x => `${x.name} ${takenGrams(day, events, x)} g`)];
  const doseWhen = x => { const n = takenDoses(events, x.key).length; return x.times > 1 ? `${x.amount}, ${n} of ${x.times} taken` : `${x.amount}, tap when taken`; };

  const dayList = h('ol', { class: 'daylist' },
    doneNames.length ? h('li', { class: 'closed-summary' }, h('span', { class: 'dl-mark' }, '✓'),
      h('span', { class: 'dl-name' }, doneNames.join(', '))) : null,
    toTake.map(x => h('li', {},
      h('button', { onclick: take(x), 'aria-label': `${x.name}, ${doseWhen(x)}. Tap when taken.` },
        h('span', { class: 'dl-mark' }, ''),
        h('span', { class: 'dl-name' }, x.name),
        h('span', { class: 'dl-when' }, doseWhen(x))))),
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
  // Hidden until it has been fitted in its own font; a redraw that already knows its size shows straight away.
  const hidden = !known || !fontsDone || !verseMem.size;
  const verseText = h('span', { class: `vp-text${hidden ? ' loading' : ''}`, style: known && verseMem.size ? `font-size:${verseMem.size}px` : '' }, known ? known.text : ' ');
  const verseRef = h('span', { class: 'vp-ref' }, known ? `${verse.ref} ${known.version}` : verse.ref);
  const versePanel = h('button', { class: 'verse-card', onclick: verseSheet, 'aria-label': `Today's verse, ${verse.ref}` },
    h('span', { class: 'vp-theme' }, verse.theme), verseText, verseRef);
  // A passage too long for the card ends with … and the reference says how to read the rest. Fitted whenever the card
  // changes size; the fitted size is kept, so the next redraw starts at it and nothing moves.
  const fit = () => {
    const size = fitText(versePanel, verseText, { clamp: true });
    verseRef.dataset.more = verseText.classList.contains('clamped') ? 'yes' : '';
    if (size && verseMem?.key === key) verseMem.size = size;
    if (size && fontsDone && verseMem?.key === key) verseText.classList.remove('loading');
  };
  new ResizeObserver(fit).observe(versePanel);
  // Shown once the text is in place, the font has loaded and it has been fitted (fit() reveals it).
  if (known && !fontsDone) fontsReady.then(fit);
  // Only the very first load (nothing in memory yet, slow connection) fills in afterwards and fades in.
  if (!known) fetchVerse(verse.ref, version).then(async d => {
    verseMem = { key, d };
    verseText.textContent = d.text;
    verseRef.textContent = `${verse.ref} ${d.version}`;
    await fontsReady;
    fit();
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
