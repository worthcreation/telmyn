// Full-screen block runner. One step on screen at a time, no scrolling.
// Flow: tap Start once and every timed step chains into the next. Each timed step gets a short
// transition countdown first (0, 5 or 10 sec), ticks at 3-2-1, a held tone as it starts, and a
// double beep when it ends. Rests run and advance by themselves. Steps counted in reps wait for Done.
import { h, chime, sounds, unlockAudio, fill } from './dom.js';
import { burst } from './fx.js';
import { state, addEvent, addSet, setField } from '../state.js';
import { now, fmtSec } from '../clock.js';
import { transitionSec } from '../flow.js';
import { hourlyHistory, nextPalms } from '../hourly.js';
import { studyPlayer } from './study-player.js';
import { DAILY_VIDEO } from '../config.js';
import { runVideoBlock } from './video-block.js';
import { watchButton, exitLandscape } from './media.js';

let wakeLock = null;
const lockScreen = async () => { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* optional */ } };
const unlockScreen = () => { wakeLock?.release?.(); wakeLock = null; };

export function runBlock(block, opts = {}) {
  // A block with a daily video is the video itself; the steps are only the fallback.
  if (DAILY_VIDEO[block.id] && !opts.steps) return runVideoBlock(block, DAILY_VIDEO[block.id], { onExit: opts.onExit, fallback: () => runBlock(block, { ...opts, steps: true }) });
  const { onExit } = opts;
  const { EXERCISES } = state.plan.program.data;
  unlockAudio();
  lockScreen();
  const steps = block.steps;
  let i = 0;
  let timer = null;            // { end, total, int, kind: 'hold' | 'rest' | 'transition' }
  let stopwatch = null;        // { int }
  let paused = false;          // when paused, nothing starts by itself
  let entry = {};              // current set input
  const startedAt = now().toISOString();
  const root = h('div', { class: 'runner', role: 'dialog', 'aria-label': block.name });
  const headEl = h('header', { class: 'runner-head' }), lanesEl = h('div', { class: 'lanes', 'aria-hidden': 'true' });
  const studyEl = h('section', { class: 'study' }), mainEl = h('main', { class: 'runner-main' }), footEl = h('footer', { class: 'runner-foot' });
  const timerEl = h('div', { class: 'timer-chip' });
  root.append(headEl, lanesEl, studyEl, mainEl, footEl, timerEl);
  // In video mode the step card stays slim; tap it to show the cue and links.
  mainEl.addEventListener('click', e => { if (!e.target.closest('button, input, a, label')) root.classList.toggle('show-detail'); });
  // Re-lay out when the study video opens or closes (video mode moves the timer into its own corner chip).
  new MutationObserver(() => render()).observe(root, { attributes: true, attributeFilter: ['class'] });
  document.body.append(root);
  // Long blocks (row, legs up) turn the study video sideways so it can be watched properly.
  const study = studyPlayer(studyEl, { landscape: (block.minutes || 0) >= 15 });
  const cue = name => { study.duck(); sounds[name](); };
  addEvent('block_start', { block: block.id });

  // The block counts as done once the work is finished: reaching the cooldown logs it, so leaving during
  // the cooldown (or the phone closing the app) never loses the block.
  const cooldownAt = steps.findIndex((s, k) => k > 0 && s.phase === 'Cooldown');
  let counted = false;
  const logDone = () => addEvent('block_done', { block: block.id, started_at: startedAt, done_at: now().toISOString(), palms: entry.palms || entry.palmsSaved || null });

  // Android back gesture: ask before leaving instead of dropping the block silently.
  history.pushState({ telmynRunner: true }, '');
  // A video opened over the block pops back to the block's own entry; that is not leaving the block.
  const onPop = e => { if (!root.isConnected || e.state?.telmynRunner) return; history.pushState({ telmynRunner: true }, ''); closeMenu(); };
  addEventListener('popstate', onPop);

  const lastSet = ex => [...state.sets].reverse().find(s => s.exercise === ex);
  const suggestPalms = () => nextPalms(hourlyHistory(state.day, state.events));

  function clearTimers() { clearInterval(timer?.int); timer = null; clearInterval(stopwatch?.int); stopwatch = null; }

  function startTimer(sec, kind, onEnd) {
    clearTimers();
    timer = { end: now().getTime() + sec * 1000, total: sec, kind, lastWhole: Math.ceil(sec) };
    timer.int = setInterval(() => {
      const left = Math.max(0, (timer.end - now().getTime()) / 1000);
      const whole = Math.ceil(left);
      const el = root.querySelector('.clock');
      if (el) el.textContent = fmtSec(whole);
      const bar = root.querySelector('.clock-fill');
      if (bar) bar.style.transform = `scaleX(${1 - left / timer.total})`;
      if (whole !== timer.lastWhole) {
        timer.lastWhole = whole;
        if (kind !== 'hold' && whole >= 1 && whole <= 3) cue('tick');
      }
      if (left <= 0) { clearTimers(); onEnd?.(); }
    }, 100);
  }

  function runHold(s) {
    cue('go');
    startTimer(s.sec, 'hold', () => { cue('end'); advance(true); });
    render();
  }

  // Timed sets (hangs): count up on a big clock. One beep = minimum reached (keep going or drop).
  // Double beep = top of the range: it stops and saves by itself. Stop saves whatever you held.
  const isTimedSet = s => s.kind === 'set' && s.log === 'sec';
  const rangeOf = s => s.range || (s.sec ? [s.sec, s.sec] : [null, null]);
  function runCountUp(s) {
    clearTimers();
    cue('go');
    const [lo, hi] = rangeOf(s);
    const start = now().getTime();
    timer = { kind: 'countup', total: hi || 60, beeped: false };
    entry.value = 0;
    timer.int = setInterval(() => {
      const sec = Math.floor((now().getTime() - start) / 1000);
      entry.value = sec;
      const el = root.querySelector('.clock');
      if (el) el.textContent = fmtSec(sec);
      const bar = root.querySelector('.clock-fill');
      if (bar) bar.style.transform = `scaleX(${Math.min(1, sec / timer.total)})`;
      const hint = root.querySelector('.countup-hint');
      if (lo && lo !== hi && sec >= lo && !timer.beeped) { timer.beeped = true; cue('tick'); cue('tick'); if (hint) hint.textContent = `Minimum reached. Hold to ${hi} or drop and tap Stop.`; }
      if (hi && sec >= hi) { clearTimers(); entry.value = hi; cue('end'); advance(true); }
    }, 100);
    render();
  }
  function stopCountUp() { clearTimers(); cue('end'); advance(true); }
  const startStep = s => (isTimedSet(s) ? runCountUp(s) : runHold(s));

  function runRest(s) {
    startTimer(s.sec, 'rest', () => { cue('end'); advance(true); });
    render();
  }

  // Show step k. auto = arrived by flow (may start by itself); false = arrived by Back.
  function enter(k, auto) {
    clearTimers();
    i = k;
    const s = steps[i];
    if (i === cooldownAt && !counted) { counted = true; logDone(); }
    if (s.kind === 'rest' && !paused) return runRest(s);
    if ((s.kind === 'timed' || isTimedSet(s)) && auto && !paused) {
      const t = transitionSec(steps[i - 1], s);
      if (t === 0) return startStep(s);
      startTimer(t, 'transition', () => startStep(s));
    }
    render();
  }

  function pause() { clearTimers(); paused = true; render(); }
  function resume() {
    paused = false;
    const s = steps[i];
    if (s.kind === 'rest') runRest(s); else if (s.kind === 'timed' || isTimedSet(s)) startStep(s);
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

  async function advance(auto = true) {
    await saveCurrent();
    const keepPalms = entry.palmsSaved ?? entry.palms;
    clearTimers();
    entry = { palms: keepPalms };
    if (i < steps.length - 1) enter(i + 1, auto); else finish('block_done');
  }
  const next = () => { paused = false; return advance(true); };

  async function finish(type) {
    clearTimers();
    unlockScreen();
    study.destroy();
    removeEventListener('popstate', onPop);
    if (history.state?.telmynRunner) history.back();
    exitLandscape();
    // Already counted at the cooldown: finishing or leaving the cooldown adds nothing more.
    if (!counted) await addEvent(type, { block: block.id, started_at: startedAt, done_at: now().toISOString(), palms: entry.palms || null });
    if (type === 'block_done') burst(innerWidth / 2, innerHeight * 0.45);
    root.classList.add('closing');
    setTimeout(() => { root.remove(); onExit?.(); }, 200);
  }

  function back() { entry = { palms: entry.palms }; if (i > 0) enter(i - 1, false); }

  function closeMenu() {
    if (root.querySelector('.runner-menu')) return;
    const menu = counted
      ? h('div', { class: 'runner-menu' },
        h('p', {}, 'Block is logged as done. Leave the cooldown?'),
        h('button', { class: 'btn', onclick: () => finish('block_done') }, 'Leave'),
        h('button', { class: 'btn ghost', onclick: () => menu.remove() }, 'Keep going'))
      : h('div', { class: 'runner-menu' },
      h('p', {}, 'Leave this block?'),
      h('button', { class: 'btn', onclick: () => finish('block_partial') }, 'Mark partial'),
      h('button', { class: 'btn ghost', onclick: () => finish('block_skip') }, 'Mark skipped'),
      h('button', { class: 'btn ghost', onclick: () => menu.remove() }, 'Keep going'));
    root.append(menu);
  }

  function videoLinks(s) {
    const ex = EXERCISES[s.exercise] || (i === 0 && block.video ? EXERCISES[block.video] : null);
    if (!ex?.video) return null;
    // Watching a demo pauses any running timer; it stays paused until you resume.
    const hooks = { onOpen: () => { if (timer && timer.kind !== 'countup') pause(); study.hold(); } };
    return h('div', { class: 'links' },
      watchButton('Watch', ex.video, hooks, ex.name),
      ex.alt ? watchButton(ex.alt.label, ex.alt.video, hooks, `${ex.name}: ${ex.alt.label}`) : null);
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
    if (s.modes) {
      entry.mode ||= 'full';
      kids.push(h('div', { class: 'seg' }, s.modes.map(m => h('button', { class: entry.mode === m ? 'on' : '', onclick: () => { entry.mode = m; render(); } }, m === 'full' ? 'Full range' : 'Negatives'))));
    }
    if (prev) kids.push(h('p', { class: 'muted small' }, `Last: ${prev[field]} ${unit}`));
    return h('div', { class: 'log' }, kids);
  }

  function render() {
    const s = steps[i];
    fill(lanesEl, steps.map((_, k) => h('span', { class: k < i ? 'done' : k === i ? 'now' : '' })));
    let body = [];

    const inTransition = timer?.kind === 'transition';
    const counting = timer?.kind === 'countup';
    if (isTimedSet(s) && !inTransition) {
      const [lo, hi] = rangeOf(s);
      body.push(h('div', { class: 'clock-wrap' },
        h('p', { class: 'countup-hint' }, counting
          ? (lo && lo !== hi ? `One beep at ${lo} sec: minimum reached. Double beep at ${hi}: done, it saves itself.` : `Double beep at ${hi} sec: done, it saves itself.`)
          : (entry.value ? 'Saved time below. Adjust if needed, or start again.' : 'Get on the bar, then tap Start. It counts up.')),
        h('div', { class: 'clock' }, fmtSec(Number(entry.value) || 0)), h('div', { class: 'clock-bar' }, h('div', { class: 'clock-fill' }))));
    }
    if (s.kind === 'rest' || s.kind === 'timed' || (isTimedSet(s) && inTransition)) {
      const shown = timer ? Math.ceil(Math.max(0, (timer.end - now().getTime()) / 1000)) : s.sec;
      body.push(h('div', { class: `clock-wrap${inTransition ? ' getready' : ''}` },
        inTransition ? h('p', { class: 'getready-label' }, 'Starts in') : null,
        h('div', { class: 'clock' }, fmtSec(shown)), h('div', { class: 'clock-bar' }, h('div', { class: 'clock-fill' }))));
    }
    if (s.kind === 'set' && !counting && !(isTimedSet(s) && inTransition)) body.push(stepper(s));
    if (s.choice === 'palms') {
      const sug = suggestPalms();
      entry.mode ||= entry.palms || sug || null;
      body.push(h('div', { class: 'seg big' }, s.options.map(o => h('button', { class: entry.mode === o ? 'on' : '', onclick: () => { entry.mode = o; entry.palms = o; render(); } }, `Palms ${o}`))));
      if (sug) body.push(h('p', { class: 'muted small' }, `Alternating: palms ${sug} this time.`));
    }

    const running = timer && (timer.kind === 'hold' || timer.kind === 'rest' || inTransition || counting);
    const isLast = i === steps.length - 1;
    let primary;
    if (inTransition) primary = h('button', { class: 'btn', onclick: () => startStep(s) }, 'Start now');
    else if (counting) primary = h('button', { class: 'btn', onclick: stopCountUp }, 'Stop and save');
    else if (isTimedSet(s) && !entry.value) primary = h('button', { class: 'btn', onclick: () => { paused = false; runCountUp(s); } }, 'Start');
    else if (s.kind === 'rest') primary = running ? h('button', { class: 'btn', onclick: next }, 'Skip rest') : h('button', { class: 'btn', onclick: resume }, 'Resume rest');
    else if (s.kind === 'timed' && !running) primary = h('button', { class: 'btn', onclick: () => { paused = false; runHold(s); } }, paused ? 'Resume' : 'Start');
    else if (s.kind === 'timed') primary = h('button', { class: 'btn next-btn', onclick: next }, isLast ? 'Finish block' : 'Done early');
    else primary = h('button', { class: 'btn next-btn', onclick: next }, isLast ? 'Finish block' : (s.kind === 'set' ? 'Save and next' : 'Done'));
    const secondary = running
      ? h('button', { class: 'btn ghost', onclick: pause }, 'Pause')
      : h('button', { class: 'btn ghost', onclick: back, disabled: i === 0 }, 'Back');

    fill(headEl,
      h('button', { class: 'icon-btn', 'aria-label': 'Leave block', onclick: closeMenu }, '✕'),
      h('span', { class: 'runner-title' }, block.name),
      h('span', { class: 'runner-count' }, `${i + 1} of ${steps.length}`));
    fill(mainEl,
      h('p', { class: `step-kind ${inTransition ? 'upnext' : s.kind}` }, inTransition ? 'Next' : (s.phase || { rest: 'Rest', set: 'Set', timed: 'Hold', do: 'Do' }[s.kind])),
      h('h1', { class: `step-text${s.text.length > 26 ? ' long' : ''}` }, s.text),
      s.note || (i === 0 && block.note) ? h('p', { class: 'step-note' }, s.note || block.note) : null,
      (s.cue || EXERCISES[s.exercise]?.cue) ? h('p', { class: 'step-cue' }, s.cue || EXERCISES[s.exercise].cue) : null,
      videoLinks(s),
      ...body);
    fill(footEl, secondary, primary);
    const cw = mainEl.querySelector('.clock-wrap');
    if (root.classList.contains('video-mode') && cw) fill(timerEl, cw); else fill(timerEl);
    // Study video follows the timers: plays while one runs, pauses while the app waits on you.
    if (running) study.play(); else study.hold();
  }

  enter(0, true);
}
