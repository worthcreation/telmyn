// Verse study: one screen that goes deeper than the Today card instead of repeating it.
// Every word of the verse is reachable: key words are highlighted in the text, the rest are tappable too, and the
// word panel steps through every original word in order (‹ ›). Then the chapter, one BibleProject video (more on tap),
// and where it was applied today.
// Rules carried over: verse text never italic; original-language notes show word, transliteration and meaning only.
// Everything shows inside the app; nothing opens another site.
import { h, fill } from './dom.js';
import { state, setField } from '../state.js';
import { journalSheet } from './journal.js';
import { playVideo } from './media.js';
import { getVersion, setVersion, fetchVerse, listVersions, fetchVideos, fetchPassageVideos } from '../scripture.js';

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
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'and', 'he', 'she', 'it', 'they', 'you', 'we', 'i', 'is', 'be', 'will', 'should', 'shall', 'may', 'one', 'in', 'on', 'for', 'with', 'from', 'by', 'that', 'this', 'his', 'her', 'their', 'not', 'let', 'have', 'has', 'was', 'were', 'are', 'who', 'which', 'what', 'him', 'them', 'us', 'me', 'my', 'your', 'our', 'do', 'does', 'did', 'while', 'when', 'then', 'so', 'but', 'if', 'also', 'even', 'as', 'there', 'these', 'those', 'things']);
const tokens = en => (en || '').toLowerCase().replace(/[^a-z' -]/g, ' ').split(/[\s-]+/).filter(Boolean);
// Loose match so "gives" finds "gives", "giving" finds "give", "reproaching" finds "reproach".
const stem = w => w.replace(/(ing|ed|es|s|ly)$/, '');
const isContent = t => t.length > 2 && !STOP.has(t);

// Place every original word in the verse text.
// 1. Key words match loosely on their English, or on a one-word meaning ("in well" means "good").
// 2. Small words match exactly.
// 3. A match grows over neighbors its English includes ("grow" + "weary").
// 4. Key words still unplaced (a version words them differently: "generously" is NKJV's "liberally") take the
//    unused words nearest where their neighbors say they belong. Every key word ends up inside the text.
export function markWords(text, words) {
  const lower = text.toLowerCase();
  const toks = [...lower.matchAll(/[a-z']+/g)].map(m => ({ t: m[0], at: m.index, end: m.index + m[0].length }));
  const marks = [];
  const free = (a, b) => !marks.some(x => a < x.end && b > x.at);
  const place = (w, i, pats, from) => {
    for (const pat of pats) {
      const all = [...lower.matchAll(new RegExp(pat, 'g'))].map(m => ({ at: m.index, end: m.index + m[0].length, w, i })).filter(m => free(m.at, m.end));
      const hit = all.find(m => m.at >= from) || all[0];
      if (hit) { marks.push(hit); return hit; }
    }
    return null;
  };
  const esc = c => c.replace(/[^a-z']/g, '');
  // The word itself first, then its stem with a common ending ("giving" finds "gives").
  const loose = c => [`\\b${esc(c)}\\b`, `\\b${esc(stem(c))}(?:ing|ed|es|s|ly|en|e)?\\b`];
  let from = 0;
  const keys = words.map((w, i) => ({ w, i })).filter(x => x.w.key);
  const unplaced = [];
  for (const { w, i } of keys) {
    const en = tokens(w.en).filter(isContent).reverse().flatMap(loose);
    const g = (w.g || '').split('/').map(x => x.trim()).filter(x => x && !/\s/.test(x) && isContent(x)).flatMap(loose);
    const hit = place(w, i, [...en, ...g], from);
    if (hit) from = hit.end; else unplaced.push({ w, i });
  }
  // Small words: in original order, starting after the nearest earlier word already placed.
  for (const { w, i } of words.map((w, i) => ({ w, i })).filter(x => !x.w.key)) {
    const prev = marks.filter(m => m.i < i).sort((a, b) => b.i - a.i)[0];
    place(w, i, tokens(w.en).reverse().map(c => `\\b${esc(c)}\\b`), prev ? prev.end : 0);
  }
  // 3. Grow each match over adjacent words its own English contains.
  for (const m of marks) {
    const own = new Set(tokens(m.w.en).map(stem));
    for (let k = toks.findIndex(t => t.at >= m.end); k >= 0 && k < toks.length && own.has(stem(toks[k].t)) && free(toks[k].at, toks[k].end) && /^[\s]*$/.test(lower.slice(m.end, toks[k].at)); k++) m.end = toks[k].end;
    for (let k = toks.findLastIndex(t => t.end <= m.at); k >= 0 && own.has(stem(toks[k].t)) && free(toks[k].at, toks[k].end) && /^[\s]*$/.test(lower.slice(toks[k].end, m.at)); k--) m.at = toks[k].at;
  }
  // 4. Unplaced key words take the nearest run of unused content words, guided by their placed neighbors.
  const runs = [];
  for (const t of toks) {
    if (!isContent(t.t) || !free(t.at, t.end)) continue;
    const last = runs[runs.length - 1];
    if (last && /^[\s]*$/.test(lower.slice(last.end, t.at))) last.end = t.end; else runs.push({ at: t.at, end: t.end });
  }
  for (const { w, i } of unplaced) {
    const before = marks.filter(m => m.i < i).sort((a, b) => b.i - a.i)[0];
    const after = marks.filter(m => m.i > i).sort((a, b) => a.i - b.i)[0];
    const lo = before ? before.end : 0, hi = after ? after.at : text.length;
    const target = lo <= hi ? (lo + hi) / 2 : lo;
    const open = runs.filter(r => free(r.at, r.end));
    if (!open.length) continue;
    const best = open.sort((a, b) => Math.abs((a.at + a.end) / 2 - target) - Math.abs((b.at + b.end) / 2 - target))[0];
    marks.push({ at: best.at, end: best.end, w, i, fitted: true });
  }
  marks.sort((a, b) => a.at - b.at);
  const parts = [];
  let p = 0;
  for (const m of marks) { if (m.at > p) parts.push({ t: text.slice(p, m.at) }); parts.push({ t: text.slice(m.at, m.end), w: m.w, i: m.i }); p = m.end; }
  if (p < text.length) parts.push({ t: text.slice(p) });
  return { parts, leftover: words.filter((w, i) => w.key && !marks.some(m => m.i === i)) };
}
// Kept for the test from 0.10.1.
export const markKeyWords = markWords;

// Full-screen study layer over the app, slightly see-through so you keep your place. Back gesture closes it.
function screen(title, body, { onClose } = {}) {
  const close = () => {
    removeEventListener('popstate', onPop);
    if (history.state?.telmynScreen) history.back();
    root.classList.add('closing'); setTimeout(() => root.remove(), 180); onClose?.();
  };
  // Back closes only the top layer: each layer owns one history entry, so the pop belongs to the newest one.
  const onPop = () => {
    if (!root.isConnected || [...document.querySelectorAll('.vscreen:not(.closing)')].pop() !== root) return;
    removeEventListener('popstate', onPop); root.remove(); onClose?.();
  };
  const root = h('section', { class: 'vscreen', role: 'dialog', 'aria-label': title },
    h('header', { class: 'vscreen-head' }, h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, '✕'), h('h2', {}, title), h('span', { class: 'icon-btn', 'aria-hidden': 'true' })),
    h('div', { class: 'vscreen-body' }, body));
  document.body.append(root);
  history.pushState({ telmynScreen: true }, '');
  addEventListener('popstate', onPop);
  return { close, root };
}

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
    const shown = text.querySelector(`[data-i="${i}"]`)?.textContent;
    fill(def,
      h('div', { class: 'vs-def-top' },
        h('span', { class: `vs-orig${heb ? ' hebrew' : ''}`, lang: heb ? 'he' : 'grc', dir: heb ? 'rtl' : 'ltr' }, w.w),
        h('span', { class: 'vs-tr' }, w.t),
        h('span', { class: 'vs-nav' },
          h('button', { class: 'icon-btn', 'aria-label': 'Previous word', disabled: i === 0, onclick: () => define(i - 1) }, '‹'),
          h('span', { class: 'vs-count' }, `${i + 1} of ${words.length}`),
          h('button', { class: 'icon-btn', 'aria-label': 'Next word', disabled: i === words.length - 1, onclick: () => define(i + 1) }, '›'))),
      h('p', { class: 'vs-line' }, h('b', {}, 'Meaning'), w.g || '(none listed)'),
      h('p', { class: 'vs-line' }, h('b', {}, 'Literally'), w.en || '(not translated)'),
      shown && shown.toLowerCase() !== (w.en || '').toLowerCase() ? h('p', { class: 'vs-line' }, h('b', {}, version), `“${shown}”`) : null,
      w.gram ? h('p', { class: 'vs-line muted' }, w.gram === 'cond' ? 'conditional particle' : w.gram) : null);
  }

  async function load() {
    cite.textContent = `${v.ref} ${version}`;
    let d;
    try { d = await fetchVerse(v.ref, version); } catch (err) { return fill(text, h('span', { class: 'muted' }, err.message)); }
    if (!words.length) { fill(def, h('p', { class: 'muted small' }, 'No word notes for this verse yet.')); return fill(text, d.text); }
    const { parts } = markWords(d.text, words);
    fill(text, parts.map(p => p.w
      ? h('button', { class: p.w.key ? 'kw' : 'sw', 'data-i': p.i, onclick: () => define(p.i) }, p.t)
      : p.t));
    define(current >= 0 ? current : Math.max(0, words.findIndex(w => w.key)));
  }

  // The whole chapter, today's verses marked, on its own study layer.
  async function chapter() {
    const body = h('div', { class: 'ctx' }, h('p', { class: 'muted small' }, 'Loading…'));
    screen(`${r.book} ${r.ch}`, body);
    try {
      const d = await fetchVerse(`${r.book} ${r.ch}`, version);
      fill(body, h('p', { class: 'ctx-text' }, d.verses.map(x => {
        const n = verseNo(x.id);
        return h('span', { class: n >= r.from && n <= r.to ? 'ctx-today' : '' }, h('sup', {}, n), ` ${x.text} `);
      })));
      body.querySelector('.ctx-today')?.scrollIntoView({ block: 'center' });
    } catch (err) { fill(body, h('p', { class: 'muted small' }, err.message)); }
  }

  // Videos: teaching on this exact passage from any well-titled source (trusted teachers first), then
  // BibleProject's book overview and their videos on the main word. One shown; the rest behind More videos.
  const card = (x, size = '') => h('button', { class: `vs-video ${size}`, onclick: () => playVideo(`https://www.youtube.com/watch?v=${x.id}`, decode(x.title)) },
    h('span', { class: 'vb-thumb', style: x.thumb ? `background-image:url('${x.thumb}')` : '' }),
    h('span', { class: 'vs-vt' }, h('b', {}, decode(x.title)), h('small', {}, x.channel ? decode(x.channel) : 'BibleProject')));
  const watch = h('div', { class: 'vs-watch' }, h('p', { class: 'muted small' }, 'Finding videos on this passage…'));
  const topic = words.find(w => w.key && /noun/.test(w.gram || ''))?.g?.split(/[\s/,]/)[0] || null;
  Promise.all([
    fetchPassageVideos(v.ref).catch(() => []),
    fetchVideos(v.ref).catch(() => []),
    topic ? fetchVideos(v.ref, 'bibleproject', topic).catch(() => []) : [],
  ]).then(([onPassage, book, word]) => {
    const tag = (list, label) => list.map(x => ({ ...x, group: label }));
    const groups = [
      ...tag(onPassage.filter(x => x.on === 'verse'), `On ${v.ref}`),
      ...tag(onPassage.filter(x => x.on === 'chapter'), `On ${r.book} ${r.ch}`),
      ...tag(book, `${r.book}, the whole book`),
      ...tag(word, topic ? `On ${topic}` : 'More'),
    ].filter((x, i, a) => a.findIndex(y => y.id === x.id) === i);
    if (!groups.length) return fill(watch, h('p', { class: 'muted small' }, 'No videos on this passage yet.'));
    const [first, ...rest] = groups;
    const more = () => {
      const list = h('div', { class: 'vs-vlist' });
      let last = null;
      for (const x of groups) { if (x.group !== last) { list.append(h('p', { class: 'vs-label' }, x.group)); last = x.group; } list.append(card(x)); }
      screen('Videos', list);
    };
    // Lead video: what it covers sits on the picture; "More" sits on its title row. No extra rows.
    const hero = card(first, 'hero');
    hero.querySelector('.vb-thumb').append(h('span', { class: 'vs-badge' }, first.group));
    fill(watch, hero);
    if (rest.length) hero.querySelector('.vs-vt').append(h('span', { class: 'vs-morelink', role: 'button', tabindex: 0,
      onclick: e => { e.stopPropagation(); more(); } }, `More videos (${rest.length}) ›`));
  });

  listVersions().then(list => {
    if (!list.some(x => x.abbr === version)) list = [{ abbr: version, name: version }, ...list];
    fill(select, list.map(x => h('option', { value: x.abbr, selected: x.abbr === version }, x.abbr)));
  });

  // Where it was applied today: saved to today's log and collected in the verse journal.
  const note = h('textarea', { class: 'vs-applied', rows: 1, onfocus: e => { e.target.rows = 3; }, onblur: e => { if (!e.target.value) e.target.rows = 1; }, 'aria-label': 'Where I applied it today', placeholder: 'Where I applied it today' }, state.day.verse_applied_notes ?? '');
  const saveBtn = h('button', { class: 'btn', onclick: async () => {
    await setField('verse_applied_notes', note.value.trim() || null);
    saveBtn.textContent = 'Saved'; setTimeout(() => { saveBtn.textContent = 'Save'; }, 1500);
  } }, 'Save');

  const body = h('div', { class: 'vs' },
    h('div', { class: 'vs-top' },
      h('span', { class: 'vs-theme' }, v.theme),
      h('span', { class: 'vs-top-r' }, h('button', { class: 'vs-chip', onclick: chapter }, `${r.book} ${r.ch} ›`), select)),
    h('blockquote', { class: 'vs-verse' }, text, cite),
    def,
    watch,
    h('div', { class: 'vs-apply' }, note, h('div', { class: 'applied-actions' }, h('button', { class: 'btn ghost', onclick: journalSheet }, 'Journal'), saveBtn)));
  screen(v.ref, body);
  // The verse keeps a large, readable size; it only shrinks (down to 17 px) if a long passage would not fit.
  // Balance the two big pieces: the verse starts large (26 px) and gives up size only until the lead video's
  // picture has a useful height (110 px). Nothing scrolls; nothing is left empty.
  const scroller = body.closest('.vscreen-body');
  const fit = () => {
    if (!scroller?.clientHeight) return;
    const hero = () => body.querySelector('.vs-video.hero');
    // On short screens the lead video is a compact row with a fixed picture, so only overflow matters there.
    const thumbH = () => (hero() && getComputedStyle(hero()).flexDirection !== 'row' ? hero().querySelector('.vb-thumb').clientHeight : 999);
    let size = 26;
    text.style.fontSize = `${size}px`;
    while ((thumbH() < 110 || scroller.scrollHeight > scroller.clientHeight + 1) && size > 18) { size -= 1; text.style.fontSize = `${size}px`; }
  };
  new ResizeObserver(fit).observe(scroller);
  new MutationObserver(() => requestAnimationFrame(fit)).observe(text, { childList: true });
  new MutationObserver(() => requestAnimationFrame(fit)).observe(watch, { childList: true });
  load();
}
