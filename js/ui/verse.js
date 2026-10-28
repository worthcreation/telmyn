// Verse study: one screen that goes deeper than the Today card instead of repeating it.
// The verse with its key words highlighted (tap one for its Greek or Hebrew meaning, shown right under the verse),
// then the chapter, a BibleProject video on this book or word, and where it was applied today.
// Rules carried over: verse text never italic; original-language notes show word, transliteration and meaning only.
// Everything shows inside the app; nothing opens another site.
import { h, sheet, fill } from './dom.js';
import { state, setField } from '../state.js';
import { journalSheet } from './journal.js';
import { playVideo } from './media.js';
import { getVersion, setVersion, fetchVerse, listVersions, fetchVideos } from '../scripture.js';

function parseRef(ref) {
  const m = ref.match(/^(.+?)\s(\d+):(\d+)(?:-(\d+))?$/);
  return { book: m[1], ch: Number(m[2]), from: Number(m[3]), to: Number(m[4] || m[3]) };
}
const verseNo = id => Number((id.match(/-(\d+)$/) || [])[1]);
const decode = t => { const e = document.createElement('textarea'); e.innerHTML = t; return e.value; };

let originalData;
async function original(ref) {
  originalData ||= fetch('data/original.json').then(r => r.json());
  return (await originalData).verses[ref];
}

// Small words that never carry a key word's meaning on their own.
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'and', 'he', 'she', 'it', 'they', 'you', 'we', 'i', 'is', 'be', 'will', 'should', 'shall', 'may', 'one', 'in', 'on', 'for', 'with', 'from', 'by', 'that', 'this', 'his', 'her', 'their', 'not', 'let', 'have', 'has', 'was', 'were', 'are', 'who', 'which', 'what', 'him', 'them', 'us', 'me', 'my', 'your', 'our']);
const content = en => (en || '').toLowerCase().replace(/[^a-z' -]/g, ' ').split(/[\s-]+/).filter(w => w.length > 2 && !STOP.has(w));
// Loose match so "gives" finds "gives", "giving" finds "give", "reproaching" finds "reproach".
const stem = w => w.replace(/(ing|ed|es|s|ly)$/, '');

// Find each key word's English in the verse text, in order. Returns the text split into plain and highlighted parts,
// plus the key words that could not be placed (another version may word it differently).
export function markKeyWords(text, words) {
  const marks = [];
  let from = 0;
  const lower = text.toLowerCase();
  const leftover = [];
  for (const w of words.filter(x => x.key)) {
    let hit = null;
    // Prefer the next unused match after the previous key word (Greek and English order mostly agree),
    // otherwise any unused match: word order differs between languages ("giving God" / "God, who gives").
    const free = (a, b) => !marks.some(x => a < x.end && b > x.at);
    for (const c of content(w.en).reverse()) {
      const re = new RegExp(`\\b${stem(c).replace(/[^a-z']/g, '')}[a-z']*`, 'g');
      const all = [...lower.matchAll(re)].map(m => ({ at: m.index, end: m.index + m[0].length, w })).filter(m => free(m.at, m.end));
      hit = all.find(m => m.at >= from) || all[0] || null;
      if (hit) break;
    }
    if (hit) { marks.push(hit); from = hit.end; } else leftover.push(w);
  }
  marks.sort((a, b) => a.at - b.at);
  const parts = [];
  let i = 0;
  for (const m of marks) { if (m.at > i) parts.push({ t: text.slice(i, m.at) }); parts.push({ t: text.slice(m.at, m.end), w: m.w }); i = m.end; }
  if (i < text.length) parts.push({ t: text.slice(i) });
  return { parts, leftover };
}

export async function verseSheet() {
  const v = state.verse;
  const r = parseRef(v.ref);
  let version = await getVersion();
  const o = await original(v.ref).catch(() => null);
  const heb = o?.lang === 'hebrew';

  const text = h('p', { class: 'vs-text' }, 'Loading…');
  const cite = h('p', { class: 'vs-cite' }, `${v.ref} ${version}`);
  const def = h('div', { class: 'vs-def' });
  const select = h('select', { class: 'vs-version', 'aria-label': 'Bible version', onchange: async e => { version = e.target.value; await setVersion(version); load(); } });

  // Meaning of one word, right under the verse.
  function define(w, el) {
    text.querySelectorAll('.kw.on, .kw-extra.on').forEach(x => x.classList.remove('on'));
    el?.classList.add('on');
    fill(def,
      h('div', { class: 'vs-def-top' },
        h('span', { class: `vs-orig${heb ? ' hebrew' : ''}`, lang: heb ? 'he' : 'grc', dir: heb ? 'rtl' : 'ltr' }, w.w),
        h('span', { class: 'vs-tr' }, w.t)),
      w.g ? h('p', { class: 'vs-line' }, h('b', {}, 'Meaning '), w.g) : null,
      h('p', { class: 'vs-line' }, h('b', {}, 'Here '), w.en || '(not translated)'),
      w.gram ? h('p', { class: 'vs-line muted' }, w.gram) : null);
  }

  async function load() {
    cite.textContent = `${v.ref} ${version}`;
    let d;
    try { d = await fetchVerse(v.ref, version); } catch (err) { return fill(text, h('span', { class: 'muted' }, err.message)); }
    if (!o?.words?.length) { fill(def, h('p', { class: 'muted small' }, 'No word notes for this verse yet.')); return fill(text, d.text); }
    const { parts, leftover } = markKeyWords(d.text, o.words);
    const firstEl = [];
    fill(text, parts.map(p => {
      if (!p.w) return p.t;
      const el = h('button', { class: 'kw', onclick: e => define(p.w, e.currentTarget) }, p.t);
      firstEl.push([p.w, el]);
      return el;
    }));
    // Key words this version words differently still get a tap target, after the verse.
    if (leftover.length) text.append(h('span', { class: 'kw-more' }, leftover.map(w => h('button', { class: 'kw-extra', onclick: e => define(w, e.currentTarget) }, w.en || w.t))));
    if (firstEl.length) define(...firstEl[0]); else if (leftover.length) define(leftover[0], text.querySelector('.kw-extra'));
  }

  // The whole chapter, today's verses highlighted, in its own reading sheet.
  async function chapter() {
    const body = h('div', { class: 'ctx' }, h('p', { class: 'muted small' }, 'Loading…'));
    sheet(`${r.book} ${r.ch}`, body, { full: true });
    try {
      const d = await fetchVerse(`${r.book} ${r.ch}`, version);
      fill(body, h('p', { class: 'ctx-text' }, d.verses.map(x => {
        const n = verseNo(x.id);
        return h('span', { class: n >= r.from && n <= r.to ? 'ctx-today' : '' }, h('sup', {}, n), ` ${x.text} `);
      })));
      body.querySelector('.ctx-today')?.scrollIntoView({ block: 'center' });
    } catch (err) { fill(body, h('p', { class: 'muted small' }, err.message)); }
  }

  // BibleProject only: their overview of this book, plus any of their videos on this verse's main word.
  const watch = h('div', { class: 'vs-watch' }, h('p', { class: 'muted small' }, 'Finding BibleProject videos…'));
  const topic = o?.words?.find(w => w.key && /noun/.test(w.gram || ''))?.g?.split(/[\s/,]/)[0] || null;
  Promise.all([fetchVideos(v.ref), topic ? fetchVideos(v.ref, 'bibleproject', topic).catch(() => []) : []]).then(([book, word]) => {
    // Word video first when there is one (it is about this verse's idea), then the book overview.
    const vids = [...word, ...book].filter((x, i, a) => a.findIndex(y => y.id === x.id) === i);
    if (!vids.length) return fill(watch, h('p', { class: 'muted small' }, 'No BibleProject video on this book yet.'));
    fill(watch, vids.slice(0, 2).map(x => h('button', { class: 'vs-video', onclick: () => playVideo(`https://www.youtube.com/watch?v=${x.id}`, decode(x.title)) },
      h('span', { class: 'vb-thumb', style: x.thumb ? `background-image:url('${x.thumb}')` : '' }),
      h('span', {}, h('b', {}, decode(x.title)), h('small', {}, 'BibleProject')))));
  }).catch(err => fill(watch, h('p', { class: 'muted small' }, err.message)));

  listVersions().then(list => {
    if (!list.some(x => x.abbr === version)) list = [{ abbr: version, name: version }, ...list];
    fill(select, list.map(x => h('option', { value: x.abbr, selected: x.abbr === version }, x.abbr)));
  });

  // Where it was applied today: saved to today's log and collected in the verse journal.
  const note = h('textarea', { class: 'vs-applied', rows: 2, 'aria-label': 'Where I applied it today', placeholder: 'Where I applied it today' }, state.day.verse_applied_notes ?? '');
  const saveBtn = h('button', { class: 'btn', onclick: async () => {
    await setField('verse_applied_notes', note.value.trim() || null);
    saveBtn.textContent = 'Saved'; setTimeout(() => { saveBtn.textContent = 'Save'; }, 1500);
  } }, 'Save');

  const body = h('div', { class: 'vs' },
    h('div', { class: 'vs-top' }, h('span', { class: 'vs-theme' }, v.theme), select),
    h('blockquote', { class: 'vs-verse' }, text, cite),
    def,
    h('div', { class: 'vs-more' },
      h('button', { class: 'chip vs-chapter', onclick: chapter }, h('b', {}, `${r.book} ${r.ch}`), h('small', {}, 'Read the chapter')),
      watch),
    h('div', { class: 'vs-apply' }, note, h('div', { class: 'applied-actions' }, h('button', { class: 'btn ghost', onclick: journalSheet }, 'Journal'), saveBtn)));
  sheet(v.ref, body, { full: true });
  load();
}
