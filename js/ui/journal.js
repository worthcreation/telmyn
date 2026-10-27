// Verse journal: every day's verse with where it was applied, newest first. Kept on the phone.
import { h, sheet } from './dom.js';
import * as db from '../db.js';
import { verseFor } from '../verses.js';

const pretty = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); };

export async function journalSheet() {
  const days = (await db.all('days')).filter(d => d.verse_applied_notes).sort((a, b) => b.date.localeCompare(a.date));
  const body = days.length
    ? h('ol', { class: 'journal' }, days.map(d => h('li', {},
        h('p', { class: 'j-head' }, h('span', { class: 'j-ref' }, d.verse_ref || verseFor(d.date).ref), h('span', { class: 'j-date' }, pretty(d.date))),
        h('p', { class: 'j-note' }, d.verse_applied_notes))))
    : h('p', { class: 'muted center' }, 'No entries yet. Write where you applied today’s verse in the verse card and tap Save.');
  sheet('Verse journal', body, { full: true });
}
