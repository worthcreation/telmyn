// Verse card. Everything shows inside the app; nothing opens another site.
// Bible study rules carried over: verse text in its own block, never italic; original-language notes show
// word, transliteration and literal meaning only.
import { h, sheet, fill } from './dom.js';
import { state, setField } from '../state.js';
import { journalSheet } from './journal.js';
import { getVersion, setVersion, fetchVerse, listVersions, CREATORS, getCreator, setCreator, fetchVideos } from '../scripture.js';

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
  let open = null;   // 'context' (the whole chapter) | 'words'

  const text = h('div', { class: 'verse-text' }, h('p', { class: 'muted' }, 'Loading…'));
  const cite = h('p', { class: 'verse-cite' });
  const panel = h('div', { class: 'verse-panel-body' });
  const select = h('select', { class: 'version-select', 'aria-label': 'Bible version', onchange: async e => { version = e.target.value; await setVersion(version); load(); } });
  const tabs = {
    context: h('button', { class: 'chip', onclick: () => show('context') }, 'Context'),
    words: h('button', { class: 'chip', onclick: () => show('words') }, 'Greek / Hebrew'),
    study: h('button', { class: 'chip', onclick: () => show('study') }, 'Study'),
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
      panel.querySelector('.ctx-today')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch (err) { fill(panel, h('p', { class: 'muted small' }, err.message)); }
  }

  // Interlinear: every word of the verse in order, original over its English in this verse.
  // Key words (nouns, verbs, adjectives) stand out. Tap any word for its dictionary meaning and grammar.
  async function words() {
    const o = await original(v.ref);
    if (!o?.words?.length) return fill(panel, h('p', { class: 'muted small' }, 'No word notes for this verse yet.'));
    const heb = o.lang === 'hebrew';
    const detail = h('div', { class: 'w-detail' });
    const pick = (w, el) => {
      panel.querySelectorAll('.iw.on').forEach(x => x.classList.remove('on'));
      el?.classList.add('on');
      fill(detail,
        h('div', { class: 'wd-top' },
          h('span', { class: `wd-orig ${o.lang}`, lang: heb ? 'he' : 'grc', dir: heb ? 'rtl' : 'ltr' }, w.w),
          h('span', { class: 'wd-tr' }, w.t)),
        h('p', { class: 'wd-line' }, h('b', {}, 'Here: '), w.en || '(not translated)'),
        w.g ? h('p', { class: 'wd-line' }, h('b', {}, 'Meaning: '), w.g, w.lemma ? h('span', { class: 'wd-lemma', lang: heb ? 'he' : 'grc' }, ` (${w.lemma})`) : null) : null,
        w.gram ? h('p', { class: 'wd-line muted' }, w.gram) : null);
    };
    let lastV = null;
    const flow = h('div', { class: `interlinear ${o.lang}`, dir: heb ? 'rtl' : 'ltr' }, o.words.map(w => {
      const mark = r.to > r.from && w.v !== lastV ? h('span', { class: 'iw-v' }, w.v) : null;
      lastV = w.v;
      const el = h('button', { class: `iw${w.key ? ' key' : ''}`, onclick: e => pick(w, e.currentTarget) },
        h('span', { class: 'iw-o', lang: heb ? 'he' : 'grc' }, w.w),
        h('span', { class: `iw-e${w.faint ? ' faint' : ''}`, dir: 'ltr' }, w.en || '–'));
      return [mark, el];
    }).flat());
    fill(panel, h('p', { class: 'ctx-label' }, `${heb ? 'Hebrew' : 'Greek'}, word by word. Tap a word.`), flow, detail);
    const first = o.words.findIndex(w => w.key);
    pick(o.words[first], flow.querySelectorAll('.iw')[first]);
  }

  // Study: Bible teaching videos on this verse from one creator at a time, played inside the app.
  async function study() {
    let creator = await getCreator();
    const decode = t => { const e = document.createElement('textarea'); e.innerHTML = t; return e.value; };
    const picker = h('div', { class: 'seg wrap creators' });
    const list = h('div', { class: 'videos' });
    const player = h('div', { class: 'player' });
    const drawPicker = () => fill(picker, CREATORS.map(c => h('button', { class: c.key === creator ? 'on' : '', onclick: async () => { creator = c.key; await setCreator(c.key); drawPicker(); load(); } }, c.name)));
    async function load() {
      fill(player); fill(list, h('p', { class: 'muted small' }, 'Finding videos…'));
      try {
        const vids = await fetchVideos(v.ref, creator);
        if (!vids.length) return fill(list, h('p', { class: 'muted small' }, 'No videos from this creator on this passage yet. Try another.'));
        fill(list, vids.map(x => h('button', { class: 'video', onclick: () => {
          fill(player, h('iframe', { src: `https://www.youtube-nocookie.com/embed/${x.id}?autoplay=1&rel=0`, title: decode(x.title), allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true }));
          player.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } }, h('img', { src: x.thumb || '', alt: '', loading: 'lazy', onerror: e => { e.target.style.visibility = 'hidden'; } }), h('span', { class: 'v-title' }, decode(x.title)))));
      } catch (err) { fill(list, h('p', { class: 'muted small' }, err.message)); }
    }
    drawPicker();
    fill(panel, picker, player, list);
    load();
  }

  function show(which, reload = false) {
    if (open === which && !reload) { open = null; fill(panel); }
    else {
      open = which;
      if (which === 'context') passage(`${r.book} ${r.ch}`, `${r.book} ${r.ch}`);
      if (which === 'words') words();
      if (which === 'study') study();
    }
    for (const [k, b] of Object.entries(tabs)) b.classList.toggle('on', k === open);
  }

  listVersions().then(list => {
    if (!list.some(x => x.abbr === version)) list = [{ abbr: version, name: version }, ...list];
    fill(select, list.map(x => h('option', { value: x.abbr, selected: x.abbr === version }, `${x.abbr}, ${x.name}`)));
  });

  // Where it was applied today: saved to today's log and collected in the verse journal.
  const note = h('textarea', { class: 'verse-applied', rows: 2, 'aria-label': 'Where I applied it today', placeholder: 'Where I applied it today' }, state.day.verse_applied_notes ?? '');
  const saveBtn = h('button', { class: 'btn', onclick: async () => {
    await setField('verse_applied_notes', note.value.trim() || null);
    saveBtn.textContent = 'Saved'; setTimeout(() => { saveBtn.textContent = 'Save'; }, 1500);
  } }, 'Save');
  const applied = h('div', { class: 'applied' }, note,
    h('div', { class: 'applied-actions' }, h('button', { class: 'btn ghost', onclick: journalSheet }, 'Journal'), saveBtn));

  const body = h('div', { class: 'verse-sheet' },
    h('div', { class: 'verse-top' }, h('p', { class: 'verse-theme' }, v.theme), select),
    h('blockquote', { class: 'verse-block' }, text, cite),
    applied,
    h('div', { class: 'verse-tools' }, Object.values(tabs)),
    panel);
  sheet('Today’s verse', body);
  load();
}
