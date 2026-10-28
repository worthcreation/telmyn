// Verse text from Bible Gateway via the Telmyn API worker, cached on the phone so it works offline after the first load.
import { API_BASE } from './config.js';
import { getMeta, setMeta } from './db.js';

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

// Bible study videos: BibleProject only (Ross's call: the others were often off-topic). Their overview of the book,
// plus their videos on the verse's main word when there are any. Cached on the phone for 30 days.
export const CREATORS = [{ key: 'bibleproject', name: 'BibleProject' }];
export const getCreator = async () => 'bibleproject';

export async function fetchVideos(ref, creator = 'bibleproject', topic = null) {
  const key = `videos:${creator}:${ref}${topic ? `:${topic}` : ''}`;
  const cached = await getMeta(key);
  if (cached && Date.now() - cached.at < 30 * 86400000) return cached.list;
  const q = `ref=${encodeURIComponent(ref)}&creator=${encodeURIComponent(creator)}${topic ? `&topic=${encodeURIComponent(topic)}` : ''}`;
  const r = await fetch(`${API_BASE}/videos?${q}`)
    .catch(() => { throw new Error('Could not reach the verse service. Check the connection and try again.'); });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Could not load videos.');
  await setMeta(key, { at: Date.now(), list: data.videos });
  return data.videos;
}

export async function fetchDaily(source, date) {
  const key = `daily:${source}:${date}`;
  const cached = await getMeta(key);
  if (cached) return cached;
  const r = await fetch(`${API_BASE}/daily?source=${encodeURIComponent(source)}`)
    .catch(() => { throw new Error('Could not reach the video service.'); });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.video) throw new Error(data.error || 'Could not load today’s video.');
  const out = { ...data.video, source: data.source };
  await setMeta(key, out);
  return out;
}
