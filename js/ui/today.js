// Home screen. One phone screen, no wasted band: next block, the whole day, hourly palms, counters, Log and Data.
import { h, toast, fill } from './dom.js';
import { state, addEvent } from '../state.js';
import { nextBlock, blockStatus } from '../program/index.js';
import { fluidTotals } from '../schema.js';
import { WEEKDAYS, weekday, TEST, hhmm } from '../clock.js';
import { hourlyHistory, nextPalms } from '../hourly.js';
import { runBlock } from './runner.js';
import { fluidSheet, proteinSheet, logSheet } from './forms.js';
import { verseSheet } from './verse.js';
import { dataSheet } from './data.js';
import { getVersion, fetchVerse } from '../scripture.js';

const timeOf = iso => (iso ? hhmm(new Date(iso)) : '');
const arrow = p => (p === 'up' ? '↑' : p === 'down' ? '↓' : '–');

export function renderToday(root) {
  const { plan, verse, day, events } = state;
  const { TARGETS, HABITS } = plan.program.data;
  const next = nextBlock(plan, events, day);
  const totals = fluidTotals(day, state.fluids);
  const fluidsOz = Math.round(((totals.water_oz || 0) + (totals.other_drinks_oz || 0)) * 10) / 10;
  const pumps = events.filter(e => e.type === 'habit' && e.habit === 'ankle_pumps').length;
  const rerender = () => renderToday(root);

  // Day list: every block with its status and the time it closed.
  const open = plan.blocks.filter(b => !blockStatus(b.id, events, day, plan));
  const closed = plan.blocks.filter(b => blockStatus(b.id, events, day, plan));
  const dayList = h('ol', { class: 'daylist' },
    closed.length ? h('li', { class: 'closed-summary' }, h('span', { class: 'dl-mark' }, '✓'),
      h('span', { class: 'dl-name' }, closed.map(b => b.name + ({ skip: ' (skipped)', partial: ' (partial)' }[blockStatus(b.id, events, day, plan)] || '')).join(', '))) : null,
    open.filter(b => b !== next).map(b => h('li', {},
      h('button', { onclick: () => runBlock(b, { onExit: rerender }) },
        h('span', { class: 'dl-mark' }, ''),
        h('span', { class: 'dl-name' }, b.name),
        h('span', { class: 'dl-when' }, [b.time, b.minutes ? `${b.minutes} min` : ''].filter(Boolean).join(', '))))));

  // Hourly: chips for every block today, then one-tap logging with the alternating palms.
  let hourly = null;
  if (plan.hourly) {
    const hist = hourlyHistory(day, events);
    const np = nextPalms(hist) || 'down';
    const other = np === 'up' ? 'down' : 'up';
    const quick = async palms => { await addEvent('block_done', { block: 'hourly', palms, quick: true }); toast(`Hourly block ${hist.length + 1} logged, palms ${palms}`); rerender(); };
    hourly = h('section', { class: 'hourly', 'aria-label': 'Hourly blocks' },
      h('p', { class: 'hourly-line' },
        h('b', {}, `Hourly ${hist.length}`),
        h('span', { class: 'arrows', 'aria-label': hist.map(x => x.palms || 'not noted').join(', ') },
          hist.map(x => h('span', { class: x.palms || 'none', title: x.at ? timeOf(x.at) : 'from handoff' }, arrow(x.palms))))),
      h('div', { class: 'hourly-actions' },
        h('button', { class: 'btn', 'aria-label': `Done, palms ${np}`, onclick: () => quick(np) }, `Done ${arrow(np)}`),
        h('button', { class: 'btn ghost', 'aria-label': `Done, palms ${other}`, onclick: () => quick(other) }, arrow(other)),
        h('button', { class: 'btn ghost', onclick: () => runBlock(plan.hourly, { onExit: rerender }) }, 'Guided')));
  }

  // Spare space shows today's verse text (from the phone's cache or the verse service). Tap opens the full card.
  const versePanel = h('button', { class: 'verse-panel', onclick: verseSheet, 'aria-label': 'Open today’s verse' });
  getVersion().then(v => fetchVerse(verse.ref, v)).then(d => {
    fill(versePanel, h('span', { class: 'vp-text' }, d.text), h('span', { class: 'vp-ref' }, `${verse.ref} ${d.version}`));
  }).catch(() => versePanel.classList.add('empty'));

  const nextCard = next
    ? h('section', { class: 'next', 'aria-label': 'Next block' },
        h('div', { class: 'next-row' },
          h('div', {},
            h('p', { class: 'next-meta' }, [next.time ? `${next.time}${hhmm() < next.time ? '' : ', now'}` : 'Next', `${next.steps.length} steps`, next.minutes ? `about ${next.minutes} min` : ''].filter(Boolean).join(', ')),
            h('h1', { class: 'next-name' }, next.name)),
          h('div', { class: 'next-actions' },
            h('button', { class: 'btn big', onclick: () => runBlock(next, { onExit: rerender }) }, 'Start'),
            h('button', { class: 'btn ghost', onclick: async () => { await addEvent('block_skip', { block: next.id }); rerender(); } }, next.optional ? 'Not today' : 'Skip'))))
    : h('section', { class: 'next done' }, h('p', { class: 'next-when' }, 'All blocks closed'), h('h1', { class: 'next-name' }, 'Day done'),
        h('p', { class: 'next-meta' }, 'Finish the log, then copy the handoff from Data.'));

  fill(root,
    TEST ? h('div', { class: 'test-banner' }, `Test mode, ${hhmm()}`) : null,
    h('header', { class: 'top' },
      h('div', {},
        h('p', { class: 'date' }, `${WEEKDAYS[weekday(plan.date)]} ${plan.date}`),
        h('p', { class: 'daytype' }, `${plan.typeLabel} day`, h('span', { class: 'muted' }, `Week ${plan.week}, Day ${plan.day}`))),
      h('button', { class: 'verse-pill', onclick: verseSheet, 'aria-label': `Today's verse, ${verse.ref}` },
        h('span', { class: 'verse-ref' }, verse.ref), h('span', { class: 'verse-theme' }, verse.theme))),
    nextCard,
    h('section', { class: 'day', 'aria-label': 'Today' }, dayList),
    versePanel,
    hourly,
    h('section', { class: 'counters' },
      h('button', { class: 'counter', onclick: async () => { await addEvent('habit', { habit: 'ankle_pumps' }); toast('Ankle pumps logged'); rerender(); } },
        h('span', { class: 'count' }, String(pumps)), h('span', { class: 'clbl' }, 'Ankle pumps'), h('span', { class: 'csub' }, HABITS.ankle_pumps.note.split(',')[0])),
      h('button', { class: 'counter', onclick: fluidSheet },
        h('span', { class: 'count' }, String(fluidsOz || 0)), h('span', { class: 'clbl' }, 'Fluids oz'),
        h('span', { class: 'csub' }, `target ${TARGETS.fluids_oz.join('-')}`),
        h('span', { class: 'meter', style: `--p:${Math.min(1, fluidsOz / TARGETS.fluids_oz[0])}` })),
      h('button', { class: 'counter', onclick: proteinSheet },
        h('span', { class: 'count' }, day.protein_g === null ? '–' : String(day.protein_g)), h('span', { class: 'clbl' }, 'Protein g'),
        h('span', { class: 'csub' }, `range ${TARGETS.protein_g.join('-')}`),
        h('span', { class: 'meter', style: `--p:${Math.min(1, (day.protein_g || 0) / TARGETS.protein_g[0])}` }))),
    h('nav', { class: 'bar', 'aria-label': 'Quick actions' },
      h('button', { onclick: logSheet }, 'Log'),
      h('button', { onclick: dataSheet }, 'Data')));
}
