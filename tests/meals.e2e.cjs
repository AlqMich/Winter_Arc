// Flujo de comidas en viewport iPhone.
const { chromium, devices } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const URL = process.argv[2] || 'http://localhost:4173/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const ok = (m) => console.log('  ✓', m);
  await p.goto(URL);
  await p.getByRole('button', { name: 'Empezar' }).click();

  // Metas
  await p.locator('.tabbar').getByRole('button', { name: 'Más' }).click();
  await p.getByRole('button', { name: /Ajustes/ }).click();
  await p.fill('#s-kcal', '2200'); await p.fill('#s-prot', '160'); await p.locator('#s-prot').blur();
  await p.locator('.tabbar').getByRole('button', { name: 'Hoy' }).click();
  ok('metas de calorías y proteína');

  // Desayuno escrito como mensaje
  await p.getByRole('button', { name: /Registrar comida/ }).click();
  const dlg = p.getByRole('dialog', { name: 'Registrar comida' });
  await dlg.getByRole('button', { name: 'Desayuno' }).click();
  await p.fill('#meal-text', 'comí 100 gramos de fruta, 1 manzana y 1 taza de yogurt');
  await dlg.getByRole('button', { name: 'Agregar', exact: true }).click();
  await dlg.locator('.meal-item').nth(2).waitFor();
  const names = await dlg.locator('.meal-item-name').allInnerTexts();
  if (names.join('|') !== 'Fruta (mixta)|Manzana|Yogurt natural') throw new Error('items: ' + names.join('|'));
  ok('texto libre → 3 alimentos');
  // Cambiar cantidad de manzana a 2
  await dlg.locator('.meal-item').nth(1).locator('.qty-in').fill('2');
  await dlg.locator('.meal-item').nth(1).locator('.qty-in').blur();
  const kcal = await dlg.locator('.meal-item').nth(1).locator('.meal-item-kcal').innerText();
  if (!kcal.startsWith('187')) throw new Error('kcal manzana x2 = ' + kcal);
  ok('editar cantidad recalcula (2 manzanas = 187 kcal)');
  await dlg.getByRole('button', { name: 'Bien' }).click();
  await p.screenshot({ path: 'shots/40-comida.png' });
  await dlg.getByRole('button', { name: 'Guardar' }).click();
  await p.locator('.toast', { hasText: 'Desayuno guardado' }).waitFor();
  ok('guardar desayuno');

  // Colación con alimento desconocido → crear alimento
  await p.getByRole('button', { name: 'Comida', exact: true }).click();
  const dlg2 = p.getByRole('dialog', { name: 'Registrar comida' });
  await dlg2.getByRole('button', { name: 'Colación' }).click();
  await p.fill('#meal-text', '10 gramos de nueces, 1 barrita fitbar');
  await dlg2.getByRole('button', { name: 'Agregar', exact: true }).click();
  await dlg2.locator('.meal-item.unknown').waitFor();
  await dlg2.getByRole('button', { name: 'Crear alimento' }).click();
  const fd = p.getByRole('dialog', { name: 'Nuevo alimento' });
  await fd.locator('#fd-g').fill('23'); await fd.locator('#fd-k').fill('90'); await fd.locator('#fd-p').fill('1.5');
  await fd.getByRole('button', { name: 'Guardar alimento' }).click();
  await dlg2.locator('.meal-item.unknown').waitFor({ state: 'detached' });
  const k2 = await dlg2.locator('.meal-item').nth(1).locator('.meal-item-kcal').innerText();
  if (!k2.startsWith('90')) throw new Error('fitbar kcal ' + k2);
  ok('alimento desconocido → crear alimento propio (90 kcal por pieza)');
  await dlg2.getByRole('button', { name: 'Guardar' }).click();

  // Comida: 250 g pollo + frecuentes
  await p.getByRole('button', { name: 'Comida', exact: true }).click();
  const dlg3 = p.getByRole('dialog', { name: 'Registrar comida' });
  await dlg3.getByRole('button', { name: 'Comida', exact: true }).click();
  await p.fill('#meal-text', '250 gramos de pechuga de pollo, 1 taza de arroz, ensalada');
  await p.locator('#meal-text').press('Enter');
  await dlg3.locator('.meal-item').nth(2).waitFor();
  await dlg3.locator('.chip', { hasText: 'Manzana' }).click();
  await dlg3.locator('.meal-item').nth(3).waitFor();
  ok('Enter agrega; “Frecuentes” agrega con un toque');
  await dlg3.getByRole('button', { name: 'Guardar' }).click();

  // Totales del día
  await p.locator('.food-totals').waitFor();
  const tot = await p.locator('.food-totals').innerText();
  console.log('   totales:', tot.replace(/\s+/g, ' '));
  if (!/3\s*comidas/.test(tot)) throw new Error('comidas');
  await p.screenshot({ path: 'shots/41-hoy-alimentacion.png', fullPage: true });
  ok('resumen del día en Hoy');

  // Cerrar día muestra lo calculado
  await p.locator('.close-day button').click();
  await p.getByText('Alimentación', { exact: true }).last().click();
  await p.getByText('Calculado de tus comidas').waitFor();
  await p.keyboard.press('Escape');
  ok('Cerrar el día usa los datos de comidas');

  // Persistencia y progreso
  await p.waitForTimeout(400); await p.reload();
  await p.locator('.food-totals').waitFor();
  await p.locator('.tabbar').getByRole('button', { name: 'Progreso' }).click();
  await p.getByRole('tab', { name: 'Cuerpo' }).click();
  await p.getByText('Calorías por día').waitFor();
  await p.screenshot({ path: 'shots/42-progreso-calorias.png', fullPage: true });
  ok('persistencia + gráfica de calorías');

  const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over > 1) throw new Error('overflow ' + over);
  await b.close();
  if (errs.length) { console.log('ERRORES', errs); process.exit(1); }
  console.log('Comidas OK');
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
