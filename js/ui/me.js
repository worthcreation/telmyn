// Me tab: the daily log, backups, reminders, the cloud copy, and app details.
import { daySheet } from './day.js';
import { h, fill } from './dom.js';
import { dataActions } from './data.js';

export async function renderMe(root) {
  fill(root,
    h('header', { class: 'top' }, h('p', { class: 'date' }, 'Log and backups'), h('h1', { class: 'daytype' }, 'Me')),
    h('section', { class: 'stack me' },
      h('button', { class: 'btn', onclick: () => daySheet() }, 'Day log'),
      await dataActions()));
}
