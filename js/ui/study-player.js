// Bible study video for today's verse, playing inside a block while you train.
// It plays while a timer runs (holds, rests, hangs) and pauses when the app is waiting on you (reps, logging).
// Beeps duck the video volume for a moment so alerts are always heard. Your own pause or play always wins.
import { h, fill } from './dom.js';
import { state } from '../state.js';
import { getCreator, fetchVideos, CREATORS } from '../scripture.js';

let apiReady;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve();
  apiReady ||= new Promise(resolve => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    document.head.append(h('script', { src: 'https://www.youtube.com/iframe_api' }));
  });
  return apiReady;
}

const decode = t => { const e = document.createElement('textarea'); e.innerHTML = t; return e.value; };

export function studyPlayer(container) {
  let player = null, video = null, armed = false, ours = false, playing = false, duckTimer = null;

  const close = () => { player?.destroy?.(); player = null; armed = false; playing = false; drawBar(); };

  function drawBar() {
    if (!video) return fill(container);
    container.className = 'study collapsed';
    fill(container, h('button', { class: 'study-bar', onclick: open },
      h('span', { class: 'sb-i', 'aria-hidden': 'true' }, '▶'),
      h('span', { class: 'sb-t' }, h('b', {}, 'Study while you train'), h('small', {}, decode(video.title)))));
  }

  async function open() {
    container.className = 'study open';
    const slot = h('div', { class: 'study-frame' });
    fill(container, slot, h('button', { class: 'study-close', 'aria-label': 'Close video', onclick: close }, '✕'));
    await loadApi();
    player = new window.YT.Player(slot, {
      videoId: video.id,
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
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
      const creator = await getCreator();
      const list = await fetchVideos(state.verse.ref, creator);
      video = list[0] || null;
      if (video) video.creator = CREATORS.find(c => c.key === creator)?.name;
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
