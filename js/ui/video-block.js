// Video blocks: the day's follow-along video IS the block (Fab Five with Gator).
// The video fills the screen with only two small controls on top. When the video ends, the block is done.
// If the video can't load (offline, no upload), the regular step-by-step block runs instead.
import { h, toast } from './dom.js';
import { burst } from './fx.js';
import { state, addEvent } from '../state.js';
import { now } from '../clock.js';
import { fetchDaily } from '../scripture.js';
import { loadApi, ytHost, ytVars } from './study-player.js';
import { exitLandscape } from './media.js';

export async function runVideoBlock(block, source, { onExit, fallback, cooldown } = {}) {
  let video;
  try { video = await fetchDaily(source, state.date); } catch { video = null; }
  if (!video) { toast('Video unavailable. Running the steps instead.'); return fallback(); }

  const startedAt = now().toISOString();
  let done = false, player = null;
  const slot = h('div', { class: 'vb-frame' });
  const root = h('div', { class: 'vblock', role: 'dialog', 'aria-label': block.name },
    slot,
    h('button', { class: 'vb-btn vb-x', 'aria-label': 'Leave', onclick: () => finish(false, null) }, '✕'),
    h('button', { class: 'vb-btn vb-done', onclick: () => finish(true) }, '✓ Done'));
  document.body.append(root);
  try { await navigator.wakeLock?.request('screen'); } catch { /* optional */ }
  addEvent('block_start', { block: block.id, video: video.id });

  history.pushState({ ...(history.state || {}), telmynRunner: true }, '');
  const onPop = e => { if (!root.isConnected || e.state?.telmynRunner) return; finish(false, null); };
  addEventListener('popstate', onPop);

  // No YouTube within 8 seconds (offline): drop the video and run the steps instead.
  const ready = await Promise.race([loadApi().then(() => true), new Promise(r => setTimeout(() => r(false), 8000))]);
  if (done) return;
  if (!ready) {
    done = true; removeEventListener('popstate', onPop);
    if (history.state?.telmynRunner) history.back();
    root.remove(); toast('Video unavailable. Running the steps instead.');
    return fallback();
  }
  player = new window.YT.Player(slot, {
    videoId: video.id, width: '100%', height: '100%', host: ytHost,
    playerVars: ytVars({ autoplay: 1 }),
    events: {
      onReady: e => e.target.playVideo(),
      onStateChange: e => { if (e.data === 0) finish(true); },   // 0 = ended: watching it through completes the block
      // YouTube refused the video: run the steps instead so the block still happens.
      onError: () => { if (done) return; done = true; removeEventListener('popstate', onPop); if (history.state?.telmynRunner) history.back(); player?.destroy?.(); root.remove(); toast('Video won’t play here. Running the steps instead.'); fallback(); },
    },
  });

  async function finish(ok, type = 'block_done') {
    if (done) return;
    done = true;
    removeEventListener('popstate', onPop);
    if (history.state?.telmynRunner) history.back();
    exitLandscape();
    player?.destroy?.();
    if (ok || type) await addEvent(ok ? 'block_done' : type, { block: block.id, started_at: startedAt, done_at: now().toISOString(), video: video.id, palms: null });
    if (ok) burst(innerWidth / 2, innerHeight * 0.45);
    root.classList.add('closing');
    // Done with the video: the block's own cooldown (v1.1: doorway chest and forearm stretches) follows, so the
    // video never skips it. Leaving the video without finishing goes straight back to Today.
    setTimeout(() => { root.remove(); if (ok && cooldown) cooldown(); else onExit?.(); }, 200);
  }
}
