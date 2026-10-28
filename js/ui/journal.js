// Verse journal: every day's verse with where it was applied, newest first. Kept on the phone.
// Tap an entry to open that day's verse study (its verse, words and video) with what was written, read-only.
import { h, layer } from './dom.js';
import * as db from '../db.js';
import { verseFor } from '../verses.js';

const pretty = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); };

export async function journalSheet() {
  const { verseSheet } = await import('./verse.js');
  const days = (await db.all('days')).filter(d => d.verse_applied_notes).sort((a, b) => b.date.localeCompare(a.date));
  const body = days.length
    ? h('ol', { class: 'journal' }, days.map(d => h('li', {}, h('button', { class: 'j-entry', onclick: () => verseSheet(d.date) },
        h('p', { class: 'j-head' }, h('span', { class: 'j-ref' }, d.verse_ref || verseFor(d.date).ref), h('span', { class: 'j-date' }, pretty(d.date))),
        h('p', { class: 'j-note' }, d.verse_applied_notes),
        h('span', { class: 'j-open' }, 'Open that day ›')))))
    : h('p', { class: 'muted center' }, 'No entries yet. Write where you applied today’s verse on the verse screen.');
  layer('Verse journal', body);
}
