// Me tab: the daily log, the chat handoff, backups, and app details.
import { h, fill } from './dom.js';
import { logSheet } from './forms.js';
import { dataActions } from './data.js';

export async function renderMe(root) {
  fill(root,
    h('header', { class: 'top' }, h('div', {}, h('p', { class: 'date' }, 'Log, handoff, backups'), h('p', { class: 'daytype' }, 'Me'))),
    h('section', { class: 'stack me' },
      h('button', { class: 'btn', onclick: logSheet }, 'Today’s log'),
      await dataActions()));
}
