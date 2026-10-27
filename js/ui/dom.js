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
export function chime(times = 1) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * 0.28;
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.26);
    }
  } catch { /* sound is optional */ }
  navigator.vibrate?.(200);
}
export const unlockAudio = () => { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); };
