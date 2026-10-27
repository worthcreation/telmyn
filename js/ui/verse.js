// Verse card. Bible study rules carried over: verse text in its own block, never italic.
// Text comes from Bible Gateway in the version Ross picks; the choice is remembered.
import { h, sheet, fill } from './dom.js';
import { state, setField } from '../state.js';
import { getVersion, setVersion, fetchVerse, listVersions, passageUrl } from '../scripture.js';

export async function verseSheet() {
  const v = state.verse;
  let version = await getVersion();
  const block = h('blockquote', { class: 'verse-block' }, h('p', { class: 'muted' }, 'Loading…'));
  const select = h('select', { class: 'version-select', 'aria-label': 'Bible version', onchange: async e => { version = e.target.value; await setVersion(version); load(); } });
  const readLink = h('a', { class: 'btn ghost', target: '_blank', rel: 'noopener' }, '');
  const copy = h('p', { class: 'fine' });

  async function load() {
    readLink.href = passageUrl(v.ref, version);
    readLink.textContent = `Open ${v.ref} on Bible Gateway`;
    fill(block, h('p', { class: 'muted' }, 'Loading…'));
    try {
      const d = await fetchVerse(v.ref, version);
      fill(block, h('p', {}, d.text), h('cite', {}, `${v.ref} ${d.version}`));
      copy.textContent = d.copyright || `${d.version}, from Bible Gateway.`;
    } catch (err) {
      fill(block, h('p', { class: 'muted' }, `${err.message} Open it on Bible Gateway instead.`), h('cite', {}, `${v.ref} ${version}`));
      copy.textContent = '';
    }
  }

  listVersions().then(list => {
    if (!list.some(x => x.abbr === version)) list = [{ abbr: version, name: version }, ...list];
    fill(select, list.map(x => h('option', { value: x.abbr, selected: x.abbr === version }, `${x.abbr}, ${x.name}`)));
  });

  const layer = (title, ...kids) => h('details', { class: 'layer' }, h('summary', {}, title), h('div', { class: 'layer-body' }, kids));
  const body = h('div', { class: 'verse-sheet' },
    h('div', { class: 'verse-top' }, h('p', { class: 'verse-theme' }, v.theme), select),
    block,
    readLink,
    h('div', { class: 'field' },
      h('label', { class: 'lbl', for: 'verse-applied' }, 'Where I applied it today'),
      h('input', { id: 'verse-applied', value: state.day.verse_applied_notes ?? '', onchange: e => setField('verse_applied_notes', e.target.value || null) })),
    layer('Context', h('p', { class: 'muted small' }, 'Read the surrounding chapter for who is speaking, to whom, and why.'),
      h('a', { href: passageUrl(v.ref.replace(/:\d+(-\d+)?$/, ''), version), target: '_blank', rel: 'noopener' }, 'Open the full chapter')),
    layer('Original language', h('p', { class: 'muted small' }, 'Key Greek or Hebrew words: word, transliteration, literal meaning.'),
      h('a', { href: v.links.interlinear, target: '_blank', rel: 'noopener' }, 'Bible Hub interlinear'), ' ',
      h('a', { href: v.links.blb, target: '_blank', rel: 'noopener' }, 'Blue Letter Bible')),
    layer('Deep study', h('p', { class: 'muted small' }, 'Cross-references, background, and readings where scholars differ.')),
    copy);
  sheet('Today’s verse', body);
  load();
}
