// Home screen. Fits one phone screen: what's next, what's after, today's counters, quick actions.
import { h, toast, fill } from './dom.js';
import { state, addEvent } from '../state.js';
import { nextBlock, blockStatus } from '../program/index.js';
import { fluidTotals } from '../schema.js';
import { WEEKDAYS, weekday, TEST, hhmm } from '../clock.js';
import { runBlock } from './runner.js';
import { fluidSheet, proteinSheet, logSheet } from './forms.js';
import { verseSheet } from './verse.js';
import { dataSheet } from './data.js';

let upcomingOpen = false;

export function renderToday(root) {
  const { plan, verse, day, events } = state;
  const { TARGETS, HABITS } = plan.program.data; // always the program version in effect for this date
  const next = nextBlock(plan, events, day);
  const totals = fluidTotals(day, state.fluids);
  const fluidsOz = Math.round(((totals.water_oz || 0) + (totals.other_drinks_oz || 0)) * 10) / 10;
  const hourlyDone = events.filter(e => e.type === 'block_done' && e.block === 'hourly');
  const lastPalms = [...hourlyDone].reverse().find(e => e.palms)?.palms;
  const pumps = events.filter(e => e.type === 'habit' && e.habit === 'ankle_pumps').length;
  const rerender = () => renderToday(root);

  const upcoming = plan.blocks.filter(b => b !== next);
  const statusMark = b => ({ done: '✓', skip: 'skipped', partial: 'partial' }[blockStatus(b.id, events, day, plan)] || (b.time || ''));

  const nextCard = next
    ? h('section', { class: 'next', 'aria-label': 'Next block' },
        h('p', { class: 'next-when' }, next.time ? `${next.time}${hhmm() < next.time ? '' : ', now'}` : 'Next'),
        h('h1', { class: 'next-name' }, next.name),
        h('p', { class: 'next-meta' }, `${next.steps.length} steps${next.minutes ? `, about ${next.minutes} min` : ''}`),
        h('div', { class: 'next-actions' },
          h('button', { class: 'btn big', onclick: () => runBlock(next, { onExit: rerender }) }, 'Start'),
          h('button', { class: 'btn ghost', onclick: async () => { await addEvent('block_skip', { block: next.id }); rerender(); } }, next.optional ? 'Not today' : 'Skip')))
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

    h('section', { class: 'upcoming' },
      h('button', { class: 'upcoming-toggle', 'aria-expanded': upcomingOpen, onclick: () => { upcomingOpen = !upcomingOpen; rerender(); } },
        upcomingOpen ? 'Hide the rest of today' : `Then: ${upcoming.filter(b => !blockStatus(b.id, events, day, plan)).map(b => b.name).join(', ') || 'nothing left'}`),
      upcomingOpen ? h('ol', { class: 'upcoming-list' }, plan.blocks.map(b =>
        h('li', { class: blockStatus(b.id, events, day, plan) ? 'closed' : '' },
          h('button', { onclick: () => runBlock(b, { onExit: rerender }) }, h('span', {}, b.name), h('span', { class: 'muted' }, statusMark(b)))))) : null),

    h('section', { class: 'counters' },
      plan.hourly ? h('button', { class: 'counter', onclick: () => runBlock(plan.hourly, { onExit: rerender }) },
        h('span', { class: 'count' }, String((day.hourly_blocks_count || 0) + hourlyDone.length)), h('span', { class: 'clbl' }, 'Hourly'),
        h('span', { class: 'csub' }, lastPalms ? `next palms ${lastPalms === 'up' ? 'down' : 'up'}` : 'tap to start')) : null,
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
