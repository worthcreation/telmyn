// Bible study video for today's verse, playing inside a block while you train.
// It plays while a timer runs (holds, rests, hangs) and pauses when the app is waiting on you (reps, logging).
// Beeps duck the video volume for a moment so alerts are always heard. Your own pause or play always wins.
import { h, fill, layer, toast } from './dom.js';
import { state } from '../state.js';
import { fetchDaily, studyVideos } from '../scripture.js';
import { enterLandscape, exitLandscape, rotateButton } from './media.js';

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

// daily: a /daily source name; the block then shows that channel's video of the day instead of the verse study video.
export function studyPlayer(container, { daily = null, landscape = false } = {}) {
  let player = null, video = null, list = [], index = 0, armed = false, ours = false, playing = false, duckTimer = null;

  const runner = () => container.closest('.runner');
  const close = () => { exitLandscape(); player?.destroy?.(); player = null; armed = false; playing = false; runner()?.classList.remove('video-mode', 'video-fit'); drawBar(); };

  // The card: what will play. Tap it to choose from every study video for today's verse (Fab Five's daily video has
  // no list, so it plays straight away).
  function drawBar() {
    if (!video) return fill(container);
    container.className = 'study collapsed';
    fill(container, h('button', { class: `study-bar${daily ? ' daily' : ''}`, onclick: () => (daily || list.length < 2 ? open() : choose()) },
      h('span', { class: 'sb-i', 'aria-hidden': 'true' }, '▶'),
      h('span', { class: 'sb-t' }, h('b', {}, daily ? `Today’s video, ${video.source}` : `Study while you train${list.length > 1 ? ` · ${list.length} videos` : ''}`), h('small', {}, decode(video.title)))));
  }

  // Selection: every video, grouped as on the verse study screen. Tapping one plays it in the workout.
  function choose() {
    const body = h('div', { class: 'vs-vlist' });
    let last = null;
    list.forEach((x, i) => {
      if (x.group !== last) { body.append(h('p', { class: 'lbl' }, x.group)); last = x.group; }
      body.append(h('button', { class: `vs-video${i === index ? ' on' : ''}`, onclick: () => { index = i; video = list[i]; l.close(); open(); } },
        h('span', { class: 'vb-thumb', style: x.thumb ? `background-image:url('${x.thumb}')` : '' }),
        h('span', { class: 'vs-vt' }, h('b', {}, decode(x.title)), h('small', {}, x.channel ? decode(x.channel) : 'BibleProject'))));
    });
    body.append(h('p', { class: 'fine center' }, 'While a video plays, swipe across the middle of the screen to go to the next or previous one.'));
    const l = layer('Study while you train', body);
  }

  // Swipe: a drag that crosses the middle of the screen moves to the next (right to left) or previous video.
  // A plain tap on the video plays or pauses it.
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
  function go(step) {
    index = (index + step + list.length) % list.length;
    video = list[index];
    player?.loadVideoById?.({ videoId: video.id });
    container.querySelector('.study-backdrop')?.setAttribute('style', video.thumb ? `background-image:url('${video.thumb}')` : '');
    toast(`${index + 1} of ${list.length}: ${decode(video.title)}`);
  }

  async function open() {
    // Must start inside the tap that opened the video: browsers allow fullscreen only from a tap.
    if (landscape && runner()) enterLandscape(runner());
    container.className = 'study open';
    runner()?.classList.add('video-mode');
    const slot = h('div', { class: 'study-frame' });
    const fitBtn = h('button', { class: 'study-fit', onclick: () => {
      const r = runner(); r?.classList.toggle('video-fit');
      fitBtn.textContent = r?.classList.contains('video-fit') ? 'Fill screen' : 'Show whole video';
    } }, 'Show whole video');
    fill(container,
      h('div', { class: 'study-backdrop', style: video.thumb ? `background-image:url('${video.thumb}')` : '' }),
      slot, swipeLayer(),
      h('div', { class: 'study-tools' }, list.length > 1 ? h('button', { class: 'study-fit', onclick: choose }, 'Videos') : null, fitBtn, rotateButton(runner(), 'study-fit'), h('button', { class: 'study-close', 'aria-label': 'Close video', onclick: close }, '✕')));
    await loadApi();
    player = new window.YT.Player(slot, {
      videoId: video.id, host: ytHost,
      playerVars: ytVars(),
      events: {
        onReady: e => { e.target.playVideo(); },
        onStateChange: e => {
          playing = e.data === 1;
          if (ours) { ours = false; return; }          // a change we made; leave the user's choice alone
          if (e.data === 1) armed = true;              // they pressed play: follow the timers from here
          if (e.data === 2) armed = false;             // they paused: stay paused until they play again
        },
      },
    });
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
    play() { if (player && armed && !playing) { ours = true; player.playVideo(); } },
    hold() { if (player && armed && playing) { ours = true; player.pauseVideo(); } },
    duck(ms = 900) {
      if (!player || !playing || !player.setVolume) return;
      player.setVolume(20);
      clearTimeout(duckTimer);
      duckTimer = setTimeout(() => player?.setVolume?.(100), ms);
    },
    destroy() { clearTimeout(duckTimer); player?.destroy?.(); player = null; },
  };
}
