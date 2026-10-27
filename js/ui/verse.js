// Verse card. Everything shows inside the app; nothing opens another site.
// Bible study rules carried over: verse text in its own block, never italic; original-language notes show
// word, transliteration and literal meaning only.
import { h, sheet, fill } from './dom.js';
import { state, setField } from '../state.js';
import { getVersion, setVersion, fetchVerse, listVersions } from '../scripture.js';

function parseRef(ref) {
  const m = ref.match(/^(.+?)\s(\d+):(\d+)(?:-(\d+))?$/);
  return { book: m[1], ch: Number(m[2]), from: Number(m[3]), to: Number(m[4] || m[3]) };
}
const verseNo = id => Number((id.match(/-(\d+)$/) || [])[1]);

let originalData;
async function original(ref) {
  originalData ||= fetch('data/original.json').then(r => r.json());
  return (await originalData).verses[ref];
}

export async function verseSheet() {
  const v = state.verse;
  const r = parseRef(v.ref);
  let version = await getVersion();
  let open = null;   // 'context' | 'chapter' | 'words'

  const text = h('div', { class: 'verse-text' }, h('p', { class: 'muted' }, 'Loading…'));
  const cite = h('p', { class: 'verse-cite' });
  const panel = h('div', { class: 'verse-panel-body' });
  const select = h('select', { class: 'version-select', 'aria-label': 'Bible version', onchange: async e => { version = e.target.value; await setVersion(version); load(); } });
  const tabs = {
    context: h('button', { class: 'chip', onclick: () => show('context') }, 'Context'),
    chapter: h('button', { class: 'chip', onclick: () => show('chapter') }, 'Chapter'),
    words: h('button', { class: 'chip', onclick: () => show('words') }, 'Greek / Hebrew'),
  };

  async function load() {
    cite.textContent = `${v.ref} ${version}`;
    fill(text, h('p', { class: 'muted' }, 'Loading…'));
    try { fill(text, h('p', {}, (await fetchVerse(v.ref, version)).text)); }
    catch (err) { fill(text, h('p', { class: 'muted' }, err.message)); }
    if (open && open !== 'words') show(open, true);
  }

  // Passage with verse numbers; today's verses highlighted.
  async function passage(ref, label) {
    fill(panel, h('p', { class: 'muted small' }, 'Loading…'));
    try {
      const d = await fetchVerse(ref, version);
      fill(panel, h('p', { class: 'ctx-label' }, label),
        h('p', { class: 'ctx-text' }, d.verses.map(x => {
          const n = verseNo(x.id);
          return h('span', { class: n >= r.from && n <= r.to ? 'ctx-today' : '' }, h('sup', {}, n), ` ${x.text} `);
        })));
    } catch (err) { fill(panel, h('p', { class: 'muted small' }, err.message)); }
  }

  async function words() {
    const o = await original(v.ref);
    if (!o?.words?.length) return fill(panel, h('p', { class: 'muted small' }, 'No word notes for this verse yet.'));
    const multi = r.to > r.from;
    fill(panel, h('p', { class: 'ctx-label' }, o.lang === 'hebrew' ? 'Key Hebrew words' : 'Key Greek words'),
      h('ol', { class: 'words' }, o.words.map(w => h('li', {},
        h('span', { class: `w-orig ${o.lang}`, lang: o.lang === 'hebrew' ? 'he' : 'grc', dir: o.lang === 'hebrew' ? 'rtl' : 'ltr' }, w.w),
        h('span', { class: 'w-tr' }, (multi ? `v${w.v} ` : '') + w.t),
        h('span', { class: 'w-gl' }, w.g)))));
  }

  function show(which, reload = false) {
    if (open === which && !reload) { open = null; fill(panel); }
    else {
      open = which;
      if (which === 'context') passage(`${r.book} ${r.ch}:${Math.max(1, r.from - 3)}-${r.to + 3}`, `${r.book} ${r.ch}:${Math.max(1, r.from - 3)}-${r.to + 3}`);
      if (which === 'chapter') passage(`${r.book} ${r.ch}`, `${r.book} ${r.ch}`);
      if (which === 'words') words();
    }
    for (const [k, b] of Object.entries(tabs)) b.classList.toggle('on', k === open);
  }

  listVersions().then(list => {
    if (!list.some(x => x.abbr === version)) list = [{ abbr: version, name: version }, ...list];
    fill(select, list.map(x => h('option', { value: x.abbr, selected: x.abbr === version }, `${x.abbr}, ${x.name}`)));
  });

  const body = h('div', { class: 'verse-sheet' },
    h('div', { class: 'verse-top' }, h('p', { class: 'verse-theme' }, v.theme), select),
    h('blockquote', { class: 'verse-block' }, text, cite),
    h('input', { class: 'verse-applied', 'aria-label': 'Where I applied it today', placeholder: 'Where I applied it today',
      value: state.day.verse_applied_notes ?? '', onchange: e => setField('verse_applied_notes', e.target.value || null) }),
    h('div', { class: 'verse-tools' }, Object.values(tabs)),
    panel);
  sheet('Today’s verse', body);
  load();
}
