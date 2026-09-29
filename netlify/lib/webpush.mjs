// Web Push sin dependencias (RFC 8291 aes128gcm + VAPID RFC 8292) usando node:crypto.
import crypto from 'node:crypto';

export const b64u = {
  enc: (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
};

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

/** Genera un par de llaves VAPID (P-256). Devuelve base64url: publicKey (65 bytes sin comprimir) y privateKey (32 bytes). */
export function generateVapidKeys() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { publicKey: b64u.enc(ecdh.getPublicKey()), privateKey: b64u.enc(ecdh.getPrivateKey()) };
}

/**
 * Cifra el payload para una suscripción (RFC 8291). `asKeys` y `salt` solo se pasan en pruebas.
 * @returns {Buffer} cuerpo listo para enviar con Content-Encoding: aes128gcm
 */
export function encrypt(plaintext, uaPublicB64, authB64, { asPrivate, salt } = {}) {
  const uaPublic = b64u.dec(uaPublicB64);
  const auth = b64u.dec(authB64);
  const ecdh = crypto.createECDH('prime256v1');
  if (asPrivate) ecdh.setPrivateKey(b64u.dec(asPrivate)); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  salt = salt ? b64u.dec(salt) : crypto.randomBytes(16);

  const prkKey = hmac(auth, shared);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]);
  const ikm = hmac(prkKey, keyInfo);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(plaintext), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/** Descifra (lado del navegador). Solo se usa en pruebas para validar el cifrado de ida y vuelta. */
export function decrypt(body, uaPrivateB64, authB64) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const data = body.subarray(21 + idlen);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(b64u.dec(uaPrivateB64));
  const uaPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(asPublic);
  const prkKey = hmac(b64u.dec(authB64), shared);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(data.subarray(data.length - 16));
  const out = Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  return out.subarray(0, out.lastIndexOf(2)).toString();
}

/** JWT VAPID firmado con ES256. */
export function vapidHeader(endpoint, keys, subject) {
  const aud = new URL(endpoint).origin;
  const header = b64u.enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64u.enc(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const pub = b64u.dec(keys.publicKey);
  const key = crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: keys.privateKey, x: b64u.enc(pub.subarray(1, 33)), y: b64u.enc(pub.subarray(33, 65)) },
    format: 'jwk',
  });
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${payload}.${b64u.enc(sig)}, k=${keys.publicKey}`;
}

/**
 * Envía una notificación. Devuelve { ok, status, gone } — gone=true si la suscripción ya no existe.
 */
export async function sendPush(subscription, payload, keys, subject, { ttl = 3600, fetchImpl = fetch } = {}) {
  const body = encrypt(JSON.stringify(payload), subscription.keys.p256dh, subscription.keys.auth);
  const res = await fetchImpl(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'high',
      Authorization: vapidHeader(subscription.endpoint, keys, subject),
    },
    body,
  });
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
