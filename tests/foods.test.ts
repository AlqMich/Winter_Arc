import assert from 'node:assert/strict';
import { FOOD_DB, itemsFromText, matchFood, parseText, totals, searchFoods, syncDayMetrics } from '../src/lib/foods';
import { defaultData } from '../src/lib/defaults';

let n = 0; const id = () => String(++n);
let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ✓', name); };
const one = (t: string) => itemsFromText(t, FOOD_DB, id);

console.log('Comidas');
test('ejemplo: 100 gramos de fruta, 1 manzana y 1 taza de yogurt', () => {
  const it = one('comí 100 gramos de fruta, 1 manzana y 1 taza de yogurt');
  assert.deepEqual(it.map((i) => [i.name, i.qty, i.unit, i.grams]), [
    ['Fruta (mixta)', 100, 'g', 100], ['Manzana', 1, 'pieza', 180], ['Yogurt natural', 1, 'taza', 245]]);
  assert.equal(it[1].kcal, 94);
});
test('tolera errores: "100 gramod de fruta"', () => assert.equal(one('100 gramod de fruta')[0].grams, 100));
test('10 gramos de nueces', () => { const [i] = one('10 gramos de nueces'); assert.equal(i.name, 'Nuez'); assert.equal(i.kcal, 65); });
test('250 gramos de pechuga de pollo', () => { const [i] = one('250 gramos de pechuga de pollo'); assert.equal(i.name, 'Pechuga de pollo'); assert.equal(i.kcal, 413); assert.equal(i.p, 77.5); });
test('"250g pollo" pegado', () => assert.equal(one('250g pollo')[0].grams, 250));
test('palabras: dos huevos, media taza de arroz', () => {
  const it = one('dos huevos, media taza de arroz');
  assert.equal(it[0].name, 'Huevo'); assert.equal(it[0].qty, 2); assert.equal(it[0].grams, 100);
  assert.equal(it[1].name, 'Arroz blanco'); assert.equal(it[1].grams, 79);
});
test('sin cantidad → 1 pieza', () => { const [i] = one('plátano'); assert.equal(i.unit, 'pieza'); assert.equal(i.grams, 120); });
test('3 tortillas + 1 cda de aceite de oliva', () => {
  const it = one('3 tortillas + 1 cda de aceite de oliva');
  assert.equal(it[0].grams, 90); assert.equal(it[1].name, 'Aceite de oliva'); assert.equal(it[1].kcal, 119);
});
test('específico gana: yogurt griego', () => assert.equal(matchFood('yogurt griego', FOOD_DB)?.name, 'Yogurt griego natural'));
test('leche vs leche de almendra', () => {
  assert.equal(matchFood('leche', FOOD_DB)?.name, 'Leche entera');
  assert.equal(matchFood('leche de almendra', FOOD_DB)?.name, 'Leche de almendra sin azúcar');
});
test('desconocido queda marcado', () => { const [i] = one('2 piezas de mazapán'); assert.equal(i.unknown, true); assert.equal(i.name, 'Mazapan'); });
test('medida sin equivalencia se marca aproximada', () => { const [i] = one('1 taza de salmón'); assert.equal(i.approx, true); });
test('buscador', () => assert.equal(searchFoods('pech', FOOD_DB)[0].name, 'Pechuga de pollo'));
test('alimento propio tiene prioridad', () => {
  const mine = { id: 'x', name: 'Yogurt de la casa', kcal: 80, p: 5, c: 8, f: 3, custom: true, units: { taza: 200 } };
  assert.equal(matchFood('yogurt', [mine, ...FOOD_DB])?.name, 'Yogurt de la casa');
});
test('totales y métricas del día', () => {
  const d = defaultData();
  d.meals.push({ id: 'm1', date: '2026-09-30', slot: 'Desayuno', items: one('2 huevos, 1 tortilla'), quality: 3, createdAt: 1 });
  d.meals.push({ id: 'm2', date: '2026-09-30', slot: 'Comida', items: one('250 g pollo'), quality: 2, createdAt: 2 });
  const t = totals(d.meals);
  assert.equal(t.kcal, 143 + 65 + 413);
  syncDayMetrics(d, '2026-09-30');
  assert.equal(d.logs['2026-09-30'].metrics.meals, 2);
  assert.equal(d.logs['2026-09-30'].metrics.calories, t.kcal);
  assert.equal(d.logs['2026-09-30'].metrics.foodQuality, 4);
});
console.log(`\n${passed} pruebas OK`);
