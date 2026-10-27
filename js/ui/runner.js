// Full-screen block runner. One step on screen at a time, no scrolling.
// Rests start themselves and advance when they end. Sets log reps, seconds or minutes.
import { h, chime, unlockAudio, fill } from './dom.js';
import { burst } from './fx.js';
import { state, addEvent, addSet, setField } from '../state.js';
import { now, fmtSec } from '../clock.js';

let wakeLock = null;
const lockScreen = async () => { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* optional */ } };
const unlockScreen = () => { wakeLock?.release?.(); wakeLock = null; };

export function runBlock(block, { onExit } = {}) {
  const { EXERCISES } = state.plan.program.data;
  unlockAudio();
  lockScreen();
  const steps = block.steps;
  let i = 0;
  let timer = null;            // { end, total, running, kind }
  let stopwatch = null;        // { start }
  let entry = {};              // current set input
  const startedAt = now().toISOString();
  const root = h('div', { class: 'runner', role: 'dialog', 'aria-label': block.name });
  document.body.append(root);
  addEvent('block_start', { block: block.id });

  const lastSet = ex => [...state.sets].reverse().find(s => s.exercise === ex);
  const suggestPalms = () => {
    const last = [...state.events].reverse().find(e => e.block === 'hourly' && e.palms);
    return last ? (last.palms === 'up' ? 'down' : 'up') : null;
  };

  function clearTimers() { clearInterval(timer?.int); timer = null; clearInterval(stopwatch?.int); stopwatch = null; }

  function startTimer(sec, onEnd) {
    clearTimers();
    timer = { end: now().getTime() + sec * 1000, total: sec };
    timer.int = setInterval(() => {
      const left = Math.max(0, (timer.end - now().getTime()) / 1000);
      const el = root.querySelector('.clock');
      if (el) el.textContent = fmtSec(Math.ceil(left));
      const bar = root.querySelector('.clock-fill');
      if (bar) bar.style.transform = `scaleX(${1 - left / timer.total})`;
      if (left <= 0) { clearTimers(); chime(2); onEnd?.(); }
    }, 200);
  }

  async function saveCurrent() {
    const s = steps[i];
    if (s.kind === 'set') {
      const field = { reps: 'reps', sec: 'sec', min: 'min' }[s.log];
      const val = entry.value;
      if (val !== undefined && val !== null && val !== '') {
        await addSet({ block: block.id, exercise: s.exercise, set_no: s.set_no || 1, side: s.side || null, [field]: Number(val), mode: entry.mode || (s.modes ? 'full' : null) });
        if (s.logField) await setField(s.logField, Number(val));
      }
    }
    if (s.choice === 'palms') entry.palmsSaved = entry.mode;
  }

  async function next() {
    await saveCurrent();
    const keepPalms = entry.palmsSaved ?? entry.palms;
    clearTimers();
    entry = { palms: keepPalms };
    if (i < steps.length - 1) { i++; render(); } else finish('block_done');
  }

  async function finish(type) {
    clearTimers();
    unlockScreen();
    await addEvent(type, { block: block.id, started_at: startedAt, done_at: now().toISOString(), palms: entry.palms || null });
    if (type === 'block_done') burst(innerWidth / 2, innerHeight * 0.45);
    root.classList.add('closing');
    setTimeout(() => { root.remove(); onExit?.(); }, 200);
  }

  function back() { clearTimers(); entry = { palms: entry.palms }; if (i > 0) { i--; render(); } }

  function closeMenu() {
    const menu = h('div', { class: 'runner-menu' },
      h('p', {}, 'Leave this block?'),
      h('button', { class: 'btn', onclick: () => finish('block_partial') }, 'Mark partial'),
      h('button', { class: 'btn ghost', onclick: () => finish('block_skip') }, 'Mark skipped'),
      h('button', { class: 'btn ghost', onclick: () => menu.remove() }, 'Keep going'));
    root.append(menu);
  }

  function videoLinks(s) {
    const ex = EXERCISES[s.exercise] || (i === 0 && block.video ? EXERCISES[block.video] : null);
    if (!ex?.video) return null;
    return h('div', { class: 'links' },
      h('a', { href: ex.video, target: '_blank', rel: 'noopener' }, 'Watch'),
      ex.alt ? h('a', { href: ex.alt.video, target: '_blank', rel: 'noopener' }, ex.alt.label) : null);
  }

  function stepper(s) {
    const prev = lastSet(s.exercise);
    const field = { reps: 'reps', sec: 'sec', min: 'min' }[s.log];
    const unit = { reps: 'reps', sec: 'sec', min: 'min' }[s.log];
    const input = h('input', { class: 'num', type: 'number', inputmode: 'decimal', min: 0, placeholder: prev?.[field] ?? '', 'aria-label': unit,
      value: entry.value ?? '', oninput: e => { entry.value = e.target.value; } });
    const bump = d => () => { const cur = Number(input.value || input.placeholder || 0); input.value = Math.max(0, cur + d); entry.value = input.value; };
    const kids = [h('div', { class: 'stepper' },
      h('button', { class: 'round', 'aria-label': 'Less', onclick: bump(-1) }, '−'),
      h('label', {}, input, h('span', {}, unit)),
      h('button', { class: 'round', 'aria-label': 'More', onclick: bump(1) }, '+'))];
    if (s.log === 'sec') {
      kids.push(h('button', { class: 'btn ghost', onclick: e => {
        if (stopwatch) { clearTimers(); e.target.textContent = 'Start stopwatch'; return; }
        const start = now().getTime();
        e.target.textContent = 'Stop';
        stopwatch = { int: setInterval(() => { const sec = Math.floor((now().getTime() - start) / 1000); input.value = sec; entry.value = sec; }, 200) };
      } }, 'Start stopwatch'));
    }
    if (s.modes) {
      entry.mode ||= 'full';
      kids.push(h('div', { class: 'seg' }, s.modes.map(m => h('button', { class: entry.mode === m ? 'on' : '', onclick: () => { entry.mode = m; render(); } }, m === 'full' ? 'Full range' : 'Negatives'))));
    }
    if (prev) kids.push(h('p', { class: 'muted small' }, `Last: ${prev[field]} ${unit}`));
    return h('div', { class: 'log' }, kids);
  }

  function render() {
    const s = steps[i];
    const lanes = h('div', { class: 'lanes', 'aria-hidden': 'true' }, steps.map((_, k) => h('span', { class: k < i ? 'done' : k === i ? 'now' : '' })));
    let body = [];

    if (s.kind === 'rest' || s.kind === 'timed') {
      body.push(h('div', { class: 'clock-wrap' }, h('div', { class: 'clock' }, fmtSec(s.sec)), h('div', { class: 'clock-bar' }, h('div', { class: 'clock-fill' }))));
    }
    if (s.kind === 'set') body.push(stepper(s));
    if (s.choice === 'palms') {
      const sug = suggestPalms();
      entry.mode ||= entry.palms || sug || null;
      body.push(h('div', { class: 'seg big' }, s.options.map(o => h('button', { class: entry.mode === o ? 'on' : '', onclick: () => { entry.mode = o; entry.palms = o; render(); } }, `Palms ${o}`))));
      if (sug) body.push(h('p', { class: 'muted small' }, `Alternating: palms ${sug} this time.`));
    }

    const primary = s.kind === 'rest'
      ? h('button', { class: 'btn', onclick: next }, 'Skip rest')
      : s.kind === 'timed' && !timer
        ? h('button', { class: 'btn', onclick: () => { startTimer(s.sec, () => root.querySelector('.next-btn')?.classList.add('pulse')); render(); } }, 'Start')
        : h('button', { class: 'btn next-btn', onclick: next }, i === steps.length - 1 ? 'Finish block' : (s.kind === 'set' ? 'Save and next' : 'Done'));

    fill(root, 
      h('header', { class: 'runner-head' },
        h('button', { class: 'icon-btn', 'aria-label': 'Leave block', onclick: closeMenu }, '✕'),
        h('span', { class: 'runner-title' }, block.name),
        h('span', { class: 'runner-count' }, `${i + 1} of ${steps.length}`)),
      lanes,
      h('main', { class: 'runner-main' },
        h('p', { class: `step-kind ${s.kind}` }, s.kind === 'rest' ? 'Rest' : s.kind === 'set' ? 'Set' : s.kind === 'timed' ? 'Hold' : 'Do'),
        h('h1', { class: 'step-text' }, s.text),
        s.note || (i === 0 && block.note) ? h('p', { class: 'step-note' }, s.note || block.note) : null,
        EXERCISES[s.exercise]?.cue ? h('p', { class: 'step-note' }, EXERCISES[s.exercise].cue) : null,
        videoLinks(s),
        ...body),
      h('footer', { class: 'runner-foot' },
        h('button', { class: 'btn ghost', onclick: back, disabled: i === 0 }, 'Back'),
        primary));

    if (s.kind === 'rest' && !timer) startTimer(s.sec, next);
    if (timer) { // repaint running clock immediately
      const left = Math.max(0, (timer.end - now().getTime()) / 1000);
      root.querySelector('.clock') && (root.querySelector('.clock').textContent = fmtSec(Math.ceil(left)));
    }
  }

  render();
}
