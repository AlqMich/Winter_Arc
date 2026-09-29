// Pruebas del servidor de notificaciones: node tests/push.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { encrypt, decrypt, b64u, vapidHeader, generateVapidKeys } from '../netlify/lib/webpush.mjs';
import { dueReminders, compose, plan, localParts } from '../netlify/lib/engine.mjs';
import { setStore } from '../netlify/lib/store.mjs';

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('  ✓', name); };

console.log('Cifrado Web Push');
await test('coincide con el vector de prueba del RFC 8291', () => {
  const out = encrypt(b64u.dec('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24'),
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', 'BTBZMqHH6r4Tts7J_aSIgg',
    { asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', salt: 'DGv6ra1nlYgDCS1FRnbzlw' });
  assert.equal(b64u.enc(out), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
});
await test('ida y vuelta con llaves aleatorias', () => {
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = b64u.enc(crypto.randomBytes(16));
  const msg = JSON.stringify({ title: 'Agua', body: 'Llevas 1 de 2.5 L' });
  const body = encrypt(msg, b64u.enc(ua.getPublicKey()), auth);
  assert.equal(decrypt(body, b64u.enc(ua.getPrivateKey()), auth), msg);
});
await test('JWT VAPID válido (ES256)', () => {
  const k = generateVapidKeys();
  const h = vapidHeader('https://web.push.apple.com/abc', k, 'https://x.netlify.app');
  const [, t, kpart] = h.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(kpart, k.publicKey);
  const [hd, pl, sg] = t.split('.');
  const pub = b64u.dec(k.publicKey);
  const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u.enc(pub.subarray(1, 33)), y: b64u.enc(pub.subarray(33)) }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(`${hd}.${pl}`), { key, dsaEncoding: 'ieee-p1363' }, b64u.dec(sg)));
  assert.equal(JSON.parse(b64u.dec(pl)).aud, 'https://web.push.apple.com');
});

console.log('Motor de recordatorios');
const TZ = 'America/Mexico_City';
// 2026-09-30 es miércoles. CDMX = UTC-6.
const at = (hhmm, day = '2026-09-30') => new Date(`${day}T${hhmm}:00-06:00`);
const rec = (reminders, status) => ({ tz: TZ, reminders, status, arc: { startDate: '2026-09-29', durationDays: 90 }, plan: { 3: ['Entrenar', 'Agua', 'Lectura'] } });

await test('hora local correcta en CDMX', () => {
  const p = localParts(at('07:00'), TZ);
  assert.deepEqual(p, { date: '2026-09-30', min: 420, dow: 3 });
});
await test('dispara solo dentro de la ventana de 5 min', () => {
  const r = rec([{ id: 'w', kind: 'wake', enabled: true, time: '07:00', days: [] }]);
  assert.equal(dueReminders(r, at('06:55'), at('07:00')).length, 1);
  assert.equal(dueReminders(r, at('07:00'), at('07:05')).length, 0);
  assert.equal(dueReminders(r, at('06:50'), at('06:55')).length, 0);
});
await test('respeta días activos', () => {
  const r = rec([{ id: 'x', kind: 'workout', enabled: true, time: '18:00', days: [1, 2] }]);
  assert.equal(dueReminders(r, at('17:58'), at('18:03')).length, 0);
});
await test('cruza medianoche', () => {
  const r = rec([{ id: 'm', kind: 'custom', enabled: true, time: '23:59', title: 'x' }]);
  assert.equal(dueReminders(r, at('23:57', '2026-09-30'), at('00:02', '2026-10-01')).length, 1);
});
await test('agua cada 2 h de 10:00 a 20:00 = 6 avisos', () => {
  const r = rec([{ id: 'a', kind: 'water', enabled: true, time: '10:00', until: '20:00', every: 120 }]);
  let c = 0; for (let h = 9; h <= 21; h++) for (let m = 0; m < 60; m += 5) {
    const t = at(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    c += dueReminders(r, new Date(t - 5 * 60000), t).length;
  }
  assert.equal(c, 6);
});
await test('inteligente: agua completa → no envía; incompleta → dice cuánto llevas', () => {
  const wr = { id: 'a', kind: 'water', enabled: true, time: '10:00' };
  assert.equal(compose(rec([wr], { date: '2026-09-30', water: { value: 2.5, target: 2.5, unit: 'L' } }), wr, '2026-09-30'), null);
  const p = compose(rec([wr], { date: '2026-09-30', water: { value: 1, target: 2.5, unit: 'L' } }), wr, '2026-09-30');
  assert.match(p.body, /Llevas 1 de 2\.5 L/);
});
await test('estado de ayer = todo pendiente', () => {
  const wk = { id: 'w', kind: 'workout', enabled: true, time: '18:00' };
  assert.equal(compose(rec([wk], { date: '2026-09-29', workoutDone: true }), wk, '2026-09-30').title, 'Hora de entrenar');
  assert.equal(compose(rec([wk], { date: '2026-09-30', workoutDone: true }), wk, '2026-09-30'), null);
});
await test('cerrar el día lista lo pendiente', () => {
  const c = { id: 'c', kind: 'close', enabled: true, time: '21:00' };
  const p = compose(rec([c], { date: '2026-09-30', closed: false, habits: { a: { name: 'Lectura', done: false }, b: { name: 'Orden', done: true } } }), c, '2026-09-30');
  assert.match(p.body, /Te falta: Lectura\./);
});
await test('despertar muestra día del reto y plan', () => {
  const w = { id: 'w', kind: 'wake', enabled: true, time: '07:00' };
  const p = compose(rec([w]), w, '2026-09-30');
  assert.equal(p.title, 'Buenos días · Día 2 de 90');
  assert.match(p.body, /Entrenar, Agua, Lectura/);
});
await test('no repite un aviso ya enviado', () => {
  const r = rec([{ id: 'w', kind: 'wake', enabled: true, time: '07:00' }]);
  r.sent = ['w@2026-09-30T07:00'];
  assert.equal(plan(r, at('06:55'), at('07:00')).length, 0);
});

console.log('Servidor (API + cron) con store en memoria');
const mem = new Map();
setStore({
  get: async (k) => (mem.has(k) ? structuredClone(mem.get(k)) : null),
  setJSON: async (k, v) => { mem.set(k, structuredClone(v)); },
  delete: async (k) => { mem.delete(k); },
  list: async ({ prefix }) => ({ blobs: [...mem.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }),
});
const api = (await import('../netlify/functions/push-api.mjs')).default;
const { run } = await import('../netlify/functions/push-cron.mjs');
const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
const auth = b64u.enc(crypto.randomBytes(16));
const id = 'test_device_0123456789';
const sent = [];
globalThis.fetch = async (url, opts) => { sent.push({ url, opts }); return new Response('', { status: 201 }); };
const post = (path, body) => api(new Request(`https://x.netlify.app/api/push/${path}`, { method: 'POST', body: JSON.stringify(body) }));

await test('GET key crea y reutiliza llaves VAPID', async () => {
  const r1 = await (await api(new Request('https://x/api/push/key'))).json();
  const r2 = await (await api(new Request('https://x/api/push/key'))).json();
  assert.equal(r1.publicKey, r2.publicKey);
  assert.equal(b64u.dec(r1.publicKey).length, 65);
});
await test('subscribe + sync + test', async () => {
  const sub = { endpoint: 'https://web.push.apple.com/QK_test', keys: { p256dh: b64u.enc(ua.getPublicKey()), auth } };
  assert.equal((await post('subscribe', { id, subscription: sub, tz: TZ, reminders: [{ id: 'w', kind: 'wake', enabled: true, time: '07:00' }], arc: { startDate: '2026-09-29', durationDays: 90 } })).status, 200);
  assert.equal((await post('sync', { id, status: { date: '2026-09-30', closed: false } })).status, 200);
  const t = await post('test', { id });
  assert.equal(t.status, 200);
  const last = sent[sent.length - 1];
  assert.match(last.opts.headers.Authorization, /^vapid t=/);
  const msg = JSON.parse(decrypt(Buffer.from(last.opts.body), b64u.enc(ua.getPrivateKey()), auth));
  assert.equal(msg.title, 'Winter Arc');
});
await test('id inválido rechazado', async () => {
  assert.equal((await post('sync', { id: '../x' })).status, 400);
});
await test('cron envía a las 07:00 y no repite', async () => {
  sent.length = 0;
  mem.set('meta/lastRun', { at: at('06:55').toISOString() });
  await run(at('07:00'));
  assert.equal(sent.length, 1);
  const msg = JSON.parse(decrypt(Buffer.from(sent[0].opts.body), b64u.enc(ua.getPrivateKey()), auth));
  assert.equal(msg.title, 'Buenos días · Día 2 de 90');
  mem.set('meta/lastRun', { at: at('06:55').toISOString() });
  await run(at('07:00'));
  assert.equal(sent.length, 1);
});
await test('suscripción caducada (410) se elimina', async () => {
  globalThis.fetch = async () => new Response('', { status: 410 });
  mem.set('meta/lastRun', { at: at('20:55').toISOString() });
  const r = mem.get(`subs/${id}`); r.reminders.push({ id: 'c', kind: 'close', enabled: true, time: '21:00' }); mem.set(`subs/${id}`, r);
  await run(at('21:00'));
  assert.equal(mem.has(`subs/${id}`), false);
});
console.log(`\n${n} pruebas OK`);
