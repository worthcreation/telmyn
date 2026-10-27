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

// Bottom sheet that slides up over the current screen.
export function sheet(title, body, { onClose, full = false } = {}) {
  const root = $('#sheet-root');
  const close = () => { wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 220); onClose?.(); };
  const wrap = h('div', { class: 'sheet-wrap' },
    h('div', { class: 'sheet-scrim', onclick: close }),
    h('section', { class: `sheet${full ? ' full' : ''}`, role: 'dialog', 'aria-label': title },
      h('header', { class: 'sheet-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, '✕')),
      h('div', { class: 'sheet-body' }, body)));
  root.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  return { close, el: wrap };
}

export function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
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
