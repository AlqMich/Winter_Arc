// API de notificaciones: /api/push/key | subscribe | sync | test | unsubscribe
import { store, vapidKeys, subject } from '../lib/store.mjs';
import { sendPush } from '../lib/webpush.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{16,64}$/.test(id);

export default async (req) => {
  const action = new URL(req.url).pathname.split('/').pop();
  const s = await store();

  if (action === 'key' && req.method === 'GET') {
    const keys = await vapidKeys(s);
    return json({ publicKey: keys.publicKey });
  }
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (!validId(body.id)) return json({ error: 'id inválido' }, 400);
  const key = `subs/${body.id}`;
  const current = (await s.get(key, { type: 'json' })) || null;

  if (action === 'subscribe') {
    const sub = body.subscription;
    if (!sub || typeof sub.endpoint !== 'string' || !sub.keys?.p256dh || !sub.keys?.auth) return json({ error: 'Suscripción inválida' }, 400);
    const record = { ...(current || {}), id: body.id, subscription: sub, ...pick(body), sent: current?.sent || [], updatedAt: Date.now() };
    await s.setJSON(key, record);
    return json({ ok: true });
  }
  if (action === 'sync') {
    if (!current) return json({ ok: false, error: 'No suscrito' }, 404);
    await s.setJSON(key, { ...current, ...pick(body), updatedAt: Date.now() });
    return json({ ok: true });
  }
  if (action === 'unsubscribe') {
    await s.delete(key);
    return json({ ok: true });
  }
  if (action === 'test') {
    if (!current) return json({ ok: false, error: 'No suscrito' }, 404);
    const keys = await vapidKeys(s);
    const r = await sendPush(current.subscription, { title: 'Winter Arc', body: 'Notificaciones activadas. Así te llegarán tus recordatorios.', tag: 'test', url: './' }, keys, subject());
    if (r.gone) await s.delete(key);
    return json({ ok: r.ok, status: r.status }, r.ok ? 200 : 502);
  }
  return json({ error: 'Ruta no encontrada' }, 404);
};

/** Solo los campos que la app puede actualizar. */
function pick(b) {
  const out = {};
  for (const k of ['tz', 'reminders', 'status', 'arc', 'plan']) if (b[k] !== undefined) out[k] = b[k];
  if (Array.isArray(out.reminders)) out.reminders = out.reminders.slice(0, 40);
  return out;
}

export const config = { path: '/api/push/*' };
