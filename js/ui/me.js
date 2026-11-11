// Me tab: the daily log, backups, reminders, the cloud copy, and app details.
import { daySheet } from './day.js';
import { h, fill } from './dom.js';
import { dataActions } from './data.js';
import { pauseSheet } from './pause.js';
import { currentPause, pauseName } from '../pause.js';
import { state } from '../state.js';
import { dayLabel } from '../clock.js';

export async function renderMe(root, rerender) {
  // Pause: the one covering today or coming next, by name and dates; otherwise a way to start one.
  const p = currentPause(state.date);
  const pauseLabel = p ? `${pauseName(p)}, ${p.from > state.date ? `from ${dayLabel(p.from)}` : `until ${dayLabel(p.to)}`}` : 'Pause or light days';
  fill(root,
    h('header', { class: 'top' }, h('p', { class: 'date' }, 'Log and backups'), h('h1', { class: 'daytype' }, 'Me')),
    h('section', { class: 'stack me' },
      h('button', { class: 'btn', onclick: () => daySheet() }, 'Day log'),
      h('button', { class: 'btn ghost', onclick: () => pauseSheet(rerender) }, pauseLabel),
      await dataActions()));
}
