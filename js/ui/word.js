// The word page: everything about one Greek or Hebrew word, opened from the word card in verse study. The top stays
// put (the word, how it sounds, its short meaning, how often it appears); four tabs share the space below and each
// scrolls inside itself: Meaning (all senses, the lexicon, Strong's), Grammar (this verse's form in plain words),
// Family (its root and related words, each opening its own page), and Verses (where it appears; tap one to read it
// here). Nothing opens another site. Data: data/words/<id>.json, built by tools/lexicon.py.
import { h, fill, layer } from './dom.js';
import { wordEntry, fetchVerse, getVersion } from '../scripture.js';
import { plainGrammar, readableRef, inPassage } from '../grammar.js';

const isHeb = id => id[0] === 'H';
const orig = (w, id, cls = '') => h('span', { class: `vs-orig${isHeb(id) ? ' hebrew' : ''} ${cls}`, lang: isHeb(id) ? 'he' : 'grc', dir: isHeb(id) ? 'rtl' : 'ltr' }, w);

// id: STEPBible number (G3107, H0835). opts: gram (this verse's parsing, when the page is for the verse's own word),
// here (the passage, marked in Verses), greek ({ w, t } when this is the Hebrew behind a Greek word).
export async function wordPage(id, opts = {}) {
  const body = h('div', { class: 'wp' }, h('p', { class: 'muted small' }, 'Loading…'));
  layer('Word study', body, { cls: 'word-page' });
  let e;
  try { e = await wordEntry(id); } catch { return fill(body, h('p', { class: 'muted small' }, 'Could not load this word. Check the connection and try again.')); }
  const g = opts.gram ? plainGrammar(opts.gram) : null;
  const tabs = [['meaning', 'Meaning'], g ? ['grammar', 'Grammar'] : null, e.family?.length ? ['family', 'Family'] : null, e.refs?.length ? ['verses', 'Verses'] : null].filter(Boolean);
  let tab = 'meaning';
  const panel = h('div', { class: 'wp-panel', role: 'tabpanel' });
  const seg = h('div', { class: 'seg wp-tabs', role: 'tablist' });
  const show = t => {
    tab = t;
    fill(seg, tabs.map(([k, label]) => h('button', { class: tab === k ? 'on' : '', role: 'tab', 'aria-selected': tab === k, onclick: () => show(k) }, label)));
    fill(panel, ({ meaning, grammar, family, verses })[t]());
    panel.scrollTop = 0;
    if (t === 'family') fillFamily();
  };

  function meaning() {
    const st = e.strongs || {};
    return [
      e.senses?.length ? h('section', {}, h('p', { class: 'lbl' }, 'Senses'),
        // Indented by level, no numbers (the lexicon's own 1a, 1b1 labels read as noise); a stem name on its own,
        // like "(Piel)", heads the senses under it.
        h('div', { class: 'wp-senses' }, e.senses.map(([d, t]) => h('p', { class: `d${d}${/^\(\w+\)$/.test(t) ? ' stem' : ''}` }, t)))) : null,
      e.lex ? h('section', {}, h('p', { class: 'lbl' }, 'Lexicon (Abbott-Smith)'), e.lex.split('\n').map(l => h('p', { class: 'wp-lex' }, l))) : null,
      st.def || st.kjv ? h('section', {}, h('p', { class: 'lbl' }, `Strong's ${st.id}`),
        st.def ? h('p', {}, st.def) : null,
        st.kjv ? h('p', { class: 'wp-kv' }, h('b', {}, 'KJV renders it'), st.kjv) : null,
        st.from ? h('p', { class: 'wp-kv' }, h('b', {}, 'Origin'), st.from) : null) : null,
      h('p', { class: 'wp-credit' }, "STEPBible.org (Tyndale House), CC BY 4.0. Strong's (1894) via Open Scriptures."),
    ];
  }
  function grammar() {
    return [
      h('p', { class: 'wp-kind' }, g.kind ? `${g.kind[0].toUpperCase()}${g.kind.slice(1)}` : 'Word', ' in this verse'),
      h('div', { class: 'wp-gram' }, g.lines.map(([k, v]) => h('p', { class: 'wp-kv' }, h('b', {}, k), v))),
      h('p', { class: 'wp-credit' }, `As tagged: ${opts.gram}`),
    ];
  }
  function family() {
    return [
      h('p', { class: 'muted small' }, e.root ? 'Its root first, then words built from the same root.' : 'Words built from this one.'),
      h('div', { class: 'wp-list' }, e.family.map(f => h('button', { class: 'wp-fam', onclick: () => wordPage(f) },
        h('span', { class: 'wp-fam-w' }, f === e.root ? h('span', { class: 'wp-tag' }, 'Root') : null, h('b', { class: 'wp-fam-t' }, '…')),
        h('span', { class: 'wp-fam-n' }, '›')))),
    ];
  }
  // Family rows fill in as their pages load (each is a small file, cached after the first time).
  async function fillFamily() {
    const btns = [...panel.querySelectorAll('.wp-fam')];
    for (const [i, btn] of btns.entries()) {
      const f = e.family[i];
      const x = await wordEntry(f).catch(() => null);
      if (!x || !btn.isConnected) continue;
      fill(btn.querySelector('.wp-fam-w'), f === e.root ? h('span', { class: 'wp-tag' }, 'Root') : null, orig(x.w, f, 'small'), h('span', { class: 'vs-tr' }, x.t), h('span', { class: 'wp-fam-g' }, x.g));
      btn.querySelector('.wp-fam-n').textContent = `${x.n || 0} ›`;
    }
  }
  function verses() {
    const total = e.n || e.refs.length;
    return [
      h('p', { class: 'muted small' }, total > e.refs.length ? `${e.refs.length} of ${total} verses, spread across the Bible. Tap one to read it.` : `${total} ${total === 1 ? 'verse' : 'verses'}. Tap one to read it.`),
      h('div', { class: 'wp-list' }, e.refs.map(r => {
        const here = opts.here && inPassage(r, opts.here);
        const text = h('p', { class: 'wp-vtext' });
        const row = h('details', { class: `wp-ref${here ? ' here' : ''}`, ontoggle: async () => {
          if (!row.open || text.dataset.done) return;
          text.textContent = 'Loading…';
          const version = await getVersion();
          try { const d = await fetchVerse(readableRef(r), version); text.textContent = d.text; text.dataset.done = '1'; text.dir = /HHH|WLC/.test(version) ? 'rtl' : 'ltr'; }
          catch (err) { text.textContent = err.message; }
        } }, h('summary', {}, readableRef(r), here ? h('span', { class: 'wp-tag' }, 'This verse') : null), text);
        return row;
      })),
    ];
  }

  fill(body,
    h('header', { class: 'wp-head' },
      h('div', { class: 'wp-word' }, orig(e.w, id), h('span', { class: 'vs-tr' }, e.t)),
      h('p', { class: 'wp-gloss' }, e.g),
      h('p', { class: 'wp-meta' }, `${isHeb(id) ? 'Hebrew' : 'Greek'} · Strong's ${e.strongs?.id || id} · in ${e.n || 0} ${e.n === 1 ? 'verse' : 'verses'}`),
      opts.greek ? h('p', { class: 'wp-meta' }, 'Stands for ', h('span', { lang: 'grc' }, opts.greek.w), ` ${opts.greek.t} in the Septuagint`) : null),
    seg, panel);
  show('meaning');
}
