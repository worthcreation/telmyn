// Cloud copy of the daily log (0.16). The phone sends each day it changes; Claude reads the recent days through one
// private link. Stored in D1 (binding DB): one row per site and date, holding the handoff text and the day's records.
// Two keys, both Worker secrets made by tools/sync-setup.ps1: SYNC_WRITE lives only on the phone and can only write;
// SYNC_READ is in the link pasted into chat and can only read. Phase 3 (Claude connector) replaces the link with sign-in.
//   POST /sync/day?site=live   Authorization: Bearer SYNC_WRITE   { date, handoff, data }
//   GET  /sync/read?k=SYNC_READ[&days=7][&site=live]  -> plain text, newest day first

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SITES = ['live', 'test'];
let ready = false;

async function schema(env) {
  if (ready) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS days (site TEXT NOT NULL, date TEXT NOT NULL, handoff TEXT, data TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (site, date))').run();
  ready = true;
}

// Compare keys without leaking how much of a guess was right.
export function sameKey(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// The text Claude reads: a header, then each day's handoff, newest first.
export function readText(rows, readAt) {
  if (!rows.length) return `TELMYN SYNC (read ${readAt})\nNo days synced yet.\n`;
  return `TELMYN SYNC (read ${readAt}, ${rows.length} day${rows.length === 1 ? '' : 's'}, newest first)\n\n` +
    rows.map(r => `${r.handoff}\nSYNCED_AT: ${r.updated_at}${r.app ? ` | app ${r.app}` : ''}${r.device ? `\nDEVICE: ${r.device}` : ''}`).join('\n\n----------\n\n') + '\n';
}

export async function syncRoute(req, url, env, json) {
  if (!env.DB || !env.SYNC_WRITE || !env.SYNC_READ) return json(req, { error: 'Sync is not set up yet.' }, 503);
  const site = SITES.includes(url.searchParams.get('site')) ? url.searchParams.get('site') : 'live';
  await schema(env);

  if (url.pathname === '/sync/day' && req.method === 'POST') {
    const key = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!sameKey(key, env.SYNC_WRITE)) return json(req, { error: 'Wrong sync key.' }, 401);
    const b = await req.json().catch(() => null);
    if (!b || !DAY.test(b.date || '') || typeof b.handoff !== 'string') return json(req, { error: 'Bad day.' }, 400);
    const data = JSON.stringify(b.data ?? null);
    if (data.length > 500000 || b.handoff.length > 50000) return json(req, { error: 'Day too large.' }, 413);
    const at = new Date().toISOString();
    await env.DB.prepare('INSERT INTO days (site, date, handoff, data, updated_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT (site, date) DO UPDATE SET handoff = ?3, data = ?4, updated_at = ?5')
      .bind(site, b.date, b.handoff, data, at).run();
    return json(req, { ok: true, date: b.date, at });
  }

  if (url.pathname === '/sync/read' && req.method === 'GET') {
    const plain = (body, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
    if (!sameKey(url.searchParams.get('k') || '', env.SYNC_READ)) return plain('Wrong or missing key.\n', 401);
    const n = Math.min(Math.max(parseInt(url.searchParams.get('days') || '7', 10) || 7, 1), 60);
    const { results } = await env.DB.prepare("SELECT date, handoff, updated_at, json_extract(data, '$.app') AS app, json_extract(data, '$.device') AS device FROM days WHERE site = ?1 ORDER BY date DESC LIMIT ?2").bind(site, n).all();
    return plain(readText(results || [], new Date().toISOString()));
  }

  return json(req, { error: 'Not found.' }, 404);
}
