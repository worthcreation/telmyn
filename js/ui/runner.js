// Full-screen block runner. One step on screen at a time, no scrolling.
// Flow: tap Start once and every timed step chains into the next. Each timed step gets a short
// transition countdown first (0, 5 or 10 sec), ticks at 3-2-1, a held tone as it starts, and a
// double beep when it ends. Rests run and advance by themselves. Steps counted in reps wait for Done.
import { h, chime, sounds, unlockAudio, fill, toast, homeButton } from './dom.js';
import * as db from '../db.js';
import { burst } from './fx.js';
import { state, addEvent, addSet, setField } from '../state.js';
import { now, fmtSec, weekday, WEEKDAYS } from '../clock.js';
import { transitionSec } from '../flow.js';
import { hourlyHistory, nextPalms } from '../hourly.js';
import { studyPlayer } from './study-player.js';
import { DAILY_VIDEO, VOICE_STOP } from '../config.js';
import { runVideoBlock } from './video-block.js';
import { listen, quiet, ready, voiceSupported, onDenied } from '../listen.js';
import { watchButton, exitLandscape } from './media.js';

let wakeLock = null;
const lockScreen = async () => { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* optional */ } };
const unlockScreen = () => { wakeLock?.release?.(); wakeLock = null; };

export function runBlock(block, opts = {}) {
  // A block with a daily video is the video itself; the steps are only the fallback.
  if (DAILY_VIDEO[block.id] && !opts.steps) return runVideoBlock(block, DAILY_VIDEO[block.id], { onExit: opts.onExit, fallback: () => runBlock(block, { ...opts, steps: true }), cooldown: () => runBlock(block, { ...opts, steps: true, cooldownOnly: true }) });
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
  // Your last session of each exercise in this block (an earlier day): what you did and at what weight.
  let lastTime = {};
  const blockEx = new Set(steps.filter(s => s.kind === 'set').map(s => s.exercise));
  db.all('sets').then(all => {
    for (const ex of blockEx) {
      const prior = all.filter(r => r.exercise === ex && r.date < state.date && (r.reps != null || r.sec != null || r.min != null));
      const date = prior.map(r => r.date).sort().pop();
      if (date) lastTime[ex] = { date, rows: prior.filter(r => r.date === date) };
    }
    if (root.isConnected) render();
  });
  // The same set (and side) from last time, or that session's last set when it had fewer.
  const lastFor = s => {
    const t = lastTime[s.exercise];
    if (!t) return null;
    const same = t.rows.filter(r => (r.side || 'each') === (s.side || 'each') || r.side === 'each' || !r.side);
    const pick = same.find(r => (r.set_no || 1) === (s.set_no || 1)) || same.sort((a, b) => (a.set_no || 1) - (b.set_no || 1)).pop();
    return pick ? { ...pick, day: WEEKDAYS[weekday(t.date)] } : null;
  };
  const resumeKey = `resume:${block.id}:${state.date}`;
  const root = h('div', { class: 'runner', role: 'dialog', 'aria-label': block.name });
  const headEl = h('header', { class: 'runner-head' }), lanesEl = h('div', { class: 'lanes', 'aria-hidden': 'true' });
  const studyEl = h('section', { class: 'study' }), mainEl = h('main', { class: 'runner-main' }), footEl = h('footer', { class: 'runner-foot' });
  // In video mode the timer has its own slot at the top (under the step tracker in portrait, centered beside the title
  // in landscape); otherwise it stays in the step. render() puts it in exactly one of the two.
  const clockEl = h('div', { class: 'runner-clock' });
  root.append(headEl, lanesEl, clockEl, studyEl, mainEl, footEl);
  let wasVideo = false;
  new MutationObserver(() => { const v = root.classList.contains('video-mode'); if (v !== wasVideo) { wasVideo = v; render(); } }).observe(root, { attributes: true, attributeFilter: ['class'] });
  // In video mode the step card stays slim; tap it to show the cue and links.
  mainEl.addEventListener('click', e => { if (!e.target.closest('button, input, a, label')) root.classList.toggle('show-detail'); });
  // Re-lay out when the study video opens or closes (video mode moves the timer into its own corner chip).
  new MutationObserver(() => render()).observe(root, { attributes: true, attributeFilter: ['class'] });
  document.body.append(root);
  // Long blocks (row, legs up) turn the study video sideways so it can be watched properly.
  const study = studyPlayer(studyEl);
  const cue = name => { study.duck(); sounds[name](); };
  // cooldownOnly: the work was done elsewhere (Fab Five's video); run just the cooldown, already counted.
  if (!opts.cooldownOnly) addEvent('block_start', { block: block.id });

  // The block counts as done once the work is finished: reaching the cooldown logs it, so leaving during
  // the cooldown (or the phone closing the app) never loses the block.
  const cooldownAt = steps.findIndex((s, k) => k > 0 && s.phase === 'Cooldown');
  let counted = !!opts.cooldownOnly;
  const logDone = () => addEvent('block_done', { block: block.id, started_at: startedAt, done_at: now().toISOString(), palms: entry.palms || entry.palmsSaved || null });

  // Android back gesture: ask before leaving instead of dropping the block silently.
  history.pushState({ ...(history.state || {}), telmynRunner: true }, '');
  // A video opened over the block pops back to the block's own entry; that is not leaving the block.
  const onPop = e => { if (!root.isConnected || e.state?.telmynRunner) return; leave(); };
  addEventListener('popstate', onPop);

  const lastSet = ex => [...state.sets].reverse().find(s => s.exercise === ex);
  const weighted = s => s.kind === 'set' && EXERCISES[s.exercise]?.weight_lb != null;
  const suggestPalms = () => nextPalms(hourlyHistory(state.day, state.events));

  function clearTimers() { clearInterval(timer?.int); timer = null; clearInterval(stopwatch?.int); stopwatch = null; quiet(); }

  // Voice stop (the mic in the top bar turns it on and off, remembered): while a timer runs, "stop" or "done" acts as
  // the main button. A hang stops and saves what you held; a hold or a rest ends and moves on.
  let voiceOn = false;
  if (VOICE_STOP) db.getMeta('voice_stop', false).then(v => { voiceOn = !!v && voiceSupported(); if (root.isConnected) render(); });
  onDenied(() => { voiceOn = false; db.setMeta('voice_stop', false); toast('Microphone not allowed', null, 'Allow it for Telmyn in the phone’s settings to use voice stop'); render(); });
  const hear = () => { if (VOICE_STOP && voiceOn) listen(() => (timer?.kind === 'countup' ? stopCountUp() : next())).catch(() => toast('Voice stop could not start', null, 'The speech model did not load')); };
  const micButton = () => VOICE_STOP && voiceSupported() ? h('button', { class: `icon-btn mic${voiceOn ? ' on' : ''}`, 'aria-pressed': String(voiceOn), 'aria-label': voiceOn ? 'Voice stop on. Say stop to end a timer.' : 'Voice stop off',
    onclick: async () => {
      voiceOn = !voiceOn; await db.setMeta('voice_stop', voiceOn); render();
      if (!voiceOn) { quiet(); return toast('Voice stop off'); }
      toast('Voice stop on', null, 'Getting the speech model ready');
      try { await ready(); toast('Voice stop on', null, 'Say “stop” while a timer runs'); if (timer && timer.kind !== 'transition') hear(); }
      catch { voiceOn = false; await db.setMeta('voice_stop', false); render(); toast('Voice stop could not start', null, 'The speech model did not load'); }
    } }, '🎙') : null;

  function startTimer(sec, kind, onEnd) {
    clearTimers();
    timer = { end: now().getTime() + sec * 1000, total: sec, kind, lastWhole: Math.ceil(sec) };
    if (kind !== 'transition') hear();   // not during "Starts in": stop there would skip the step
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
    timer = { kind: 'countup', total: hi || 60, beeped: false, topped: false };
    hear();
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
      // Target met: double beep, then keep counting. The real time is what gets saved when you drop and tap Stop.
      if (hi && sec >= hi && !timer.topped) { timer.topped = true; cue('end'); if (hint) hint.textContent = `${hi} reached. Keep going as long as you can, then tap Stop.`; }
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

  // What a set step logs: the record's field, its unit on screen, its unit in words, and the +/- step size.
  const LOG = { reps: ['reps', 'reps', 'reps', 1], sec: ['sec', 'sec', 'seconds', 1], min: ['min', 'min', 'minutes', 1], m: ['m', 'm', 'meters', 10] };

  async function saveCurrent() {
    const s = steps[i];
    if (s.kind === 'set') {
      const field = LOG[s.log][0];
      const val = entry.value;
      if (val !== undefined && val !== null && val !== '') {
        await addSet({ block: block.id, exercise: s.exercise, set_no: s.set_no || 1, side: s.side || null, [field]: Number(val), mode: entry.mode || (s.modes ? 'full' : null), lb: weighted(s) ? entry.lb : undefined });
        if (s.logField) await setField(s.logField, Number(val));
      }
    }
    if (s.choice === 'palms') entry.palmsSaved = entry.mode;
  }

  // Every stretch, hold and move you finish is logged with its time (and, for a hold, the seconds held), so a day's
  // breakdown can show what was done and when. Sets are logged as sets; rests are not logged.
  function logStep() {
    const s = steps[i];
    if (s.kind !== 'timed' && s.kind !== 'do') return;
    const held = s.kind === 'timed' ? (timer?.kind === 'hold' ? Math.round(timer.total - Math.max(0, (timer.end - now().getTime()) / 1000)) : s.sec) : null;
    addEvent('step', { block: block.id, i, text: s.text, exercise: s.exercise || null, phase: s.phase || null, sec: held });
  }

  async function advance(auto = true) {
    logStep();
    await saveCurrent();
    const keepPalms = entry.palmsSaved ?? entry.palms;
    clearTimers();
    entry = { palms: keepPalms };
    if (i < steps.length - 1) enter(i + 1, auto); else finish('block_done');
  }
  const next = () => { paused = false; return advance(true); };

  async function finish(type) {
    clearTimers();
    quiet();
    unlockScreen();
    study.destroy();
    removeEventListener('popstate', onPop);
    if (history.state?.telmynRunner) history.back();
    exitLandscape();
    // Already counted at the cooldown: finishing or leaving the cooldown adds nothing more.
    if (type || counted) await db.setMeta(resumeKey, null);
    if (!counted && type) await addEvent(type, { block: block.id, started_at: startedAt, done_at: now().toISOString(), palms: entry.palms || null });
    if (type === 'block_done') burst(innerWidth / 2, innerHeight * 0.45);
    root.classList.add('closing');
    setTimeout(() => { root.remove(); onExit?.(); }, 200);
  }

  function back() { entry = { palms: entry.palms }; if (i > 0) enter(i - 1, false); }

  // ✕ and the back gesture mean the same thing everywhere in the app: close this, record nothing.
  // Leaving mid-block remembers the step, so the block resumes there; a block already counted at its cooldown
  // simply closes (it is done). Skip lives on Today; Done comes from finishing.
  async function leave() {
    if (counted) return finish('block_done');
    if (i > 0) await db.setMeta(resumeKey, { i, at: now().toISOString() });
    finish(null);
  }
  function videoLinks(s) {
    const exKey = EXERCISES[s.exercise] ? s.exercise : (i === 0 && block.video ? block.video : null);
    const ex = exKey ? EXERCISES[exKey] : null;
    if (!ex?.video) return null;
    // Watching a demo pauses any running timer; it stays paused until you resume.
    const hooks = { onOpen: () => { if (timer && timer.kind !== 'countup') pause(); study.hold(); } };
    return h('div', { class: 'links' },
      watchButton('Watch', ex.video, hooks, ex.name, { key: exKey, query: `${ex.name} exercise form tutorial` }),
      ex.alt ? watchButton(ex.alt.label, ex.alt.video, hooks, `${ex.name}: ${ex.alt.label}`, { key: `${exKey}:alt`, query: `${ex.name} ${ex.alt.label} tutorial` }) : null);
  }

  function stepper(s) {
    const prev = lastSet(s.exercise);
    const [field, unit, , stepBy] = LOG[s.log];
    // The box starts at the last set's number as a real value, so what shows is exactly what Save keeps. (It used to be
    // a grey placeholder: tapping Save on it saved nothing, and those sets were lost.) An empty box cannot be saved;
    // a set not done is entered as 0.
    const last = lastFor(s);
    if ((entry.value === undefined || entry.value === '') && (prev?.[field] ?? last?.[field]) != null) entry.value = String(prev?.[field] ?? last[field]);
    const input = h('input', { class: 'num', type: 'number', inputmode: 'decimal', min: 0, 'aria-label': unit,
      value: entry.value ?? '', oninput: e => { entry.value = e.target.value; syncSave(s); } });
    const bump = d => () => { const cur = Number(input.value || 0); input.value = Math.max(0, cur + d); entry.value = input.value; syncSave(s); };
    const kids = [h('div', { class: 'stepper' },
      h('button', { class: 'round', 'aria-label': 'Less', onclick: bump(-stepBy) }, '−'),
      h('label', {}, input, h('span', {}, unit)),
      h('button', { class: 'round', 'aria-label': 'More', onclick: bump(stepBy) }, '+'))];
    if (s.modes) {
      entry.mode ||= 'full';
      kids.push(h('div', { class: 'seg' }, s.modes.map(m => h('button', { class: entry.mode === m ? 'on' : '', onclick: () => { entry.mode = m; render(); } }, m === 'full' ? 'Full range' : 'Negatives'))));
    }
    // Dumbbell exercises: the weight, starting where you last left it (today's last set, then your last session,
    // then the program's starting weight). 5 lb steps for the fixed dumbbells.
    if (weighted(s)) {
      entry.lb ??= prev?.lb ?? last?.lb ?? EXERCISES[s.exercise].weight_lb;
      const wt = h('b', {}, `${entry.lb} lb`);
      const nudge = d => () => { entry.lb = Math.max(0, entry.lb + d); wt.textContent = `${entry.lb} lb`; };
      kids.push(h('div', { class: 'weight-row' },
        h('button', { class: 'chip', 'aria-label': 'Lighter', onclick: nudge(-5) }, '−5'), wt,
        h('button', { class: 'chip', 'aria-label': 'Heavier', onclick: nudge(5) }, '+5')));
    }
    // What you did: the set before this one today, and this set last time.
    const did = (r, label) => r?.[field] != null ? h('p', { class: 'muted small' }, `${label}: ${r[field]} ${unit}${r.lb != null ? ` at ${r.lb} lb` : ''}${r.mode === 'negative' ? ', negatives' : ''}`) : null;
    kids.push(h('div', { class: 'did' }, did(prev, 'Last set'), did(last, `Last time, ${last?.day || ''}`)));
    return h('div', { class: 'log' }, kids);
  }

  // A set step's Save stays off until there is a number, and says what it needs. Updated in place while typing so
  // the keyboard stays up.
  function syncSave(s) {
    const btn = footEl.querySelector('.next-btn');
    if (!btn || s.kind !== 'set') return;
    const empty = entry.value === undefined || entry.value === null || entry.value === '';
    const unit = LOG[s.log][2];
    btn.disabled = empty;
    btn.textContent = empty ? `Enter ${unit}` : (i === steps.length - 1 ? 'Finish block' : 'Save and next');
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
          ? (lo && lo !== hi ? `One beep at ${lo} sec, double beep at ${hi}. It keeps counting; tap Stop when you drop.` : `Double beep at ${hi} sec. It keeps counting; tap Stop when you drop.`)
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
      h('button', { class: 'icon-btn', 'aria-label': 'Leave block', onclick: leave }, '✕'),
      h('span', { class: 'runner-title' }, block.name),
      h('span', { class: 'runner-count' }, `${i + 1} of ${steps.length}`),
      micButton(),
      homeButton(leave));
    fill(mainEl,
      h('p', { class: `step-kind ${inTransition ? 'upnext' : s.kind}` }, inTransition ? 'Next' : (s.phase || { rest: 'Rest', set: 'Set', timed: 'Hold', do: 'Do' }[s.kind])),
      h('h1', { class: `step-text${s.text.length > 26 ? ' long' : ''}` }, s.text),
      s.note || (i === 0 && block.note) ? h('p', { class: 'step-note' }, s.note || block.note) : null,
      (s.cue || EXERCISES[s.exercise]?.cue) ? h('p', { class: 'step-cue' }, s.cue || EXERCISES[s.exercise].cue) : null,
      videoLinks(s),
      ...body);
    fill(footEl, secondary, primary);
    if (s.kind === 'set' && !counting && !inTransition) syncSave(s);
    const cw = mainEl.querySelector('.clock-wrap');
    if (root.classList.contains('video-mode') && cw) fill(clockEl, cw); else fill(clockEl);
    // Study video starts with the first timer and then keeps playing; only you pause it (tap the video).
    if (running) study.play();
  }

  // Pick up where this block was left earlier today.
  if (opts.cooldownOnly && cooldownAt > 0) enter(cooldownAt, true);
  else db.getMeta(resumeKey).then(r => {
    if (r && r.i > 0 && r.i < steps.length) { enter(r.i, false); toast(`Resumed at step ${r.i + 1} of ${steps.length}`); }
    else enter(0, true);
  });
}
