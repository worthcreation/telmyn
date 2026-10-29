// Tiny DOM toolkit. h('button', { class: 'x', onclick }, 'Label')
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, val] of Object.entries(attrs || {})) {
    if (val === null || val === undefined || val === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), val);
    else if (k === 'class') el.className = val;
    else if (k === 'html') el.innerHTML = val;
    else el.setAttribute(k, val === true ? '' : val);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}

// Like replaceChildren, but skips null/false so conditional children never print as text.
export const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter(k => k !== null && k !== undefined && k !== false));

export const $ = (sel, root = document) => root.querySelector(sel);

// Layers: every sheet and full-screen view in the app shares one look (frosted glass over the app, so you keep your
// place) and one behavior (✕ or the back gesture closes only the top layer). Full layers cover the screen; half layers
// rise from the bottom for quick entries. Layers stay above the keyboard (--vvh tracks the visible height).
const layers = [];
let skipPops = 0;
if (typeof addEventListener === 'function') addEventListener('popstate', e => {
  if (skipPops) { skipPops--; return; }
  const keep = e.state?.telmynLayer || 0;
  while (layers.length > keep) layers[layers.length - 1].dismiss();
});
export const layerDepth = () => layers.length;

export function layer(title, body, { onClose, full = true, cls = '' } = {}) {
  const panel = h('section', { class: 'layer-panel', role: 'dialog', 'aria-label': title },
    h('header', { class: 'layer-head' }, h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => close() }, '✕'), h('h2', {}, title), h('span', { class: 'icon-btn', 'aria-hidden': 'true' })),
    h('div', { class: 'layer-body' }, body));
  const wrap = h('div', { class: `layer ${full ? 'full' : 'half'} ${cls}` }, full ? null : h('div', { class: 'layer-scrim', onclick: () => close() }), panel);
  const entry = { dismiss };
  function dismiss() {
    const i = layers.indexOf(entry);
    if (i < 0) return;
    layers.splice(i, 1);
    wrap.classList.add('closing');
    setTimeout(() => wrap.remove(), 180);
    onClose?.();
  }
  function close() {
    const top = layers[layers.length - 1] === entry;
    if (layers.indexOf(entry) < 0) return;
    dismiss();
    if (top && history.state?.telmynLayer) { skipPops++; history.back(); }
  }
  layers.push(entry);
  history.pushState({ ...(history.state || {}), telmynLayer: layers.length }, '');
  $('#sheet-root').append(wrap);
  return { close, el: wrap };
}
// Kept name: quick sheets are half layers, full sheets are full layers.
export const sheet = (title, body, { onClose, full = false } = {}) => layer(title, body, { onClose, full });

// Writing anything longer than a word: one roomy, frosted writing layer above the keyboard, used everywhere.
export function compose(title, value, { placeholder = '', onSave }) {
  const ta = h('textarea', { class: 'compose-text', placeholder, 'aria-label': title }, value ?? '');
  const l = layer(title, h('div', { class: 'compose' }, ta,
    h('div', { class: 'compose-actions' },
      h('button', { class: 'btn ghost', onclick: () => l.close() }, 'Cancel'),
      h('button', { class: 'btn', onclick: async () => { await onSave(ta.value.trim() || null); l.close(); } }, 'Save'))), { cls: 'compose-layer' });
  requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); });
  return l;
}
// A short piece of what was written, for resting fields: one whole phrase, never cut mid-word, with "…" before
// and/or after when there is more on that side. Prefers the first phrase; skips ones too short to say anything.
export function excerpt(text, max = 50) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const pieces = [...t.matchAll(/[^.,;:!?]+[.,;:!?]*/g)].map(m => ({ s: m[0].trim(), at: m.index, end: m.index + m[0].length }));
  let pick = pieces.find(p => p.s.length >= 18 && p.s.length <= max) || pieces[0];
  let s = pick.s;
  if (s.length > max) { s = s.slice(0, max); s = s.slice(0, s.lastIndexOf(' ')); }
  s = s.replace(/[,;:]$/, '');
  const before = pick.at > 0, after = pick.end < t.length || s.length < pick.s.length;
  return `${before ? '… ' : ''}${s}${after ? ' …' : ''}`;
}

// The resting form of a writing field: a piece of what's written (or the prompt); tap to read or write it in full.
export function noteField(label, value, { placeholder = '', onSave, readOnly = false } = {}) {
  const el = h('button', { class: `note-field${value ? '' : ' empty'}${readOnly ? ' readonly' : ''}`, 'aria-label': value ? `${label}: ${value}` : label },
    h('span', { class: 'nf-text' }, value ? excerpt(value) : placeholder));
  el.addEventListener('click', () => {
    if (readOnly) { if (value) layer(label, h('p', { class: 'note-read' }, value)); return; }
    compose(label, value, { placeholder, onSave: async v => { await onSave(v); value = v; el.firstChild.textContent = v ? excerpt(v) : placeholder; el.classList.toggle('empty', !v); } });
  });
  return el;
}

// The one way text is sized to fit a box. Steps the size down from max to min (defaults: the verse tokens), counting
// the box's padding, gaps and other children; if it still won't fit and clamp is on, ends the text with … .
export function fitText(box, text, { max, min, clamp = false } = {}) {
  if (!box.clientHeight) return;
  const root = getComputedStyle(document.documentElement);
  max ??= parseFloat(root.getPropertyValue('--fs-verse-max')); min ??= parseFloat(root.getPropertyValue('--fs-verse-min'));
  const cs = getComputedStyle(box);
  const others = () => [...box.children].filter(c => c !== text).reduce((a, c) => a + c.offsetHeight, 0)
    + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + (parseFloat(cs.rowGap) || 0) * (box.children.length - 1);
  text.style.webkitLineClamp = ''; text.classList.remove('clamped');
  let size = max;
  text.style.fontSize = `${size}px`;
  const over = () => text.offsetHeight + others() > box.clientHeight + 1;
  while (over() && size > min) { size -= 1; text.style.fontSize = `${size}px`; }
  if (clamp && over()) {
    const lh = parseFloat(getComputedStyle(text).lineHeight) || size * 1.5;
    text.style.webkitLineClamp = String(Math.max(1, Math.floor((box.clientHeight - others()) / lh)));
    text.classList.add('clamped');
  }
}

export function toast(msg, action = null) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const hide = () => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); };
  const t = h('div', { class: `toast${action ? ' has-action' : ''}`, role: 'status' }, h('span', {}, msg),
    action ? h('button', { class: 'toast-act', onclick: () => { hide(); action.fn(); } }, action.label) : null);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(hide, action ? 5000 : 2200);
}

let audio;
const ctx = () => (audio ||= new (window.AudioContext || window.webkitAudioContext)());

// One tone. freq in Hz, dur and delay in seconds.
export function tone(freq = 880, dur = 0.25, delay = 0, vol = 0.3) {
  try {
    const a = ctx(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime + delay;
    o.frequency.value = freq; o.type = 'sine';
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol, t + Math.max(0.03, dur - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch { /* sound is optional */ }
}

// The sound vocabulary: tick = 3-2-1 countdown, go = held tone as a timer starts, end = double beep when a timer finishes.
export const sounds = {
  tick: () => tone(660, 0.09),
  go: () => { tone(1046, 0.6); navigator.vibrate?.(150); },
  end: () => { tone(880, 0.2); tone(880, 0.2, 0.28); navigator.vibrate?.([120, 80, 120]); },
};

export function chime(times = 1) {
  for (let i = 0; i < times; i++) tone(880, 0.22, i * 0.28);
  navigator.vibrate?.(200);
}
export const unlockAudio = () => { ctx(); audio.resume?.(); };

// Press and hold (half a second) for a second action on a button; a normal tap still does the first one.
// The click that ends a hold is swallowed, so a hold never also logs.
export function holdable(el, onHold, ms = 500) {
  let timer = null, held = false;
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.classList.add('holdable');
  el.addEventListener('pointerdown', () => { held = false; cancel(); timer = setTimeout(() => { held = true; navigator.vibrate?.(15); onHold(); }, ms); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, cancel);
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('click', e => { if (held) { held = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  return el;
}
