// Makes the VAPID key pair push needs and writes it as a secrets file for `wrangler secret bulk`.
// The private key goes only to Cloudflare as a Worker secret; the file is deleted right after upload.
import { webcrypto as c } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const kp = await c.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const raw = Buffer.from(await c.subtle.exportKey('raw', kp.publicKey)).toString('base64url');
const jwk = await c.subtle.exportKey('jwk', kp.privateKey);
writeFileSync(process.argv[2], JSON.stringify({ VAPID_PUBLIC: raw, VAPID_PRIVATE: JSON.stringify(jwk) }));
console.log('VAPID keys made.');
