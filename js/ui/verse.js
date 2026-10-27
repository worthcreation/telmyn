// Verse card. Carries over the Bible study rules: verse text in its own block, never italic,
// original-language notes show word, transliteration and literal meaning only.
import { h, sheet } from './dom.js';
import { state, setField } from '../state.js';
import { COPYRIGHT } from '../verses.js';

export function verseSheet() {
  const v = state.verse;
  const layer = (title, ...kids) => h('details', { class: 'layer' }, h('summary', {}, title), h('div', { class: 'layer-body' }, kids));
  const body = h('div', { class: 'verse-sheet' },
    h('p', { class: 'verse-theme' }, v.theme),
    h('blockquote', { class: 'verse-block' },
      v.text ? h('p', {}, v.text) : h('p', { class: 'muted' }, 'Text not loaded yet. Open it in NKJV:'),
      h('cite', {}, `${v.ref} NKJV`)),
    h('a', { class: 'btn ghost', href: v.links.read, target: '_blank', rel: 'noopener' }, `Read ${v.ref}`),
    h('div', { class: 'field' },
      h('label', { class: 'lbl', for: 'verse-applied' }, 'Where I applied it today'),
      h('input', { id: 'verse-applied', value: state.day.verse_applied_notes ?? '', onchange: e => setField('verse_applied_notes', e.target.value || null) })),
    layer('Context', h('p', { class: 'muted small' }, 'Read the surrounding chapter for who is speaking, to whom, and why.'),
      h('a', { href: v.links.read.replace(/search=[^&]+/, 'search=' + encodeURIComponent(v.ref.replace(/:\d+(-\d+)?$/, ''))), target: '_blank', rel: 'noopener' }, 'Open the full chapter')),
    layer('Original language', h('p', { class: 'muted small' }, 'Key Greek or Hebrew words: word, transliteration, literal meaning.'),
      h('a', { href: v.links.interlinear, target: '_blank', rel: 'noopener' }, 'Bible Hub interlinear'), ' ',
      h('a', { href: v.links.blb, target: '_blank', rel: 'noopener' }, 'Blue Letter Bible')),
    layer('Deep study', h('p', { class: 'muted small' }, 'Cross-references, background, and readings where scholars differ.')),
    h('p', { class: 'fine' }, COPYRIGHT));
  sheet('Today’s verse', body);
}
