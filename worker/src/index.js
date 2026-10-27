// Telmyn API (Cloudflare Worker). Personal, non-commercial use.
// GET /verse?ref=Galatians%206:9&v=NKJV  -> { ref, version, text, verses[], copyright, source }
// GET /versions                         -> { versions: [{ abbr, name }] }
// Reads the public Bible Gateway passage page, keeps only the verse text, caches for 7 days.

const ALLOWED_ORIGINS = ['https://telmyn.worthcreation.com', 'http://localhost:8000'];
const BG = 'https://www.biblegateway.com';
const UA = 'Mozilla/5.0 (Telmyn personal app)';
const WEEK = 60 * 60 * 24 * 7;

function cors(req) {
  const o = req.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(o) ? o : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  bibleproject: { name: 'BibleProject', channel: /bibleproject/i, q: (b, c) => `BibleProject ${b}` },
  lookatthebook: { name: 'Look at the Book', channel: /desiring\s*god/i, q: (b, c, v) => `Look at the Book ${b} ${c}` },
  mikewinger: { name: 'Mike Winger', channel: /mike\s*winger/i, q: (b, c) => `Mike Winger ${b} ${c}` },
  gotquestions: { name: 'GotQuestions', channel: /gotquestions/i, q: (b, c, v) => `${b} ${c}:${v} GotQuestions` },
};
const MONTH = 60 * 60 * 24 * 30;

async function videos(url, env) {
  const ref = url.searchParams.get('ref') || '';
  const who = CREATORS[url.searchParams.get('creator') || ''];
  const m = ref.match(/^([1-3]?\s?[A-Za-z ]+?)\s(\d+)(?::(\d+))?/);
  if (!who || !m) return { status: 400, body: { error: 'Bad reference or creator.' } };
  if (!env.YOUTUBE_KEY) return { status: 500, body: { error: 'Video search is not set up yet.' } };
  const api = new URL('https://www.googleapis.com/youtube/v3/search');
  api.search = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '15', q: who.q(m[1], m[2], m[3] || '1'), key: env.YOUTUBE_KEY });
  const r = await fetch(api);
  const d = await r.json();
  if (!r.ok) return { status: 502, body: { error: d.error?.message || `YouTube returned ${r.status}.` } };
  const list = (d.items || []).filter(x => who.channel.test(x.snippet?.channelTitle || '')).slice(0, 4).map(x => ({
    id: x.id.videoId, title: x.snippet.title, channel: x.snippet.channelTitle, published: x.snippet.publishedAt,
    thumb: x.snippet.thumbnails?.medium?.url || x.snippet.thumbnails?.default?.url,
  }));
  return { status: 200, body: { ref, creator: who.name, videos: list } };
}

async function handle(req, ctx, env) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });

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
  } else if (url.pathname === '/versions') {
    const list = await versions();
    if (!list.length) return json(req, { error: 'Could not read the version list.' }, 502);
    res = json(req, { versions: list });
  } else {
    return json(req, { ok: true, routes: ['/verse?ref=Galatians%206:9&v=NKJV', '/versions', '/videos?ref=Galatians%206:9&creator=bibleproject'] });
  }
  ctx.waitUntil(cache.put(req, res.clone()));
  return res;
}

export default { fetch: (req, env, ctx) => handle(req, ctx, env).catch(e => json(req, { error: e.message }, 500)) };
