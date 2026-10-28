// In-app video: every Watch button plays here, never on another site.
// Also the landscape switch used by any full-screen video (fullscreen + orientation lock, Android Chrome).
import { h } from './dom.js';
import { loadApi, ytHost, ytVars } from './study-player.js';
import { getMeta, setMeta } from '../db.js';

// YouTube watch, shorts and youtu.be links (with optional start time), or a Facebook video page.
export function parseVideo(url) {
  try {
    const u = new URL(url);
    const t = Number((u.searchParams.get('t') || '0').replace(/s$/, '')) || 0;
    if (/youtube\.com$/.test(u.hostname.replace(/^www\.|^m\./, ''))) {
      const id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed)\/([\w-]{6,})/) || [])[1];
      if (id) return { kind: 'yt', id, start: t, vertical: u.pathname.startsWith('/shorts/') };
    }
    if (u.hostname === 'youtu.be') return { kind: 'yt', id: u.pathname.slice(1), start: t };
    if (/facebook\.com$/.test(u.hostname.replace(/^www\.|^m\./, ''))) return { kind: 'fb', url };
  } catch { /* not a URL */ }
  return null;
}

// Landscape: fullscreen first (Android only allows the orientation lock in fullscreen), then lock.
// Leaving restores the app's normal portrait.
export const isLandscape = () => !!document.fullscreenElement;
export async function enterLandscape(el) {
  try { await el.requestFullscreen({ navigationUI: 'hide' }); await screen.orientation?.lock?.('landscape'); } catch { /* not supported */ }
}
export async function exitLandscape() {
  try { screen.orientation?.unlock?.(); } catch { /* not supported */ }
  try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* already out */ }
}
// Small round switch for the top corner of any video.
export function rotateButton(el, cls = 'vb-btn') {
  const b = h('button', { class: `${cls} vb-rotate`, 'aria-label': 'Landscape', onclick: async () => {
    if (isLandscape()) await exitLandscape(); else await enterLandscape(el);
  } }, '⟲');
  return b;
}

// The Watch button. Same look everywhere: a quiet pill with a play mark.
export const watchButton = (label, url, hooks = {}, title = label) => parseVideo(url)
  ? h('button', { class: 'watch-chip', onclick: () => playVideo(url, title, hooks) }, h('span', { class: 'wc-i', 'aria-hidden': 'true' }, '▶'), label)
  : null;

// Full-screen player over whatever is open. Only ✕ and the landscape switch sit on top of the video.
export async function playVideo(url, title = 'Video', { onOpen, onClose } = {}) {
  const v = parseVideo(url);
  if (!v) return;
  onOpen?.();
  const slot = h('div', { class: 'vb-frame' });
  const root = h('div', { class: `vblock vplayer${v.vertical ? ' vertical' : ''}`, role: 'dialog', 'aria-label': title }, slot);
  const close = async () => {
    removeEventListener('popstate', onPop);
    if (history.state?.telmynVideo) history.back();
    await exitLandscape();
    player?.destroy?.();
    root.classList.add('closing');
    setTimeout(() => root.remove(), 200);
    onClose?.();
  };
  root.append(h('button', { class: 'vb-btn vb-x', 'aria-label': 'Close video', onclick: close }, '✕'), rotateButton(root),
    h('p', { class: 'vb-title' }, title));
  document.body.append(root);
  history.pushState({ telmynVideo: true }, '');
  const onPop = () => { if (root.isConnected) { removeEventListener('popstate', onPop); exitLandscape(); player?.destroy?.(); root.remove(); onClose?.(); } };
  addEventListener('popstate', onPop);

  let player = null;
  if (v.kind === 'fb') {
    slot.replaceWith(h('iframe', { class: 'vb-frame', src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(v.url)}&show_text=false&autoplay=true`, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, title }));
    return;
  }
  await loadApi();
  if (!root.isConnected) return;
  player = new window.YT.Player(slot, {
    videoId: v.id, width: '100%', height: '100%', host: ytHost,
    playerVars: ytVars({ autoplay: 1, start: v.start || 0 }),
    events: {
      onReady: e => e.target.playVideo(),
      // YouTube refused to play it here: say so in the app's own words and keep a record for the next fix.
      onError: async e => {
        const list = await getMeta('video_errors', []);
        list.push({ url, code: e.data, at: new Date().toISOString() });
        await setMeta('video_errors', list.slice(-20));
        root.append(h('div', { class: 'vb-error' }, h('b', {}, 'This video won’t play inside the app.'),
          h('span', {}, 'It’s logged so it can be swapped for one that does.')));
      },
    },
  });
}
