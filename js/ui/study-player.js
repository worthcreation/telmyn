// Study while you train: a video on today's verse, its chapter to read, or the chapter read aloud, inside a block.
// It starts with the first timer and keeps playing through reps, logging and pauses; only you pause it.
// Beeps duck the video volume for a moment so alerts are always heard. Your own pause or play always wins.
import { utterance } from '../voice.js';
import { h, fill, layer, toast } from './dom.js';
import { state } from '../state.js';
import { fetchDaily, studyVideos, fetchVerse, getVersion, getFavs, toggleFav, recordWatched, fmtDuration } from '../scripture.js';
import { exitLandscape } from './media.js';

let apiReady;
// YouTube player settings shared by every video in the app.
export const ytHost = 'https://www.youtube-nocookie.com';
export const ytVars = extra => ({ playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin, ...extra });

export function loadApi() {
  if (window.YT?.Player) return Promise.resolve();
  apiReady ||= new Promise(resolve => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    document.head.append(h('script', { src: 'https://www.youtube.com/iframe_api' }));
  });
  return apiReady;
}

const decode = t => { const e = document.createElement('textarea'); e.innerHTML = t; return e.value; };

// Study while you train: watch a video on today's verse, read its chapter, or listen to it read aloud.
// Started by the first timer, then left alone: your own pause or play is the only thing that stops or starts it,
// apart from opening an exercise demo, which pauses it so two videos never play at once.
// Overlay is minimal: one "Study" button (top right) opens the choices; the video always shows whole.
export function studyPlayer(container, { daily = null } = {}) {
  let mode = null, player = null, video = null, list = [], index = 0, armed = false, ours = false, playing = false, duckTimer = null;
  let speech = null, readText = null, watchedTimer = null;

  const runner = () => container.closest('.runner');
  const stop = () => {
    exitLandscape(); clearTimeout(watchedTimer);
    player?.destroy?.(); player = null;
    if (speech) { speechSynthesis.cancel(); speech = null; }
    armed = false; playing = false; mode = null;
    runner()?.classList.remove('video-mode', 'read-mode');
    drawBar();
  };

  function drawBar() {
    if (!video && !daily) return fill(container);
    container.className = 'study collapsed';
    const sub = daily ? decode(video?.title || '') : list.length ? `Watch ${list.length} video${list.length === 1 ? '' : 's'}, read or listen` : 'Read or listen';
    fill(container, h('button', { class: `study-bar${daily ? ' daily' : ''}`, onclick: () => (daily ? watch() : choose()) },
      h('span', { class: 'sb-i', 'aria-hidden': 'true' }, '▶'),
      h('span', { class: 'sb-t' }, h('b', {}, daily ? `Today’s video, ${video?.source || ''}` : 'Study while you train'), h('small', {}, sub))));
  }

  // The choices: read, listen, or any video (favorites first). ♥ marks a favorite; favorite channels rank higher.
  async function choose() {
    const favs = await getFavs();
    const body = h('div', { class: 'vs-vlist' },
      h('div', { class: 'bar' },
        h('button', { class: 'chip', onclick: () => { l.close(); read(); } }, `Read ${state.verse.ref.replace(/:.*$/, '')}`),
        h('button', { class: 'chip', onclick: () => { l.close(); listen(); } }, 'Listen')),
      mode ? h('button', { class: 'chip', onclick: () => { l.close(); stop(); } }, 'Turn off') : null);
    let last = null;
    list.forEach((x, i) => {
      if (x.group !== last) { body.append(h('p', { class: 'lbl' }, x.group)); last = x.group; }
      body.append(videoRow(x, i === index && mode === 'video', () => { index = i; video = list[i]; l.close(); watch(); }, favs));
    });
    if (list.length > 1) body.append(h('p', { class: 'fine center' }, 'While a video plays, swipe across the middle of the screen for the next or previous one.'));
    const l = layer('Study while you train', body);
  }

  // ---- Watch
  function swipeLayer() {
    let x0 = null;
    const pad = h('div', { class: 'study-swipe', 'aria-hidden': 'true' });
    pad.addEventListener('pointerdown', e => { x0 = e.clientX; });
    pad.addEventListener('pointerup', e => {
      if (x0 === null) return;
      const mid = innerWidth / 2, x1 = e.clientX, moved = Math.abs(x1 - x0);
      if (moved < 12) { if (playing) { armed = false; ours = true; player?.pauseVideo(); } else { armed = true; ours = true; player?.playVideo(); } }
      else if (list.length > 1 && x0 > mid && x1 < mid) go(1);
      else if (list.length > 1 && x0 < mid && x1 > mid) go(-1);
      x0 = null;
    });
    return pad;
  }
  // What is playing, large and centered for a moment whenever the video starts or changes.
  function titleCard() {
    runner()?.querySelector('.vs-switch')?.remove();
    const card = h('div', { class: 'vs-switch notice', role: 'status' },
      list.length > 1 ? h('small', {}, `${index + 1} of ${list.length}`) : null,
      h('b', {}, decode(video.title)), h('span', {}, decode(video.channel || video.source || 'BibleProject')),
      video.sec ? h('small', { class: 'vs-dur' }, fmtDuration(video.sec)) : null);
    runner()?.append(card);
    setTimeout(() => card.classList.add('out'), 2600);
    setTimeout(() => card.remove(), 3200);
  }
  function go(step) {
    index = (index + step + list.length) % list.length;
    video = list[index];
    player?.loadVideoById?.({ videoId: video.id });
    container.querySelector('.study-backdrop')?.setAttribute('style', video.thumb ? `background-image:url('${video.thumb}')` : '');
    titleCard(); noteWatched();
  }
  function noteWatched() {
    clearTimeout(watchedTimer);
    const v = video;
    // Watched for 30 seconds: it goes in today's journal.
    watchedTimer = setTimeout(() => recordWatched(v), 30000);
  }
  async function watch() {
    if (mode) stop();
    mode = 'video';
    container.className = 'study open';
    runner()?.classList.add('video-mode');
    const slot = h('div', { class: 'study-frame' });
    fill(container,
      h('div', { class: 'study-backdrop', style: video.thumb ? `background-image:url('${video.thumb}')` : '' }),
      slot, swipeLayer(),
      daily ? null : h('button', { class: 'study-btn', onclick: choose }, 'Study'));
    titleCard();
    await loadApi();
    player = new window.YT.Player(slot, {
      videoId: video.id, host: ytHost,
      playerVars: ytVars(),
      events: {
        onReady: e => { e.target.playVideo(); noteWatched(); },
        onStateChange: e => {
          playing = e.data === 1;
          if (ours) { ours = false; return; }          // a change we made; leave the user's choice alone
          if (e.data === 1) armed = true;              // they pressed play: follow the timers from here
          if (e.data === 2) armed = false;             // they paused: stay paused until they play again
        },
      },
    });
  }

  // ---- Read: the chapter on glass, today's verses marked; scrolls inside its own panel.
  async function read() {
    if (mode) stop();
    mode = 'read';
    container.className = 'study open';
    runner()?.classList.add('read-mode');
    const m = state.verse.ref.match(/^(.+?)\s(\d+):(\d+)(?:-(\d+))?$/);
    const from = Number(m[3]), to = Number(m[4] || m[3]);
    readText = h('div', { class: 'study-read' }, h('p', { class: 'muted' }, 'Loading…'));
    fill(container, readText, h('button', { class: 'study-btn', onclick: choose }, 'Study'));
    try {
      const d = await fetchVerse(`${m[1]} ${m[2]}`, await getVersion());
      fill(readText, h('p', { class: 'lbl' }, `${m[1]} ${m[2]} ${d.version}`), h('p', { class: 'ctx-text' }, d.verses.map(x => {
        const n = Number((x.id.match(/-(\d+)$/) || [])[1]);
        return h('span', { class: n >= from && n <= to ? 'ctx-today' : '' }, h('sup', {}, n), ` ${x.text} `);
      })));
      readText.querySelector('.ctx-today')?.scrollIntoView({ block: 'center' });
    } catch (err) { fill(readText, h('p', { class: 'muted' }, err.message)); }
  }

  // ---- Listen: the phone reads today's verse, then its chapter, aloud. Follows the block like a video.
  async function listen() {
    if (mode) stop();
    if (!('speechSynthesis' in window)) return toast('This phone cannot read aloud.');
    mode = 'listen';
    const m = state.verse.ref.match(/^(.+?)\s(\d+):/);
    let text;
    try {
      const v = await getVersion();
      const [verse, ch] = await Promise.all([fetchVerse(state.verse.ref, v), fetchVerse(`${m[1]} ${m[2]}`, v)]);
      text = `${state.verse.ref}. ${verse.text} ... ${m[1]} chapter ${m[2]}. ${ch.text}`;
    } catch (err) { mode = null; return toast(err.message); }
    speech = await utterance(text);
    speech.onend = () => { if (mode === 'listen') stop(); };
    speechSynthesis.speak(speech);
    armed = true; playing = true;
    container.className = 'study collapsed';
    fill(container, h('button', { class: 'study-bar', onclick: choose },
      h('span', { class: 'sb-i', 'aria-hidden': 'true' }, '♪'),
      h('span', { class: 'sb-t' }, h('b', {}, `Listening: ${m[1]} ${m[2]}`), h('small', {}, 'Tap for other choices'))));
  }

  (async () => {
    try {
      if (daily) { video = await fetchDaily(daily, state.date); return drawBar(); }
      list = await studyVideos(state.verse.ref);
      video = list[0] || null;
    } catch { video = null; }
    drawBar();
  })();

  return {
    play() {
      if (mode === 'video' && player && armed && !playing) { ours = true; player.playVideo(); }
      if (mode === 'listen' && speech && speechSynthesis.paused) { speechSynthesis.resume(); playing = true; }
    },
    hold() {
      if (mode === 'video' && player && armed && playing) { ours = true; player.pauseVideo(); }
      if (mode === 'listen' && speech && speechSynthesis.speaking) { speechSynthesis.pause(); playing = false; }
    },
    duck(ms = 900) {
      if (!player || !playing || !player.setVolume) return;
      player.setVolume(20);
      clearTimeout(duckTimer);
      duckTimer = setTimeout(() => player?.setVolume?.(100), ms);
    },
    destroy() { clearTimeout(duckTimer); clearTimeout(watchedTimer); player?.destroy?.(); player = null; if (speech) speechSynthesis.cancel(); },
  };
}

// A video row with a favorite heart; shared by the workout picker and the verse study list.
export function videoRow(x, current, onPlay, favs) {
  const fav = h('button', { class: `vs-fav${favs[x.id] ? ' on' : ''}`, 'aria-label': favs[x.id] ? 'Remove favorite' : 'Favorite', onclick: async e => {
    e.stopPropagation();
    const on = await toggleFav(x);
    fav.classList.toggle('on', on); fav.setAttribute('aria-label', on ? 'Remove favorite' : 'Favorite');
    toast(on ? `♥ Saved. ${decode(x.channel || 'BibleProject')} ranks first now.` : 'Favorite removed');
  } }, '♥');
  return h('div', { class: `vs-row${current ? ' on' : ''}` },
    h('button', { class: 'vs-video', onclick: onPlay },
      h('span', { class: 'vb-thumb', style: x.thumb ? `background-image:url('${x.thumb}')` : '' }),
      h('span', { class: 'vs-vt' }, h('b', {}, decode(x.title)), h('small', {}, `${x.channel ? decode(x.channel) : 'BibleProject'}${x.sec ? ` · ${fmtDuration(x.sec)}` : ''}`))),
    fav);
}
