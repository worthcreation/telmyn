// Me tab: the daily log, backups, reminders, the cloud copy, and app details.
import { h, fill } from './dom.js';
import { logSheet } from './forms.js';
import { dataActions } from './data.js';

export async function renderMe(root) {
  fill(root,
    h('header', { class: 'top' }, h('div', { class: 'top-text' }, h('h1', { class: 'daytype' }, 'Me'), h('p', { class: 'date' }, 'Log and backups'))),
    h('section', { class: 'stack me' },
      h('button', { class: 'btn', onclick: () => logSheet() }, 'Day log'),
      await dataActions()));
}
