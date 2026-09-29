// Se ejecuta cada 5 minutos: revisa los recordatorios de cada teléfono y envía los que tocan.
import { store, vapidKeys, subject } from '../lib/store.mjs';
import { plan } from '../lib/engine.mjs';
import { sendPush } from '../lib/webpush.mjs';

export async function run(now = new Date()) {
  const s = await store();
  const meta = (await s.get('meta/lastRun', { type: 'json' })) || {};
  // Ventana (último run, ahora]. Si hubo una pausa larga, no mandamos avisos viejos en ráfaga.
  const last = meta.at ? new Date(meta.at) : new Date(now.getTime() - 5 * 60000);
  const from = now.getTime() - last.getTime() > 20 * 60000 ? new Date(now.getTime() - 6 * 60000) : last;
  const keys = await vapidKeys(s);
  const { blobs } = await s.list({ prefix: 'subs/' });
  const report = [];
  for (const b of blobs) {
    const rec = await s.get(b.key, { type: 'json' });
    if (!rec?.subscription) continue;
    const todo = plan(rec, from, now);
    if (!todo.length) continue;
    let gone = false;
    for (const t of todo) {
      if (t.payload) {
        try {
          const r = await sendPush(rec.subscription, t.payload, keys, subject());
          report.push({ id: rec.id.slice(0, 6), key: t.key, status: r.status });
          if (r.gone) { gone = true; break; }
        } catch (e) {
          report.push({ id: rec.id.slice(0, 6), key: t.key, error: String(e) });
        }
      }
    }
    if (gone) { await s.delete(b.key); continue; }
    // Releer antes de escribir: la app pudo sincronizar mientras enviábamos.
    const fresh = (await s.get(b.key, { type: 'json' })) || rec;
    fresh.sent = [...(fresh.sent || []), ...todo.map((t) => t.key)].slice(-200);
    await s.setJSON(b.key, fresh);
  }
  await s.setJSON('meta/lastRun', { at: now.toISOString() });
  return report;
}

export default async () => {
  const report = await run();
  if (report.length) console.log(JSON.stringify(report));
  return new Response('ok');
};

export const config = { schedule: '*/5 * * * *' };
