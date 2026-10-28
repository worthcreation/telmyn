// Verse study: one screen that goes deeper than the Today card instead of repeating it.
// Every word of the verse is reachable: key words are highlighted in the text, the rest are tappable too, and the
// word panel steps through every original word in order (‹ ›). Then the chapter, one BibleProject video (more on tap),
// and where it was applied today.
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
const tokens = en => (en || '').toLowerCase().replace(/[^a-z' -]/g, ' ').split(/[\s-]+/).filter(Boolean);
// Loose match so "gives" finds "gives", "giving" finds "give", "reproaching" finds "reproach".
const stem = w => w.replace(/(ing|ed|es|s|ly)$/, '');

// Place every original word's English in the verse text. Key words match loosely on their meaning words;
// the small words match exactly. Order is preferred but not required (Greek and English order differ).
// Returns the text split into plain and word parts, plus key words this version words differently.
export function markWords(text, words) {
  const marks = [];
  const lower = text.toLowerCase();
  const free = (a, b) => !marks.some(x => a < x.end && b > x.at);
  const leftover = [];
  let from = 0;
  // Key words first, so they claim their words before the small words do.
  const order = [...words.map((w, i) => ({ w, i }))].sort((a, b) => (b.w.key - a.w.key) || (a.i - b.i));
  for (const { w, i } of order) {
    const cands = w.key ? tokens(w.en).filter(t => t.length > 2 && !STOP.has(t)).reverse() : tokens(w.en).reverse();
    let hit = null;
    for (const c of cands) {
      const pat = w.key ? `\\b${stem(c).replace(/[^a-z']/g, '')}[a-z']*` : `\\b${c.replace(/[^a-z']/g, '')}\\b`;
      const all = [...lower.matchAll(new RegExp(pat, 'g'))].map(m => ({ at: m.index, end: m.index + m[0].length, w, i })).filter(m => free(m.at, m.end));
      hit = all.find(m => m.at >= from) || all[0] || null;
      if (hit) break;
    }
    if (hit) { marks.push(hit); if (w.key) from = hit.end; } else if (w.key) leftover.push(w);
  }
  marks.sort((a, b) => a.at - b.at);
  const parts = [];
  let p = 0;
  for (const m of marks) { if (m.at > p) parts.push({ t: text.slice(p, m.at) }); parts.push({ t: text.slice(m.at, m.end), w: m.w, i: m.i }); p = m.end; }
  if (p < text.length) parts.push({ t: text.slice(p) });
  return { parts, leftover };
}
// Kept for the test from 0.10.1.
export const markKeyWords = markWords;

export async function verseSheet() {
  const v = state.verse;
  const r = parseRef(v.ref);
  let version = await getVersion();
  const o = await original(v.ref).catch(() => null);
  const heb = o?.lang === 'hebrew';
  const words = o?.words || [];
  let current = -1;

  const text = h('p', { class: 'vs-text' }, 'Loading…');
  const cite = h('p', { class: 'vs-cite' }, `${v.ref} ${version}`);
  const def = h('div', { class: 'vs-def' });
  const select = h('select', { class: 'vs-version', 'aria-label': 'Bible version', onchange: async e => { version = e.target.value; await setVersion(version); load(); } });

  // One original word at a time, right under the verse. ‹ › walk every word in order.
  function define(i) {
    current = i;
    const w = words[i];
    text.querySelectorAll('.on').forEach(x => x.classList.remove('on'));
    text.querySelectorAll(`[data-i="${i}"]`).forEach(x => x.classList.add('on'));
    fill(def,
      h('div', { class: 'vs-def-top' },
        h('span', { class: `vs-orig${heb ? ' hebrew' : ''}`, lang: heb ? 'he' : 'grc', dir: heb ? 'rtl' : 'ltr' }, w.w),
        h('span', { class: 'vs-tr' }, w.t),
        h('span', { class: 'vs-nav' },
          h('button', { class: 'icon-btn', 'aria-label': 'Previous word', disabled: i === 0, onclick: () => define(i - 1) }, '‹'),
          h('span', { class: 'vs-count' }, `${i + 1} of ${words.length}`),
          h('button', { class: 'icon-btn', 'aria-label': 'Next word', disabled: i === words.length - 1, onclick: () => define(i + 1) }, '›'))),
      h('p', { class: 'vs-line' }, h('b', {}, 'Meaning'), w.g || '(none listed)'),
      h('p', { class: 'vs-line' }, h('b', {}, 'Here'), w.en || '(not translated)'),
      w.gram ? h('p', { class: 'vs-line muted' }, w.gram === 'cond' ? 'conditional particle' : w.gram) : null);
  }

  async function load() {
    cite.textContent = `${v.ref} ${version}`;
    let d;
    try { d = await fetchVerse(v.ref, version); } catch (err) { return fill(text, h('span', { class: 'muted' }, err.message)); }
    if (!words.length) { fill(def, h('p', { class: 'muted small' }, 'No word notes for this verse yet.')); return fill(text, d.text); }
    const { parts, leftover } = markWords(d.text, words);
    fill(text, parts.map(p => p.w
      ? h('button', { class: p.w.key ? 'kw' : 'sw', 'data-i': p.i, onclick: () => define(p.i) }, p.t)
      : p.t));
    // Key words this version words differently still get a tap target, after the verse.
    if (leftover.length) text.append(h('span', { class: 'kw-more' }, leftover.map(w => {
      const i = words.indexOf(w);
      return h('button', { class: 'kw-extra', 'data-i': i, onclick: () => define(i) }, w.en || w.t);
    })));
    define(current >= 0 ? current : Math.max(0, words.findIndex(w => w.key)));
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

  // BibleProject: the book overview is the one shown (it is about this passage); videos on the verse's main
  // word wait behind "More videos".
  const card = x => h('button', { class: 'vs-video', onclick: () => playVideo(`https://www.youtube.com/watch?v=${x.id}`, decode(x.title)) },
    h('span', { class: 'vb-thumb', style: x.thumb ? `background-image:url('${x.thumb}')` : '' }),
    h('span', { class: 'vs-vt' }, h('b', {}, decode(x.title)), h('small', {}, 'BibleProject')));
  const watch = h('div', { class: 'vs-watch' }, h('p', { class: 'muted small' }, 'Finding BibleProject videos…'));
  const topic = words.find(w => w.key && /noun/.test(w.gram || ''))?.g?.split(/[\s/,]/)[0] || null;
  Promise.all([fetchVideos(v.ref), topic ? fetchVideos(v.ref, 'bibleproject', topic).catch(() => []) : []]).then(([book, word]) => {
    const all = [...book, ...word].filter((x, i, a) => a.findIndex(y => y.id === x.id) === i);
    if (!all.length) return fill(watch, h('p', { class: 'muted small' }, 'No BibleProject video on this passage yet.'));
    const [first, ...rest] = all;
    fill(watch, card(first), rest.length ? h('button', { class: 'vs-morevids', onclick: () => {
      sheet('BibleProject videos', h('div', { class: 'vs-vlist' },
        h('p', { class: 'muted small' }, `On ${r.book}${topic ? ` and on ${topic}` : ''}.`), all.map(card)), { full: true });
    } }, `More videos (${rest.length}) ›`) : null);
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
