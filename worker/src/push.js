// Push reminders: the Worker checks every minute and, when something is overdue, sends an urgent push that carries
// the reminders themselves, encrypted for the phone (Web Push, RFC 8291). One subscription per copy of the app
// (live, test), kept in KV under push:<site>. Only what the rules need is stored: the phone's push address, its UTC
// offset, the last times of a grip break, ankle pumps, calf raises and a weight, and the habit amounts to show.
// Rules: js/reminder-rules.js (one copy for the Worker and the app).
import { due } from '../../js/reminder-rules.js';

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = s => new TextEncoder().encode(s);

// VAPID: the Worker proves to the push service that the push comes from Telmyn. ES256 over a short-lived token.
async function vapidHeader(endpoint, env) {
  const jwk = JSON.parse(env.VAPID_PRIVATE);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:breedlove@worthcreation.com' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
}

const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const cat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
async function hkdf(salt, ikm, info, bytes) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, bytes * 8));
}

// Encrypt a payload for one subscription (aes128gcm, RFC 8291). Only that phone can read it.
export async function encryptPayload(sub, text) {
  const uaPublic = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(auth, shared, cat(enc('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(enc(text), new Uint8Array([2]))));
  const head = new Uint8Array(21); head.set(salt); new DataView(head.buffer).setUint32(16, 4096); head[20] = asPublic.length;
  return cat(head, asPublic, sealed);
}

async function send(sub, env, list) {
  const body = await encryptPayload(sub, JSON.stringify(list));
  const r = await fetch(sub.endpoint, { method: 'POST', body, headers: { Authorization: await vapidHeader(sub.endpoint, env), TTL: '900', Urgency: 'high',
    'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' } });
  return r.status;
}

// The rules (what is due, when, and the 15 min follow-ups) live in js/reminder-rules.js, shared with the app.
export { due };

export async function pushRoute(req, url, env, json) {
  const site = url.searchParams.get('site') === 'test' ? 'test' : 'live';
  const key = `push:${site}`;
  if (!env.PUSH) return json(req, { error: 'Push is not set up yet.' }, 503);
  if (url.pathname === '/push/key') return json(req, { key: env.VAPID_PUBLIC || null });
  const rec = (await env.PUSH.get(key, 'json')) || {};
  if (req.method !== 'POST') return json(req, { error: 'POST only.' }, 405);
  const body = await req.json().catch(() => ({}));
  if (url.pathname === '/push/subscribe') {
    if (body.off) { await env.PUSH.delete(key); return json(req, { ok: true, off: true }); }
    if (!body.sub?.endpoint) return json(req, { error: 'No subscription.' }, 400);
    Object.assign(rec, { sub: body.sub, offset: body.offset ?? rec.offset ?? 0, state: { ...(rec.state || {}), ...(body.state || {}) }, reported: Date.now() });
  } else if (url.pathname === '/push/state') {
    Object.assign(rec, { offset: body.offset ?? rec.offset ?? 0, state: { ...(rec.state || {}), ...(body.state || {}) }, reported: Date.now() });
  } else return json(req, { error: 'Unknown.' }, 404);
  await env.PUSH.put(key, JSON.stringify(rec));
  return json(req, { ok: true });
}

export async function pushTick(env) {
  if (!env.PUSH || !env.VAPID_PRIVATE) return;
  // Heartbeat for the report below, written every tenth minute (KV writes are limited; the cron runs every minute).
  if (new Date().getUTCMinutes() % 10 === 0) await env.PUSH.put('push:tick', new Date().toISOString());
  for (const site of ['live', 'test']) {
    const key = `push:${site}`;
    const rec = await env.PUSH.get(key, 'json');
    if (!rec?.sub) continue;
    const now = Date.now();
    const list = due(rec, now);
    if (!list.length) continue;
    rec.sent ||= {};
    for (const d of list) rec.sent[d.kind] = now;   // follow-ups count from here
    delete rec.pending;
    await env.PUSH.put(key, JSON.stringify(rec));
    const status = await send(rec.sub, env, list);
    rec.last = { at: now, kinds: list.map(d => d.kind), status };   // what the report shows
    await env.PUSH.put(key, JSON.stringify(rec));
    if (status === 404 || status === 410) await env.PUSH.delete(key);   // the phone dropped the subscription
  }
}

// What the Worker knows about reminders, for the cloud copy read link (no keys, no addresses): is a phone
// subscribed, when it last reported, what it reported, what was sent and when, and when the cron last ran.
export async function pushReport(env) {
  if (!env.PUSH) return 'PUSH: not set up.';
  const tick = await env.PUSH.get('push:tick');
  const lines = [`PUSH (keys ${env.VAPID_PRIVATE ? 'set' : 'missing'}, cron last ran ${tick || 'never'} UTC)`];
  for (const site of ['live', 'test']) {
    const rec = await env.PUSH.get(`push:${site}`, 'json');
    if (!rec?.sub) { lines.push(`  ${site}: no subscription`); continue; }
    const off = rec.offset || 0, at = ms => (ms ? new Date(ms - off * 60000).toISOString().slice(0, 16).replace('T', ' ') : 'never');
    const s = rec.state || {}, sent = rec.sent || {};
    const host = (() => { try { return new URL(rec.sub.endpoint).host; } catch { return '?'; } })();
    lines.push(`  ${site}: subscribed via ${host}, phone offset ${off} min, reported at ${at(rec.reported)}`);
    lines.push(`    last logged: grip ${at(s.grip)} | pumps ${at(s.pumps)} | calf ${at(s.calf)} | weight ${s.weight || 'not today'} | creatine ${s.creatine ? `${s.creatine.taken} of ${s.creatine.times} on ${s.creatine.date}` : 'not reported'}`);
    lines.push(`    last reminded: grip ${at(sent.grip)} | pumps ${at(sent.pumps)} | calf ${at(sent.calf)} | weight ${at(typeof sent.weight === 'number' ? sent.weight : 0)} | creatine ${at(sent.creatine)}`);
    lines.push(`    last push: ${rec.last ? `${at(rec.last.at)} ${rec.last.kinds.join(',')} (push service said ${rec.last.status})` : 'none yet'}`);
  }
  return lines.join('\n');
}
