// In-app video: every Watch button plays here, never on another site.
// Also the landscape switch used by any full-screen video (fullscreen + orientation lock, Android Chrome).
import { h } from './dom.js';
import { loadApi, ytHost, ytVars } from './study-player.js';
import { getMeta, setMeta } from '../db.js';
import { API_BASE } from '../config.js';

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

// Ross's picks replace library videos that YouTube won't play inside the app. Stored as a setting
// (meta video_picks, kept in backups): { exerciseKey: { id, title, channel } }. Loaded once at start.
let picks = {};
export async function loadPicks() { picks = await getMeta('video_picks', {}); }
export const videoFor = (key, url) => (picks[key] ? `https://www.youtube.com/watch?v=${picks[key].id}` : url);
async function savePick(key, v) {
  picks = { ...picks, [key]: { id: v.id, title: v.title, channel: v.channel, at: new Date().toISOString() } };
  await setMeta('video_picks', picks);
}

// The Watch button. Same look everywhere: a quiet pill with a play mark.
// pick = { key, query } lets a refused video be replaced on the spot.
export const watchButton = (label, url, hooks = {}, title = label, pick = null) => {
  if (!parseVideo(url)) return null;
  // Look up the pick at tap time, so a replacement chosen a moment ago is used right away.
  return h('button', { class: 'chip pill', onclick: () => playVideo(pick ? videoFor(pick.key, url) : url, title, { ...hooks, pick }) },
    h('span', { class: 'wc-i', 'aria-hidden': 'true' }, '▶'), label);
};

const decode = t => { const e = document.createElement('textarea'); e.innerHTML = t; return e.value; };

// Full-screen player over whatever is open. Only ✕, the title and the landscape switch sit on top of the video.
export async function playVideo(url, title = 'Video', { onOpen, onClose, pick = null } = {}) {
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
  history.pushState({ ...(history.state || {}), telmynVideo: true }, '');
  const onPop = () => { if (root.isConnected) { removeEventListener('popstate', onPop); exitLandscape(); player?.destroy?.(); root.remove(); onClose?.(); } };
  addEventListener('popstate', onPop);

  let player = null;
  if (v.kind === 'fb') {
    slot.replaceWith(h('iframe', { class: 'vb-frame', src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(v.url)}&show_text=false&autoplay=true`, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, title }));
    return;
  }

  // YouTube refused the video. Say so plainly, and when it belongs to an exercise, offer replacements
  // that are allowed to play in apps. Tapping one plays it and makes it that exercise's video from now on.
  async function refused(code, failedId) {
    const list = await getMeta('video_errors', []);
    list.push({ url: `https://www.youtube.com/watch?v=${failedId}`, code, at: new Date().toISOString() });
    await setMeta('video_errors', list.slice(-20));
    root.querySelector('.vb-error')?.remove();
    const box = h('div', { class: 'vb-error' }, h('b', {}, 'YouTube won’t play this one inside the app.'));
    root.append(box);
    if (!pick) return box.append(h('span', {}, 'It’s logged so it can be replaced.'));
    const btn = h('button', { class: 'btn', onclick: () => showChoices() }, 'Find one that plays');
    box.append(btn);
    async function showChoices() {
      btn.disabled = true; btn.textContent = 'Searching…';
      try {
        const r = await fetch(`${API_BASE}/search?q=${encodeURIComponent(pick.query)}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Search failed.');
        const vids = d.videos.filter(x => x.id !== failedId);
        if (!vids.length) throw new Error('Nothing found.');
        box.replaceChildren(h('b', {}, 'Pick one. It becomes the video for this exercise.'),
          h('div', { class: 'vb-choices' }, vids.map(x => h('button', { class: 'vb-choice', onclick: async () => {
            await savePick(pick.key, x);
            box.remove();
            player.loadVideoById({ videoId: x.id });
            root.querySelector('.vb-title').textContent = `${title} (new pick)`;
          } }, h('span', { class: 'vb-thumb', style: x.thumb ? `background-image:url('${x.thumb}')` : '' }),
            h('span', {}, h('b', {}, decode(x.title)), h('small', {}, decode(x.channel)))))));
      } catch (err) { btn.disabled = false; btn.textContent = 'Try again'; box.querySelector('span')?.remove(); box.append(h('span', {}, err.message)); }
    }
  }

  await loadApi();
  if (!root.isConnected) return;
  player = new window.YT.Player(slot, {
    videoId: v.id, width: '100%', height: '100%', host: ytHost,
    playerVars: ytVars({ autoplay: 1, start: v.start || 0 }),
    events: {
      onReady: e => e.target.playVideo(),
      onError: e => refused(e.data, e.target?.getVideoData?.()?.video_id || v.id),
    },
  });
}
