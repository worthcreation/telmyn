// Verse card. Bible study rules carried over: verse text in its own block, never italic.
// Only things that do something: the verse, version picker, context in place, where it was applied, study links.
import { h, sheet, fill } from './dom.js';
import { state, setField } from '../state.js';
import { getVersion, setVersion, fetchVerse, listVersions, passageUrl } from '../scripture.js';

// "1 Corinthians 9:24-27" -> { book, ch, from, to }
function parseRef(ref) {
  const m = ref.match(/^(.+?)\s(\d+):(\d+)(?:-(\d+))?$/);
  return { book: m[1], ch: Number(m[2]), from: Number(m[3]), to: Number(m[4] || m[3]) };
}
const contextRef = r => `${r.book} ${r.ch}:${Math.max(1, r.from - 3)}-${r.to + 3}`;
const verseNo = id => Number((id.match(/-(\d+)$/) || [])[1]);

export async function verseSheet() {
  const v = state.verse;
  const r = parseRef(v.ref);
  let version = await getVersion();
  let contextOpen = false;

  const text = h('div', { class: 'verse-text' }, h('p', { class: 'muted' }, 'Loading…'));
  const cite = h('a', { class: 'verse-cite', target: '_blank', rel: 'noopener' });
  const context = h('div', { class: 'verse-context' });
  const ctxBtn = h('button', { class: 'chip', onclick: toggleContext });
  const select = h('select', { class: 'version-select', 'aria-label': 'Bible version', onchange: async e => { version = e.target.value; await setVersion(version); load(); } });

  async function load() {
    cite.href = passageUrl(v.ref, version);
    cite.textContent = `${v.ref} ${version}`;
    fill(text, h('p', { class: 'muted' }, 'Loading…'));
    try {
      const d = await fetchVerse(v.ref, version);
      fill(text, h('p', {}, d.text));
    } catch (err) {
      fill(text, h('p', { class: 'muted' }, `${err.message} Tap the reference to read it on Bible Gateway.`));
    }
    if (contextOpen) loadContext();
  }

  async function loadContext() {
    const ref = contextRef(r);
    fill(context, h('p', { class: 'muted small' }, 'Loading…'));
    try {
      const d = await fetchVerse(ref, version);
      fill(context, h('p', { class: 'ctx-label' }, ref.replace(`${r.book} `, `${r.book} `)),
        h('p', { class: 'ctx-text' }, d.verses.map(x => {
          const n = verseNo(x.id);
          return h('span', { class: n >= r.from && n <= r.to ? 'ctx-today' : '' }, h('sup', {}, n), ` ${x.text} `);
        })));
    } catch (err) { fill(context, h('p', { class: 'muted small' }, err.message)); }
  }

  function toggleContext() {
    contextOpen = !contextOpen;
    ctxBtn.textContent = contextOpen ? 'Hide context' : 'Context';
    if (contextOpen) loadContext(); else fill(context);
  }
  ctxBtn.textContent = 'Context';

  listVersions().then(list => {
    if (!list.some(x => x.abbr === version)) list = [{ abbr: version, name: version }, ...list];
    fill(select, list.map(x => h('option', { value: x.abbr, selected: x.abbr === version }, `${x.abbr}, ${x.name}`)));
  });

  const chapter = `${r.book} ${r.ch}`;
  const body = h('div', { class: 'verse-sheet' },
    h('div', { class: 'verse-top' }, h('p', { class: 'verse-theme' }, v.theme), select),
    h('blockquote', { class: 'verse-block' }, text, cite),
    h('div', { class: 'verse-tools' },
      ctxBtn,
      h('a', { class: 'chip', href: passageUrl(chapter, version), target: '_blank', rel: 'noopener' }, 'Full chapter'),
      h('a', { class: 'chip', href: v.links.interlinear, target: '_blank', rel: 'noopener' }, 'Greek / Hebrew')),
    context,
    h('input', { class: 'verse-applied', 'aria-label': 'Where I applied it today', placeholder: 'Where I applied it today',
      value: state.day.verse_applied_notes ?? '', onchange: e => setField('verse_applied_notes', e.target.value || null) }));
  sheet('Today’s verse', body);
  load();
}
