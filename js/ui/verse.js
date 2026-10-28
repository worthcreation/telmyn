// Verse study: one screen that goes deeper than the Today card instead of repeating it.
// Every word of the verse is reachable: key words are highlighted in the text, the rest are tappable too, and the
// word panel steps through every original word in order (‹ ›). Then the chapter, one BibleProject video (more on tap),
// and where it was applied today.
// Rules carried over: verse text never italic; original-language notes show word, transliteration and meaning only.
// Everything shows inside the app; nothing opens another site.
import { h, fill, layer, noteField } from './dom.js';
import * as db from '../db.js';
import { verseFor } from '../verses.js';
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

const screen = (title, body) => layer(title, body, { cls: 'study' });

// Today's verse to study and apply, or (from the journal) a past day's verse with what was written, read-only.
export async function verseSheet(date = null) {
  if (typeof date !== 'string') date = null;   // called straight from a tap handler with the click event
  const past = date && date !== state.date;
  const v = past ? verseFor(date) : state.verse;
  const dayRec = past ? (await db.get('days', date)) || {} : state.day;
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
    // The word in its Greek (or Hebrew) order, two words each side, read literally. Shows where a word sits even
    // when the English version has no separate word for it, without guessing which English word "covers" it.
    const lo = Math.max(0, i - 2), hi = Math.min(words.length - 1, i + 2);
    const order = h('p', { class: 'vs-order' }, lo > 0 ? '… ' : '',
      words.slice(lo, hi + 1).map((x, k) => [k ? ' ' : '', lo + k === i ? h('b', {}, x.en || x.t) : h('button', { class: 'vs-order-w', onclick: () => define(lo + k) }, x.en || x.t)]).flat(),
      hi < words.length - 1 ? ' …' : '');
    fill(def,
      h('div', { class: 'vs-def-top' },
        h('span', { class: 'vs-word' },
          h('span', { class: `vs-orig${heb ? ' hebrew' : ''}`, lang: heb ? 'he' : 'grc', dir: heb ? 'rtl' : 'ltr' }, w.w),
          h('span', { class: 'vs-tr' }, w.t)),
        h('span', { class: 'vs-nav' },
          h('button', { class: 'icon-btn', 'aria-label': 'Previous word', disabled: i === 0, onclick: () => define(i - 1) }, '‹'),
          h('span', { class: 'vs-count' }, `${i + 1} of ${words.length}`),
          h('button', { class: 'icon-btn', 'aria-label': 'Next word', disabled: i === words.length - 1, onclick: () => define(i + 1) }, '›'))),
      h('p', { class: 'vs-line' }, h('b', {}, 'Meaning'), w.g || '(none listed)'),
      h('p', { class: 'vs-line' }, h('b', {}, 'Literally'), w.en || '(not translated)'),
      shown
        ? (shown.toLowerCase() !== (w.en || '').toLowerCase() ? h('p', { class: 'vs-line' }, h('b', {}, version), `“${shown}”`) : null)
        : h('p', { class: 'vs-line' }, h('b', {}, version), h('span', { class: 'vs-none' }, '(no separate word)')),
      h('p', { class: 'vs-line' }, h('b', {}, heb ? 'Hebrew order' : 'Greek order'), order),
      w.gram ? h('p', { class: 'vs-line muted' }, w.gram === 'cond' ? 'conditional particle' : w.gram) : null);
  }


  async function load() {
    cite.textContent = `${v.ref} ${version}`;
    let d;
    try { d = await fetchVerse(v.ref, version); } catch (err) { return fill(text, h('span', { class: 'muted' }, err.message)); }
    if (!words.length) { fill(def, h('p', { class: 'muted small' }, 'No word notes for this verse yet.')); return fill(text, d.text); }
    const { parts } = markWords(d.text, words);
    // Punctuation stays glued to the word before it, so a comma or period never wraps onto a line by itself.
    const out = [];
    parts.forEach((p, k) => {
      if (!p.w) { out.push(p.t); return; }
      const btn = h('button', { class: p.w.key ? 'kw' : 'sw', 'data-i': p.i, onclick: () => define(p.i) }, p.t);
      const nx = parts[k + 1];
      const m = nx && !nx.w ? nx.t.match(/^[.,;:!?”’)\]]+/) : null;
      if (m) { nx.t = nx.t.slice(m[0].length); out.push(h('span', { class: 'nw' }, btn, m[0])); } else out.push(btn);
    });
    fill(text, out);
    // Size the word panel once for its tallest word, so it never grows while you step through and the verse
    // above it never has to resize.
    def.style.minHeight = '';
    let tallest = 0;
    for (let k = 0; k < words.length; k++) { define(k); tallest = Math.max(tallest, def.offsetHeight); }
    def.style.minHeight = `${tallest}px`;
    current = -1;
    text.querySelectorAll('.on').forEach(x => x.classList.remove('on'));
    // Nothing is marked until you pick a word; the panel says how to start.
    fill(def, h('p', { class: 'vs-hint' }, `Underlined words have the ${heb ? 'Hebrew' : 'Greek'} behind them. Tap one.`),
      h('button', { class: 'vs-start', onclick: () => define(0) }, `Or step through all ${words.length} words ›`));
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
    // Lead video: no picture, just what it covers, its title and who made it, with More on the same card.
    const lead = h('button', { class: 'vs-lead', onclick: () => playVideo(`https://www.youtube.com/watch?v=${first.id}`, decode(first.title)) },
      h('span', { class: 'vs-lead-i', 'aria-hidden': 'true' }, '▶'),
      h('span', { class: 'vs-lead-t' }, h('small', {}, `${first.group} · ${decode(first.channel || 'BibleProject')}`), h('b', {}, decode(first.title))));
    fill(watch, h('div', { class: 'vs-leadrow' }, lead,
      rest.length ? h('button', { class: 'vs-morelink', onclick: more }, `More (${rest.length}) ›`) : null));
  });

  listVersions().then(list => {
    if (!list.some(x => x.abbr === version)) list = [{ abbr: version, name: version }, ...list];
    fill(select, list.map(x => h('option', { value: x.abbr, selected: x.abbr === version }, x.abbr)));
  });

  // Where it was applied: today's opens the writing layer; a past day's shows what was written.
  const prettyDay = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
  const note = noteField(past ? `Applied, ${prettyDay(date)}` : 'Where I applied it today', dayRec.verse_applied_notes ?? null, {
    placeholder: past ? 'Nothing written that day.' : 'Where I applied it today', readOnly: past,
    onSave: v2 => setField('verse_applied_notes', v2) });

  const body = h('div', { class: 'vs' },
    h('div', { class: 'vs-top' },
      h('span', { class: 'vs-theme' }, past ? `${v.theme} · ${prettyDay(date)}` : v.theme),
      h('span', { class: 'vs-top-r' }, h('button', { class: 'vs-chip', onclick: chapter }, `${r.book} ${r.ch} ›`), select)),
    h('blockquote', { class: 'vs-verse' }, text, cite),
    def,
    watch,
    h('div', { class: 'vs-apply' }, note, past ? null : h('button', { class: 'btn ghost', onclick: journalSheet }, 'Journal')));
  screen(v.ref, body);
  // The verse keeps a large, readable size; it only shrinks (down to 17 px) if a long passage would not fit.
  // The verse takes whatever room is left: type starts at 30 px and steps down (to 18) until nothing scrolls.
  const scroller = body.closest('.layer-body');
  const fit = () => {
    if (!scroller?.clientHeight) return;
    let size = 30;
    text.style.fontSize = `${size}px`;
    const box = body.querySelector('.vs-verse');
    const cs = getComputedStyle(box);
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.rowGap || 0);
    // Room the verse needs: its text, the citation and the box's padding, measured directly.
    const over = () => scroller.scrollHeight > scroller.clientHeight + 1 || text.offsetHeight + cite.offsetHeight + pad > box.clientHeight;
    while (over() && size > 18) { size -= 1; text.style.fontSize = `${size}px`; }
  };
  new ResizeObserver(fit).observe(scroller);
  // Refit once the serif font has loaded: it sets taller than the fallback, which clipped the citation.
  document.fonts?.ready.then(() => requestAnimationFrame(fit));
  new MutationObserver(() => requestAnimationFrame(fit)).observe(text, { childList: true });
  new MutationObserver(() => requestAnimationFrame(fit)).observe(watch, { childList: true });
  load();
}
