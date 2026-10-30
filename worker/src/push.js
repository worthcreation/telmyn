// Push reminders: the Worker checks every minute and, when something is overdue, sends an urgent push that carries
// the reminders themselves, encrypted for the phone (Web Push, RFC 8291). One subscription per copy of the app
// (live, test), kept in KV under push:<site>. Only what the rules need is stored: the phone's push address, its UTC
// offset, and the last times of a grip break, ankle pumps and a weight.
// Rules (owner's choice, Oct 2026): grip break after 60 min, ankle pumps after 30 min, weekdays 08:00-17:00 local;
// weight once from 06:00 local when nothing is logged that day.

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
  const r = await fetch(sub.endpoint, { method: 'POST', body, headers: { Authorization: await vapidHeader(sub.endpoint, env), TTL: '120', Urgency: 'high',
    'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' } });
  return r.status;
}

// Local clock for the phone's time zone, from the offset it reports (minutes, as Date.getTimezoneOffset gives them).
function local(now, offsetMin) {
  const d = new Date(now - offsetMin * 60000);
  return { day: d.getUTCDay(), hm: d.toISOString().slice(11, 16), date: d.toISOString().slice(0, 10),
    at: hm => Date.parse(`${d.toISOString().slice(0, 10)}T${hm}:00Z`) + offsetMin * 60000 };
}

// What is due right now, given the stored state. Each kind is sent at most once per its interval.
export function due(rec, now = Date.now()) {
  const out = [];
  const L = local(now, rec.offset || 0);
  const s = rec.state || {}, sent = rec.sent || {};
  const workday = L.day >= 1 && L.day <= 5 && L.hm >= '08:00' && L.hm < '17:00';
  if (workday) {
    const start = L.at('08:00');
    const lastGrip = Math.max(s.grip || 0, start), lastPumps = Math.max(s.pumps || 0, start);
    if (now - lastGrip >= 60 * 60000 && now - (sent.grip || 0) >= 60 * 60000) out.push({ kind: 'grip', title: 'Grip break', body: s.grip && s.grip > start ? 'It has been an hour since the last one.' : 'First grip break of the day.' });
    if (now - lastPumps >= 30 * 60000 && now - (sent.pumps || 0) >= 30 * 60000) out.push({ kind: 'pumps', title: 'Ankle pumps', body: 'Time for a set. It has been over 30 minutes.' });
  }
  if (L.hm >= '06:00' && s.weight !== L.date && sent.weight !== L.date) out.push({ kind: 'weight', title: 'Weight', body: 'Nothing logged today. Tap Weight on Today.' });
  return out;
}

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
    Object.assign(rec, { sub: body.sub, offset: body.offset ?? rec.offset ?? 0, state: { ...(rec.state || {}), ...(body.state || {}) } });
  } else if (url.pathname === '/push/state') {
    Object.assign(rec, { offset: body.offset ?? rec.offset ?? 0, state: { ...(rec.state || {}), ...(body.state || {}) } });
  } else return json(req, { error: 'Unknown.' }, 404);
  await env.PUSH.put(key, JSON.stringify(rec));
  return json(req, { ok: true });
}

export async function pushTick(env) {
  if (!env.PUSH || !env.VAPID_PRIVATE) return;
  for (const site of ['live', 'test']) {
    const key = `push:${site}`;
    const rec = await env.PUSH.get(key, 'json');
    if (!rec?.sub) continue;
    const now = Date.now();
    const list = due(rec, now);
    if (!list.length) continue;
    rec.sent ||= {};
    for (const d of list) rec.sent[d.kind] = d.kind === 'weight' ? local(now, rec.offset || 0).date : now;
    delete rec.pending;
    await env.PUSH.put(key, JSON.stringify(rec));
    const status = await send(rec.sub, env, list);
    if (status === 404 || status === 410) await env.PUSH.delete(key);   // the phone dropped the subscription
  }
}
