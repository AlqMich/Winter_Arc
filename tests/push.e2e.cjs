// Prueba de la pantalla Recordatorios contra el servidor local (tests/devserver.mjs).
const { chromium, devices } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const URL = process.argv[2] || 'http://localhost:4174/';
(async () => {
  const b = await chromium.launch({ channel: 'chromium' });
  const ctx = await b.newContext({ ...devices['iPhone 13'], userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/140 Safari/537.36' });
  await ctx.grantPermissions(['notifications'], { origin: URL.replace(/\/$/, '') });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const store = async () => (await (await fetch(URL + '__store')).json());
  await p.goto(URL);
  await p.getByRole('button', { name: 'Empezar' }).click();
  await p.locator('.tabbar').getByRole('button', { name: 'Más' }).click();
  await p.getByRole('button', { name: /Recordatorios/ }).click();
  await p.getByRole('button', { name: 'Activar notificaciones' }).waitFor();
  await p.screenshot({ path: 'shots/30-recordatorios.png', fullPage: true });
  console.log('  ✓ estado "Activar notificaciones" visible');

  // Activar un recordatorio y editar el de agua
  await p.getByRole('switch', { name: 'Activar Despertar' }).click();
  await p.getByRole('button', { name: /Tomar agua/ }).click();
  await p.fill('#r-time', '09:00');
  await p.getByRole('tab', { name: '1.5 h' }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
  await p.getByText('09:00–20:00 · cada 1.5 h').waitFor();
  console.log('  ✓ editar recordatorio de agua');
  // Nuevo personalizado
  await p.getByRole('button', { name: 'Nuevo' }).click();
  await p.fill('#r-title', 'Tomar creatina');
  await p.fill('#r-time', '08:15');
  await p.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
  await p.getByText('Tomar creatina').waitFor();
  console.log('  ✓ recordatorio personalizado');

  // Intentar suscripción real (en Chromium sin conexión a FCM puede fallar; entonces se simula)
  await p.getByRole('button', { name: 'Activar notificaciones' }).click();
  await p.waitForTimeout(4000);
  let s = await store();
  let id = Object.keys(s).find((k) => k.startsWith('subs/'));
  if (!id) {
    console.log('  · suscripción push no disponible en Chromium de prueba; se simula el registro');
    await p.evaluate(async () => {
      let id = localStorage.getItem('winter-arc:push-id'); if (!id) { id = 'e2e0123456789abcdef'; localStorage.setItem('winter-arc:push-id', id); }
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, subscription: { endpoint: 'https://web.push.apple.com/x', keys: { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' } } }) });
      localStorage.setItem('winter-arc:push-on', '1');
    });
  } else console.log('  ✓ suscripción real registrada');
  const failMsg = await p.locator('.toast').innerText().catch(() => '');
  if (failMsg) console.log('  · aviso mostrado al fallar la suscripción:', failMsg);

  // Registrar agua en Hoy y comprobar que el servidor recibe el estado
  await p.locator('.tabbar').getByRole('button', { name: 'Hoy' }).click();
  await p.locator('.habit-num', { hasText: 'Agua' }).getByRole('button', { name: 'Más' }).click();
  await p.locator('button.habit', { hasText: 'Orden' }).click();
  await p.waitForTimeout(5000);
  s = await store();
  id = Object.keys(s).find((k) => k.startsWith('subs/'));
  const rec = s[id];
  if (!rec?.status) throw new Error('el servidor no recibió el estado');
  if (rec.status.water.value !== 0.25) throw new Error('agua = ' + rec.status.water.value);
  if (!rec.status.habits.orden.done) throw new Error('orden no marcado');
  if (!rec.reminders.some((r) => r.title === 'Tomar creatina')) throw new Error('recordatorios no sincronizados');
  if (!rec.reminders.find((r) => r.id === 'wake').enabled) throw new Error('despertar no activo');
  if (!rec.tz) throw new Error('sin zona horaria');
  console.log(`  ✓ sincronización: agua ${rec.status.water.value}/${rec.status.water.target} L, tz ${rec.tz}, ${rec.reminders.length} recordatorios, plan ${Object.keys(rec.plan).length} días`);
  await b.close();
  if (errs.length) { console.log('ERRORES:', errs); process.exit(1); }
  console.log('Recordatorios OK');
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
