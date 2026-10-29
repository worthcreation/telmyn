import { pushRoute, pushTick } from './push.js';
// Telmyn API (Cloudflare Worker). Personal, non-commercial use.
// GET /verse?ref=Galatians%206:9&v=NKJV  -> { ref, version, text, verses[], copyright, source }
// GET /versions                         -> { versions: [{ abbr, name }] }
// GET /daily?source=gator               -> { source, video: { id, title, published, thumb } }
// Reads the public Bible Gateway passage page, keeps only the verse text, caches for 7 days.

const ALLOWED_ORIGINS = ['https://telmyn.worthcreation.com', 'http://localhost:8000'];
// The separate test app on Cloudflare Pages (telmyn-test.pages.dev, plus its per-deploy preview addresses).
const TEST_ORIGIN = /^https:\/\/([a-z0-9]+\.)?telmyn-test[a-z0-9-]*\.pages\.dev$/;
const BG = 'https://www.biblegateway.com';
const UA = 'Mozilla/5.0 (Telmyn personal app)';
const WEEK = 60 * 60 * 24 * 7;

function cors(req) {
  const o = req.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(o) || TEST_ORIGIN.test(o || '') ? o : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}
const json = (req, body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${WEEK}`, ...cors(req) },
});

// Pull verse text out of the passage page. Skips verse numbers, footnote and cross-reference markers.
async function parsePassage(html) {
  const verses = [];
  let current = null, skip = 0, inPassage = 0, copyright = '', inCopy = false;
  const rw = new HTMLRewriter()
    .on('div.passage-text', { element(el) { inPassage++; el.onEndTag(() => { inPassage--; }); } })
    .on('div.passage-text sup.versenum, div.passage-text sup.footnote, div.passage-text sup.crossreference, div.passage-text span.chapternum, div.passage-text div.footnotes, div.passage-text div.crossrefs, div.passage-text h3, div.passage-text h4', {
      element(el) { skip++; el.onEndTag(() => { skip--; }); },
    })
    .on('div.passage-text span.text', {
      element(el) {
        const cls = el.getAttribute('class') || '';
        const id = (cls.match(/\b([A-Za-z0-9]+-\d+-\d+)\b/) || [])[1] || cls;   // e.g. Gal-6-9
        if (!current || current.id !== id) { current = { id, text: '' }; verses.push(current); }
      },
      text(t) { if (!skip && current) current.text += t.text; },
    })
    .on('div.publisher-info-bottom p', { element() { copyright += ' '; } })
    .on('div.publisher-info-bottom', { element(el) { inCopy = true; el.onEndTag(() => { inCopy = false; }); }, text(t) { if (inCopy) copyright += t.text; } });
  await rw.transform(new Response(html)).text();
  const clean = s => s.replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, '’').replace(/&#8220;|&ldquo;/g, '“').replace(/&#8221;|&rdquo;/g, '”').replace(/\s+/g, ' ').trim();
  const out = verses.map(v => ({ id: v.id, text: clean(v.text) })).filter(v => v.text);
  return { verses: out, text: out.map(v => v.text).join(' '), copyright: clean(copyright) };
}

async function versions() {
  const html = await (await fetch(`${BG}/versions/`, { headers: { 'User-Agent': UA } })).text();
  const seen = new Map();
  for (const m of html.matchAll(/href="\/versions\/([^"]+?)-([A-Z0-9]+(?:-[A-Z0-9]+)?)-Bible\/?"[^>]*>([^<]+)</g)) {
    const abbr = m[2], name = m[3].trim();
    if (!seen.has(abbr)) seen.set(abbr, { abbr, name });
  }
  return [...seen.values()];
}

// Bible study videos for a verse, by creator. Uses the official YouTube Data API (key stored as a Worker secret).
// Results are filtered to the creator's own channel and cached for 30 days, so searches stay rare.
const CREATORS = {
  bibleproject: { name: 'BibleProject', channel: /^BibleProject$/i, q: (b) => `BibleProject ${b}` },
};
const MONTH = 60 * 60 * 24 * 30;

async function videos(url, env) {
  const ref = url.searchParams.get('ref') || '';
  const who = CREATORS[url.searchParams.get('creator') || ''];
  const m = ref.match(/^([1-3]?\s?[A-Za-z ]+?)\s(\d+)(?::(\d+))?/);
  if (!who || !m) return { status: 400, body: { error: 'Bad reference or creator.' } };
  if (!env.YOUTUBE_KEY) return { status: 500, body: { error: 'Video search is not set up yet.' } };
  // topic: the verse's main word (e.g. wisdom). Then the search is for that word, and titles must name it.
  const topic = (url.searchParams.get('topic') || '').toLowerCase().replace(/[^a-z ]/g, '').trim().slice(0, 30);
  const api = new URL('https://www.googleapis.com/youtube/v3/search');
  api.search = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', videoSyndicated: 'true', relevanceLanguage: 'en', maxResults: '25', q: topic ? `BibleProject ${topic}` : who.q(m[1], m[2], m[3] || '1'), key: env.YOUTUBE_KEY });
  const r = await fetch(api);
  const d = await r.json();
  if (!r.ok) return { status: 502, body: { error: d.error?.message || `YouTube returned ${r.status}.` } };
  // Keep only the creator's main channel, and only videos whose title names the book.
  const book = m[1].replace(/^([1-3])\s?/, '$1 ').trim().toLowerCase();
  const decode = t => t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const list = (d.items || []).filter(x => who.channel.test(x.snippet?.channelTitle || '') && decode(x.snippet?.title || '').toLowerCase().includes(topic || book)).slice(0, 4).map(x => ({
    id: x.id.videoId, title: x.snippet.title, channel: x.snippet.channelTitle, published: x.snippet.publishedAt,
    thumb: x.snippet.thumbnails?.medium?.url || x.snippet.thumbnails?.default?.url,
  }));
  return { status: 200, body: { ref, creator: who.name, videos: list } };
}

// Daily follow-along video: the newest upload from a fixed channel, read from its uploads playlist
// (1 API unit per call, cached 1 hour). Always the newest upload. Only channels listed here can be asked for.
const DAILY = {
  gator: { name: 'Gator', uploads: 'UUKQTBJUAPK5pvSbsNrn_sHg' },
};
const HOUR = 60 * 60;
async function daily(url, env) {
  const who = DAILY[url.searchParams.get('source') || ''];
  if (!who) return { status: 400, body: { error: 'Unknown video source.' } };
  if (!env.YOUTUBE_KEY) return { status: 500, body: { error: 'Video search is not set up yet.' } };
  const api = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
  api.search = new URLSearchParams({ part: 'snippet,contentDetails', playlistId: who.uploads, maxResults: '25', key: env.YOUTUBE_KEY });
  const r = await fetch(api);
  const d = await r.json();
  if (!r.ok) return { status: 502, body: { error: d.error?.message || `YouTube returned ${r.status}.` } };
  const list = (d.items || [])
    .filter(x => x.contentDetails?.videoId && !/^(private|deleted) video$/i.test(x.snippet?.title || ''))
    .map(x => ({ id: x.contentDetails.videoId, title: x.snippet.title, published: x.contentDetails.videoPublishedAt || x.snippet.publishedAt,
      thumb: x.snippet.thumbnails?.medium?.url || x.snippet.thumbnails?.default?.url }))
    .sort((a, b) => (b.published || '').localeCompare(a.published || ''));
  if (!list.length) return { status: 502, body: { error: 'No videos found on that channel.' } };
  return { status: 200, body: { source: who.name, video: list[0] } };
}

// Only Telmyn may use the service: browsers send Origin or Referer, and anything else is refused,
// so nobody can spend the YouTube quota or use the relay by calling it directly.
function fromTelmyn(req) {
  let o = req.headers.get('Origin');
  if (!o) { try { o = new URL(req.headers.get('Referer') || '').origin; } catch { o = ''; } }
  return ALLOWED_ORIGINS.includes(o) || TEST_ORIGIN.test(o);
}

// Replacement instructional videos: only ones YouTube allows to play inside other apps (embeddable and syndicated),
// 4 to 20 minutes long so Shorts never come back. 100 API units per search, cached 30 days.
async function search(url, env) {
  const q = (url.searchParams.get('q') || '').trim();
  if (!q || q.length > 80) return { status: 400, body: { error: 'Bad search.' } };
  if (!env.YOUTUBE_KEY) return { status: 500, body: { error: 'Video search is not set up yet.' } };
  const api = new URL('https://www.googleapis.com/youtube/v3/search');
  api.search = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', videoSyndicated: 'true', videoDuration: 'medium',
    safeSearch: 'strict', relevanceLanguage: 'en', maxResults: '6', q, key: env.YOUTUBE_KEY });
  const r = await fetch(api);
  const d = await r.json();
  if (!r.ok) return { status: 502, body: { error: d.error?.message || `YouTube returned ${r.status}.` } };
  const list = (d.items || []).filter(x => x.id?.videoId).map(x => ({ id: x.id.videoId, title: x.snippet.title, channel: x.snippet.channelTitle,
    thumb: x.snippet.thumbnails?.medium?.url || x.snippet.thumbnails?.default?.url }));
  return { status: 200, body: { q, videos: list } };
}

// Videos on the day's passage from any teacher: the title must name the passage (book and chapter, ideally the
// verse), the video must be allowed to play inside apps, and it must be longer than 90 seconds (no Shorts).
// Well-known Bible teachers rank first; anyone else is included only when the title names the passage.
// One search (100 units) plus one details lookup (1 unit), cached 30 days.
const TRUSTED = /^(BibleProject|Desiring God|Ligonier Ministries|Mike Winger|GotQuestions\.org|Truth For Life|The Bible Recap|Grace to You|Gospel in Life|Alistair Begg)$/i;
const seconds = iso => { const m = (iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
async function passage(url, env) {
  const ref = url.searchParams.get('ref') || '';
  const m = ref.match(/^([1-3]?\s?[A-Za-z ]+?)\s(\d+):(\d+)(?:-(\d+))?$/);
  if (!m) return { status: 400, body: { error: 'Bad reference.' } };
  if (!env.YOUTUBE_KEY) return { status: 500, body: { error: 'Video search is not set up yet.' } };
  const [, book, ch, v1, v2] = m;
  const api = new URL('https://www.googleapis.com/youtube/v3/search');
  api.search = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', videoSyndicated: 'true', safeSearch: 'strict',
    relevanceLanguage: 'en', maxResults: '25', q: `${book} ${ch}:${v1}`, key: env.YOUTUBE_KEY });
  const r = await fetch(api);
  const d = await r.json();
  if (!r.ok) return { status: 502, body: { error: d.error?.message || `YouTube returned ${r.status}.` } };
  const decode = t => t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const bookRe = book.replace(/\s+/g, '\\s*');
  const titleRe = new RegExp(`\\b${bookRe}\\s*(?:chapter\\s*)?${ch}(?::(\\d+)(?:\\s*[-–]\\s*(\\d+))?)?\\b`, 'i');
  const want = [Number(v1), Number(v2 || v1)];
  const scored = (d.items || []).map(x => {
    const title = decode(x.snippet?.title || '');
    const t = title.match(titleRe);
    if (!t) return null;
    const a = t[1] ? Number(t[1]) : null, b = t[2] ? Number(t[2]) : a;
    const covers = a === null ? 1 : (a <= want[1] && (b ?? a) >= want[0] ? 3 : 0);
    if (!covers) return null;
    return { id: x.id.videoId, title, channel: x.snippet.channelTitle, thumb: x.snippet.thumbnails?.medium?.url || x.snippet.thumbnails?.default?.url,
      on: a === null ? 'chapter' : 'verse', score: covers + (TRUSTED.test(x.snippet.channelTitle || '') ? 2 : 0) };
  }).filter(Boolean);
  if (scored.length) {
    const det = new URL('https://www.googleapis.com/youtube/v3/videos');
    det.search = new URLSearchParams({ part: 'contentDetails', id: scored.map(x => x.id).join(','), key: env.YOUTUBE_KEY });
    const dd = await (await fetch(det)).json().catch(() => ({}));
    const long = new Set((dd.items || []).filter(x => seconds(x.contentDetails?.duration) > 90).map(x => x.id));
    for (const x of scored) x.keep = long.has(x.id);
  }
  const list = scored.filter(x => x.keep).sort((a, b) => b.score - a.score).slice(0, 8).map(({ keep, score, ...x }) => x);
  return { status: 200, body: { ref, videos: list } };
}

async function handle(req, ctx, env) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  if (url.pathname !== '/' && !fromTelmyn(req)) return json(req, { error: 'Not allowed.' }, 403);
  // Push reminders; never cached.
  if (url.pathname.startsWith('/push/')) return pushRoute(req, url, env, (r, b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(r) } }));

  const cache = caches.default;
  const hit = await cache.match(req);
  if (hit) return hit;

  let res;
  if (url.pathname === '/verse') {
    const ref = url.searchParams.get('ref') || '';
    const v = (url.searchParams.get('v') || 'NKJV').toUpperCase();
    if (!/^[1-3]?\s?[A-Za-z ]+\s\d+(:\d+(-\d+)?)?$/.test(ref) || !/^[A-Z0-9-]{2,12}$/.test(v)) return json(req, { error: 'Bad reference or version.' }, 400);
    const page = `${BG}/passage/?search=${encodeURIComponent(ref)}&version=${encodeURIComponent(v)}`;
    const r = await fetch(page, { headers: { 'User-Agent': UA } });
    if (!r.ok) return json(req, { error: `Bible Gateway returned ${r.status}.` }, 502);
    const p = await parsePassage(await r.text());
    if (!p.text) return json(req, { error: 'No verse text found on the page. The page layout may have changed.', source: page }, 502);
    res = json(req, { ref, version: v, ...p, source: page });
  } else if (url.pathname === '/videos') {
    const out = await videos(url, env);
    if (out.status !== 200) return json(req, out.body, out.status);
    res = new Response(JSON.stringify(out.body), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${MONTH}`, ...cors(req) } });
  } else if (url.pathname === '/passage') {
    const out = await passage(url, env);
    if (out.status !== 200) return json(req, out.body, out.status);
    res = new Response(JSON.stringify(out.body), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${MONTH}`, ...cors(req) } });
  } else if (url.pathname === '/search') {
    const out = await search(url, env);
    if (out.status !== 200) return json(req, out.body, out.status);
    res = new Response(JSON.stringify(out.body), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${MONTH}`, ...cors(req) } });
  } else if (url.pathname === '/daily') {
    const out = await daily(url, env);
    if (out.status !== 200) return json(req, out.body, out.status);
    res = new Response(JSON.stringify(out.body), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${HOUR}`, ...cors(req) } });
  } else if (url.pathname === '/versions') {
    const list = await versions();
    if (!list.length) return json(req, { error: 'Could not read the version list.' }, 502);
    res = json(req, { versions: list });
  } else {
    return json(req, { ok: true, routes: ['/verse?ref=Galatians%206:9&v=NKJV', '/versions', '/videos?ref=Galatians%206:9&creator=bibleproject', '/daily?source=gator', '/search?q=scapular%20pull%20up', '/passage?ref=James%201:5'] });
  }
  ctx.waitUntil(cache.put(req, res.clone()));
  return res;
}

export default {
  fetch: (req, env, ctx) => handle(req, ctx, env).catch(e => json(req, { error: e.message }, 500)),
  // Every minute: send any reminder that is due (push.js).
  scheduled: (event, env, ctx) => ctx.waitUntil(pushTick(env)),
};
