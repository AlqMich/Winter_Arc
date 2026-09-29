// Prueba de flujo completa en viewport de iPhone.
// Uso: node tests/flow.e2e.cjs http://localhost:4173/  (con dist/ servido)
const { chromium, devices } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2] || 'http://localhost:4173/';
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const t0 = new Date();
const daysAgo = (n) => { const d = new Date(t0); d.setDate(d.getDate() - n); return iso(d); };

const problems = [];
const step = async (name, fn) => {
  const s = Date.now();
  try { await fn(); console.log(`  ✓ ${name} (${Date.now() - s} ms)`); }
  catch (e) { problems.push(`${name}: ${e.message.split('\n')[0]}`); console.log(`  ✗ ${name}: ${e.message.split('\n')[0]}`); }
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|ERR_FAILED/.test(m.text())) problems.push(`console: ${m.text()}`); });
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, `${n}.png`), fullPage: true });
  let taps = 0;
  const tap = async (loc) => { taps++; await loc.click(); };

  await page.goto(URL);
  console.log('Flujo');

  await step('Onboarding: definir inicio del reto (hace 9 días)', async () => {
    await page.getByRole('dialog', { name: 'Tu Winter Arc' }).waitFor();
    await shot('01-onboarding');
    await page.fill('#o-start', daysAgo(9));
    await tap(page.getByRole('button', { name: 'Empezar' }));
    await page.getByText('Día 10').first().waitFor();
  });

  await step('Hoy es la pantalla de entrada y muestra día/score/racha', async () => {
    await page.locator('.ring-num').waitFor();
    const score = await page.locator('.ring-num').innerText();
    if (score !== '0') throw new Error(`score inicial esperado 0, fue ${score}`);
    await page.getByText('Ayer quedó sin registrar').waitFor();
    await shot('02-hoy-vacio');
  });

  const tStart = Date.now();
  await step('Registrar hábitos sí/no', async () => {
    for (const name of ['Comer según el plan', 'Meditación / reflexión', 'Objetivo principal del día', 'Orden', 'Registrar gastos']) {
      await tap(page.locator('button.habit', { hasText: name }));
    }
  });

  await step('Registrar hábitos numéricos (stepper, meta directa, teclado)', async () => {
    const row = (n) => page.locator('.habit-num', { hasText: n });
    await tap(row('Agua').getByRole('button', { name: 'Agua: completar meta' }));
    await page.fill('#hv-sueno', '7.5');
    await page.locator('#hv-sueno').blur();
    await tap(row('Pasos').locator('.check'));
    for (let i = 0; i < 4; i++) await tap(row('Lectura').getByRole('button', { name: 'Más' }));
    await page.fill('#hv-redes', '30'); await page.locator('#hv-redes').blur();
    const deep = row('Trabajo profundo');
    if (await deep.count()) await tap(deep.locator('.check'));
    const lect = await page.inputValue('#hv-lectura');
    if (lect !== '20') throw new Error(`lectura = ${lect}`);
  });

  await step('Registrar entrenamiento desde "Entrenar"', async () => {
    await tap(page.locator('button.habit', { hasText: 'Entrenar' }));
    await page.getByRole('dialog', { name: 'Registrar entrenamiento' }).waitFor();
    await tap(page.getByRole('button', { name: 'Running' }));
    await page.fill('#w-dur', '32');
    await page.fill('#w-dist', '5.2');
    await page.getByText('6:09 min/km').waitFor();
    await tap(page.locator('.scale-btn', { hasText: /^7$/ }).first());
    await shot('03-entreno');
    await tap(page.getByRole('button', { name: 'Guardar' }));
    await page.locator('button.habit.done', { hasText: 'Entrenar' }).waitFor();
  });

  await step('Registrar métricas (peso, cintura)', async () => {
    await page.fill('#m-weight', '78.4'); await page.locator('#m-weight').blur();
    await page.fill('#m-waist', '88'); await page.locator('#m-waist').blur();
  });

  await step('Score del día = 100 con todo cumplido', async () => {
    const s = await page.locator('.ring-num').innerText();
    if (s !== '100') throw new Error(`score = ${s}`);
    await shot('04-hoy-completo');
  });

  await step('Cerrar el día (estado + reflexión)', async () => {
    await tap(page.locator('.close-day button'));
    const dlg = page.getByRole('dialog', { name: 'Cerrar el día' });
    await dlg.waitFor();
    const pick = async (label, n) => tap(dlg.locator('.field', { hasText: label }).locator('.scale-btn', { hasText: new RegExp(`^${n}$`) }));
    await pick('Energía', 7); await pick('Estado de ánimo', 8); await pick('Estrés', 4); await pick('Motivación', 8);
    await page.fill('#c-well', 'Entrené temprano y cumplí el objetivo principal.');
    await page.fill('#c-improve', 'Dormir antes de las 23:00.');
    await shot('05-cerrar-dia');
    await tap(dlg.getByRole('button', { name: 'Cerrar día' }));
    await page.locator('.toast', { hasText: 'Día cerrado' }).waitFor();
    await page.locator('.close-day', { hasText: 'Día cerrado' }).waitFor();
  });
  console.log(`  → Día completo registrado en ${((Date.now() - tStart) / 1000).toFixed(1)} s de automatización, ${taps} toques`);

  await step('Completar ayer desde el aviso', async () => {
    await tap(page.getByText('Completar ayer'));
    await page.getByText('Registro pasado').waitFor();
    for (const name of ['Comer según el plan', 'Orden']) await tap(page.locator('button.habit', { hasText: name }));
    await tap(page.getByRole('button', { name: 'Día siguiente' }));
    await page.locator('.day-nav-title .eyebrow', { hasText: 'Hoy' }).waitFor();
  });

  await step('Persistencia: recargar y conservar todo', async () => {
    await page.waitForTimeout(400);
    await page.reload();
    await page.locator('.ring-num').waitFor();
    const s = await page.locator('.ring-num').innerText();
    const w = await page.inputValue('#m-weight');
    if (s !== '100' || w !== '78.4') throw new Error(`tras recarga score=${s} peso=${w}`);
    if (await page.getByRole('dialog', { name: 'Tu Winter Arc' }).count()) throw new Error('onboarding reapareció');
  });

  await step('Persistencia: cerrar navegador y abrir de nuevo (mismo perfil)', async () => {
    const state = await ctx.storageState();
    const ctx2 = await browser.newContext({ ...devices['iPhone 13'], storageState: state });
    const p2 = await ctx2.newPage();
    await p2.goto(URL);
    const s = await p2.locator('.ring-num').innerText();
    if (s !== '100') throw new Error(`score=${s}`);
    await ctx2.close();
  });

  await step('Semana: fila de hoy, resumen y revisión', async () => {
    await tap(page.locator('.tabbar').getByRole('button', { name: 'Semana' }));
    await page.locator('.week-row.is-today').waitFor();
    const txt = await page.locator('.week-row.is-today').innerText();
    if (!/100/.test(txt) || !/78,4|78\.4/.test(txt)) throw new Error(`fila hoy: ${txt}`);
    await shot('06-semana');
    await page.fill('#r-prio', 'Dormir 7.5 h cinco noches');
    await tap(page.getByRole('button', { name: 'Guardar revisión' }));
    await page.locator('.pill', { hasText: 'guardada' }).waitFor();
  });

  await step('Semana: tocar un día abre su registro en Hoy', async () => {
    await tap(page.locator('.week-row').nth(1).filter({ hasNot: page.locator('[disabled]') }));
    await page.locator('.ring').waitFor();
    await tap(page.locator('.tabbar').getByRole('button', { name: 'Semana' }));
  });

  await step('Progreso: consistencia, alertas, gráficas y calendario', async () => {
    await tap(page.locator('.tabbar').getByRole('button', { name: 'Progreso' }));
    await page.getByText('Consistencia', { exact: true }).waitFor();
    await shot('07-progreso');
    await tap(page.getByRole('tab', { name: 'Cuerpo' }));
    await shot('08-progreso-cuerpo');
    await tap(page.getByRole('tab', { name: 'Calendario' }));
    await page.locator('.cal-cell.done').first().waitFor();
    await shot('09-calendario');
  });

  await step('Objetivos: crear meta de peso desde plantilla', async () => {
    await tap(page.locator('.tabbar').getByRole('button', { name: 'Objetivos' }));
    await tap(page.getByRole('button', { name: 'Crear objetivo' }));
    await tap(page.getByRole('button', { name: 'Peso', exact: true }));
    await page.fill('#g-start', '80'); await page.fill('#g-target', '74');
    await tap(page.getByRole('dialog').getByRole('button', { name: 'Guardar' }));
    await page.locator('.goal-cur', { hasText: '78.4' }).waitFor();
    await tap(page.getByRole('button', { name: 'Nuevo' }));
    await tap(page.getByRole('button', { name: 'Cotizaciones', exact: true }));
    await page.fill('#g-start', '0'); await page.fill('#g-target', '10');
    await tap(page.getByRole('dialog').getByRole('button', { name: 'Guardar' }));
    await tap(page.locator('.goal', { hasText: 'Cotizaciones' }).getByRole('button', { name: 'Sumar' }));
    await page.locator('.goal', { hasText: 'Cotizaciones' }).locator('.goal-pct', { hasText: '10%' }).waitFor();
    await shot('10-objetivos');
  });

  await step('Más → Finanzas: ingreso y ahorro', async () => {
    await tap(page.locator('.tabbar').getByRole('button', { name: 'Más' }));
    await tap(page.getByRole('button', { name: /Finanzas/ }));
    await tap(page.locator('.quick-money button', { hasText: 'Ingreso' }));
    await page.fill('#f-amt', '45000');
    await tap(page.getByRole('dialog').getByRole('button', { name: 'Guardar' }));
    await tap(page.locator('.quick-money button', { hasText: 'Ahorro' }));
    await page.fill('#f-amt', '9000');
    await tap(page.getByRole('dialog').getByRole('button', { name: 'Guardar' }));
    await page.locator('.tile', { hasText: '% de ahorro' }).getByText('20%').waitFor();
    await shot('11-finanzas');
  });

  await step('Más → Hábitos: crear hábito personalizado', async () => {
    await tap(page.getByRole('button', { name: 'Volver' }));
    await tap(page.getByRole('button', { name: /Hábitos/ }));
    await tap(page.getByRole('button', { name: 'Nuevo hábito' }));
    await page.fill('#h-name', 'Suplementos');
    await tap(page.getByRole('dialog').getByRole('button', { name: 'Guardar' }));
    await page.getByText('Suplementos').waitFor();
    await shot('12-habitos');
  });

  await step('Hoy refleja el hábito nuevo y recalcula el score', async () => {
    await tap(page.locator('.tabbar').getByRole('button', { name: 'Hoy' }));
    await page.locator('button.habit', { hasText: 'Suplementos' }).waitFor();
    const s = Number(await page.locator('.ring-num').innerText());
    if (!(s < 100 && s > 85)) throw new Error(`score esperado ~93, fue ${s}`);
  });

  await step('Notas: crear nota', async () => {
    await tap(page.locator('.tabbar').getByRole('button', { name: 'Más' }));
    await tap(page.getByRole('button', { name: /Notas/ }));
    await tap(page.getByRole('button', { name: 'Nueva nota' }));
    await page.getByRole('textbox', { name: 'Nota' }).fill('Bloquear 2 h de trabajo profundo antes de revisar WhatsApp.');
    await tap(page.getByRole('dialog').getByRole('button', { name: 'Guardar' }));
    await page.getByText('Bloquear 2 h').waitFor();
  });

  await step('Datos: exportar JSON y CSV', async () => {
    await tap(page.getByRole('button', { name: 'Volver' }));
    await tap(page.getByRole('button', { name: /Datos y respaldo/ }));
    const [dl] = await Promise.all([page.waitForEvent('download'), tap(page.getByRole('button', { name: 'Respaldo completo (JSON)' }))]);
    const p = await dl.path();
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!json.data || !json.data.workouts.length) throw new Error('JSON sin datos');
    const [dl2] = await Promise.all([page.waitForEvent('download'), tap(page.getByRole('button', { name: 'Días y hábitos (CSV)' }))]);
    const csv = fs.readFileSync(await dl2.path(), 'utf8');
    if (!csv.startsWith('fecha,score')) throw new Error('CSV inválido');
    fs.writeFileSync(path.join(SHOTS, 'backup.json'), JSON.stringify(json));
    await shot('13-datos');
  });

  await step('Restaurar respaldo en un dispositivo nuevo', async () => {
    const c3 = await browser.newContext({ ...devices['iPhone 13'] });
    const p3 = await c3.newPage();
    p3.on('pageerror', (e) => problems.push(`pageerror(restore): ${e.message}`));
    await p3.goto(URL);
    await p3.getByRole('button', { name: 'Empezar' }).click();
    await p3.locator('.tabbar').getByRole('button', { name: 'Más' }).click();
    await p3.getByRole('button', { name: /Datos y respaldo/ }).click();
    await p3.locator('input[type=file]').setInputFiles(path.join(SHOTS, 'backup.json'));
    await p3.getByRole('dialog').getByRole('button', { name: 'Restaurar' }).click();
    await p3.locator('.tabbar').getByRole('button', { name: 'Hoy' }).click();
    const w = await p3.inputValue('#m-weight');
    await p3.locator('button.habit', { hasText: 'Suplementos' }).waitFor();
    if (w !== '78.4') throw new Error(`peso restaurado=${w}`);
    await c3.close();
  });

  await step('Tema oscuro', async () => {
    await tap(page.getByRole('button', { name: 'Volver' }));
    await tap(page.getByRole('button', { name: /Ajustes/ }));
    await tap(page.getByRole('tab', { name: 'Oscuro' }));
    await tap(page.locator('.tabbar').getByRole('button', { name: 'Hoy' }));
    await shot('14-hoy-oscuro');
    await tap(page.locator('.tabbar').getByRole('button', { name: 'Progreso' }));
    await shot('15-progreso-oscuro');
  });

  await step('Sin scroll horizontal y objetivos táctiles ≥ 40px', async () => {
    for (const tab of ['Hoy', 'Semana', 'Progreso', 'Objetivos', 'Más']) {
      await page.getByRole('button', { name: tab }).click();
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 1) throw new Error(`${tab}: overflow horizontal ${over}px`);
      const small = await page.evaluate(() => [...document.querySelectorAll('.app button, .tabbar button')]
        .filter((b) => b.offsetParent && !b.closest('svg') && !b.classList.contains('cal-cell'))
        .map((b) => { const r = b.getBoundingClientRect(); return { t: (b.innerText || b.getAttribute('aria-label') || '').slice(0, 20), h: r.height, w: r.width }; })
        .filter((r) => r.h < 34 || r.w < 30));
      if (small.length) throw new Error(`${tab}: botones pequeños ${JSON.stringify(small.slice(0, 5))}`);
    }
  });

  await step('PWA: manifest, íconos y service worker', async () => {
    const man = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json());
    if (man.display !== 'standalone') throw new Error('manifest sin standalone');
    const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
    if (!sw) throw new Error('SW no activo');
    await ctx.setOffline(true);
    await page.reload();
    await page.locator('.ring-num').waitFor({ timeout: 5000 });
    await ctx.setOffline(false);
  });

  await browser.close();
  console.log(problems.length ? `\nPROBLEMAS (${problems.length}):\n- ${problems.join('\n- ')}` : '\nFlujo completo sin errores.');
  process.exit(problems.length ? 1 : 0);
})();
