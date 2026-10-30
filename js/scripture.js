// Verse text from Bible Gateway via the Telmyn API worker, cached on the phone so it works offline after the first load.
import { API_BASE } from './config.js';
import { getMeta, setMeta, all } from './db.js';
import { daysBetween } from './clock.js';

export const DEFAULT_VERSION = 'NKJV';
// Used until the full Bible Gateway list loads (or if it can't).
const FALLBACK_VERSIONS = [
  ['NKJV', 'New King James Version'], ['KJV', 'King James Version'], ['ESV', 'English Standard Version'],
  ['NIV', 'New International Version'], ['NASB', 'New American Standard Bible'], ['NLT', 'New Living Translation'],
  ['CSB', 'Christian Standard Bible'], ['AMP', 'Amplified Bible'], ['MSG', 'The Message'], ['WEB', 'World English Bible'],
].map(([abbr, name]) => ({ abbr, name }));

export const getVersion = () => getMeta('verse_version', DEFAULT_VERSION);
export const setVersion = v => setMeta('verse_version', v);

export async function fetchVerse(ref, version) {
  const key = `verse:${version}:${ref}`;
  const cached = await getMeta(key);
  if (cached) return cached;
  if (!API_BASE) throw new Error('Verse service not connected yet.');
  const r = await fetch(`${API_BASE}/verse?ref=${encodeURIComponent(ref)}&v=${encodeURIComponent(version)}`)
    .catch(() => { throw new Error('Could not reach the verse service. Check the connection and try again.'); });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.text) throw new Error(data.error || 'Could not load the verse.');
  await setMeta(key, data);
  return data;
}

export async function listVersions() {
  const cached = await getMeta('bg_versions');
  if (cached && Date.now() - cached.at < 30 * 86400000) return cached.list;
  if (!API_BASE) return FALLBACK_VERSIONS;
  try {
    const r = await fetch(`${API_BASE}/versions`);
    const data = await r.json();
    if (data.versions?.length) { await setMeta('bg_versions', { at: Date.now(), list: data.versions }); return data.versions; }
  } catch { /* use fallback */ }
  return cached?.list || FALLBACK_VERSIONS;
}

export const passageUrl = (ref, version) => `https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref)}&version=${encodeURIComponent(version)}`;

// Video lists carry their lengths (sec) since 0.17.7; VID versions the caches so older lists without them are refetched.
const VID = 'v2';
export const fmtDuration = sec => !sec ? '' : sec >= 3600 ? `${Math.floor(sec / 3600)}:${String(Math.floor(sec % 3600 / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

// Bible study videos: BibleProject only (Ross's call: the others were often off-topic). Their overview of the book,
// plus their videos on the verse's main word when there are any. Cached on the phone for 30 days.
export const CREATORS = [{ key: 'bibleproject', name: 'BibleProject' }];
export const getCreator = async () => 'bibleproject';

export async function fetchVideos(ref, creator = 'bibleproject', topic = null) {
  const key = `videos:${VID}:${creator}:${ref}${topic ? `:${topic}` : ''}`;
  const cached = await getMeta(key);
  if (cached && Date.now() - cached.at < 30 * 86400000) return cached.list;
  const q = `ref=${encodeURIComponent(ref)}&creator=${encodeURIComponent(creator)}${topic ? `&topic=${encodeURIComponent(topic)}` : ''}&v=${VID}`;
  const r = await fetch(`${API_BASE}/videos?${q}`)
    .catch(() => { throw new Error('Could not reach the verse service. Check the connection and try again.'); });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Could not load videos.');
  await setMeta(key, { at: Date.now(), list: data.videos });
  return data.videos;
}

// Daily video (Gator's Fab Five): the newest upload not shown in the last 13 days, so the same video never plays two
// days in a row and none repeats within 13 days of its last day. If every recent upload was shown inside that window,
// the one shown longest ago plays. The pick is kept for the day; daily_seen records { videoId: last date shown }.
export const DAILY_GAP = 13;
export function pickDaily(videos, seen, date) {
  const fresh = videos.find(v => !seen[v.id] || daysBetween(seen[v.id], date) > DAILY_GAP || seen[v.id] === date);
  return fresh || [...videos].sort((a, b) => (seen[a.id] || '').localeCompare(seen[b.id] || ''))[0];
}
// First run with this rule: learn what was already shown from the days cached before it existed.
async function seedSeen() {
  const seen = {};
  for (const m of await all('meta')) {
    const d = m.key.match(/^daily:(?:[a-z0-9]+:)?[^:]+:(\d{4}-\d{2}-\d{2})$/)?.[1];
    if (d && m.value?.id && (!seen[m.value.id] || seen[m.value.id] < d)) seen[m.value.id] = d;
  }
  return seen;
}
export async function fetchDaily(source, date) {
  const key = `daily:d3:${source}:${date}`;
  const cached = await getMeta(key);
  if (cached) return cached;
  const r = await fetch(`${API_BASE}/daily?source=${encodeURIComponent(source)}&v=d3`)
    .catch(() => { throw new Error('Could not reach the video service.'); });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.videos?.length) throw new Error(data.error || 'Could not load today’s video.');
  const seen = await getMeta('daily_seen', null) || await seedSeen();
  const out = { ...pickDaily(data.videos, seen, date), source: data.source };
  seen[out.id] = date;
  await setMeta('daily_seen', seen);
  await setMeta(key, out);
  return out;
}

// Videos on the passage itself from any teacher (titles must name the passage; no Shorts). Cached 30 days.
export async function fetchPassageVideos(ref) {
  const key = `videos:${VID}:passage:${ref}`;
  const cached = await getMeta(key);
  if (cached && Date.now() - cached.at < 30 * 86400000) return cached.list;
  const r = await fetch(`${API_BASE}/passage?ref=${encodeURIComponent(ref)}&v=${VID}`)
    .catch(() => { throw new Error('Could not reach the verse service.'); });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Could not load videos.');
  await setMeta(key, { at: Date.now(), list: data.videos });
  return data.videos;
}

// Greek or Hebrew word data for a verse (STEPBible), loaded once.
let originalData;
export async function originalWords(ref) {
  originalData ||= fetch('data/original.json').then(r => r.json());
  return (await originalData).verses[ref];
}

// The one list of study videos for a verse, in order, each tagged with what it covers: on this verse, on its chapter,
// BibleProject on the whole book, BibleProject on the verse's main word. Used by verse study and by the workout.
export async function studyVideos(ref) {
  const m = ref.match(/^(.+?)\s(\d+):/);
  const book = m[1], ch = m[2];
  const o = await originalWords(ref).catch(() => null);
  const topic = o?.words?.find(w => w.key && /noun/.test(w.gram || ''))?.g?.split(/[\s/,]/)[0] || null;
  const [onPassage, whole, word] = await Promise.all([
    fetchPassageVideos(ref).catch(() => []),
    fetchVideos(ref).catch(() => []),
    topic ? fetchVideos(ref, 'bibleproject', topic).catch(() => []) : [],
  ]);
  const favs = await getFavs();
  // Favorites first, then videos from channels you have favorited, within each group.
  const favChannels = new Set(Object.values(favs).map(f => f.channel));
  const rank = x => (favs[x.id] ? 0 : favChannels.has(x.channel) ? 1 : 2);
  const tag = (list, group) => list.map(x => ({ ...x, group })).sort((a, b) => rank(a) - rank(b));
  return [
    ...tag(onPassage.filter(x => x.on === 'verse'), `On ${ref}`),
    ...tag(onPassage.filter(x => x.on === 'chapter'), `On ${book} ${ch}`),
    ...tag(whole, `${book}, the whole book`),
    ...tag(word, topic ? `On ${topic}` : 'More'),
  ].filter((x, i, a) => a.findIndex(y => y.id === x.id) === i);
}

// Favorite videos: { id: { title, channel, thumb, at } }, kept in backups. Their channels rank higher in every list.
export const getFavs = () => getMeta('video_favs', {});
export async function toggleFav(v) {
  const favs = await getFavs();
  if (favs[v.id]) delete favs[v.id]; else favs[v.id] = { title: v.title, channel: v.channel || 'BibleProject', thumb: v.thumb || '', at: new Date().toISOString() };
  await setMeta('video_favs', favs);
  return !!favs[v.id];
}

// Videos watched for at least 30 seconds, by day, listed on that day's Study page: { date: [{ id, title, channel, thumb, sec }] }.
export async function recordWatched(v) {
  const { state } = await import('./state.js');
  const all = await getMeta('watched', {});
  const day = all[state.date] || [];
  if (!day.some(x => x.id === v.id)) day.push({ id: v.id, title: v.title, channel: v.channel || v.source || 'BibleProject', thumb: v.thumb || '', sec: v.sec || null });
  all[state.date] = day;
  await setMeta('watched', all);
}
export const watchedOn = async date => (await getMeta('watched', {}))[date] || [];
