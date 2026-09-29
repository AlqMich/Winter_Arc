import type { AppData, Food, FoodUnit, ISODate, Meal, MealItem } from './types';

// Base de alimentos comunes en México. Valores APROXIMADOS por 100 g (o 100 ml),
// de tablas de composición estándar (USDA / SMAE). Alimentos cocidos cuando aplica.
// Formato compacto: [id, nombre, kcal, proteína, carbohidratos, grasa, medidas, alias]
type Row = [string, string, number, number, number, number, Partial<Record<FoodUnit, number>>?, string[]?];

const ROWS: Row[] = [
  // Frutas
  ['manzana', 'Manzana', 52, 0.3, 14, 0.2, { pieza: 180, taza: 125 }],
  ['platano', 'Plátano', 89, 1.1, 23, 0.3, { pieza: 120, taza: 150 }, ['banana', 'platano tabasco']],
  ['naranja', 'Naranja', 47, 0.9, 12, 0.1, { pieza: 150 }],
  ['fresa', 'Fresas', 32, 0.7, 7.7, 0.3, { taza: 150, pieza: 12 }],
  ['papaya', 'Papaya', 43, 0.5, 11, 0.3, { taza: 145, rebanada: 150 }],
  ['melon', 'Melón', 34, 0.8, 8, 0.2, { taza: 160, rebanada: 130 }],
  ['sandia', 'Sandía', 30, 0.6, 7.6, 0.2, { taza: 150, rebanada: 280 }],
  ['pina', 'Piña', 50, 0.5, 13, 0.1, { taza: 165, rebanada: 85 }],
  ['mango', 'Mango', 60, 0.8, 15, 0.4, { pieza: 200, taza: 165 }],
  ['uva', 'Uvas', 69, 0.7, 18, 0.2, { taza: 150, pieza: 5 }],
  ['pera', 'Pera', 57, 0.4, 15, 0.1, { pieza: 180 }],
  ['arandano', 'Arándanos', 57, 0.7, 14, 0.3, { taza: 148 }, ['blueberry', 'mora azul']],
  ['kiwi', 'Kiwi', 61, 1.1, 15, 0.5, { pieza: 75 }],
  ['guayaba', 'Guayaba', 68, 2.6, 14, 1, { pieza: 55 }],
  ['fruta', 'Fruta (mixta)', 50, 0.6, 12.5, 0.2, { taza: 150, pieza: 150, porción: 150 }, ['fruta picada', 'coctel de frutas']],
  ['aguacate', 'Aguacate', 160, 2, 8.5, 14.7, { pieza: 140, rebanada: 25, cda: 15 }, ['palta']],
  // Huevo y lácteos
  ['huevo', 'Huevo', 143, 12.6, 0.7, 9.5, { pieza: 50 }, ['huevo revuelto', 'huevo estrellado', 'huevo cocido']],
  ['clara', 'Clara de huevo', 52, 10.9, 0.7, 0.2, { pieza: 33, taza: 243 }, ['claras']],
  ['leche', 'Leche entera', 61, 3.2, 4.8, 3.3, { taza: 244, vaso: 250 }],
  ['leche-light', 'Leche descremada', 34, 3.4, 5, 0.1, { taza: 245, vaso: 250 }, ['leche light', 'leche deslactosada light']],
  ['leche-almendra', 'Leche de almendra sin azúcar', 15, 0.6, 0.3, 1.2, { taza: 240, vaso: 250 }],
  ['yogurt', 'Yogurt natural', 61, 3.5, 4.7, 3.3, { taza: 245, pieza: 150 }, ['yogur', 'yoghurt']],
  ['yogurt-griego', 'Yogurt griego natural', 73, 9.9, 3.9, 2, { taza: 227, pieza: 150 }, ['yogur griego']],
  ['panela', 'Queso panela', 260, 18, 3, 20, { rebanada: 30, taza: 130 }],
  ['queso-fresco', 'Queso fresco', 299, 18, 3, 24, { rebanada: 30 }],
  ['oaxaca', 'Queso Oaxaca', 300, 22, 2, 22, { rebanada: 30, taza: 110 }, ['quesillo']],
  ['cottage', 'Queso cottage', 98, 11, 3.4, 4.3, { taza: 226, cda: 15 }],
  ['mantequilla', 'Mantequilla', 717, 0.9, 0.1, 81, { cda: 14, cdita: 5 }],
  ['crema', 'Crema', 198, 2.4, 4.6, 19, { cda: 15 }, ['crema acida']],
  // Proteínas
  ['pollo', 'Pechuga de pollo', 165, 31, 0, 3.6, { pieza: 150, taza: 140 }, ['pollo', 'pechuga', 'pollo asado', 'pollo a la plancha']],
  ['muslo', 'Muslo de pollo', 209, 26, 0, 10.9, { pieza: 100 }, ['pierna de pollo']],
  ['res', 'Bistec de res', 200, 29, 0, 9, { pieza: 120 }, ['bistec', 'carne asada', 'carne de res', 'arrachera', 'res']],
  ['molida', 'Carne molida de res', 217, 26, 0, 12, { taza: 140 }, ['carne molida']],
  ['cerdo', 'Lomo de cerdo', 170, 27, 0, 6, { pieza: 120 }, ['cerdo', 'puerco', 'chuleta']],
  ['atun', 'Atún en agua', 116, 26, 0, 0.8, { lata: 120, taza: 150 }],
  ['salmon', 'Salmón', 206, 22, 0, 12, { pieza: 150 }],
  ['tilapia', 'Pescado blanco (tilapia)', 128, 26, 0, 2.7, { pieza: 120 }, ['pescado', 'tilapia', 'filete de pescado']],
  ['camaron', 'Camarón', 99, 24, 0.2, 0.3, { taza: 145, pieza: 10 }],
  ['jamon', 'Jamón de pavo', 110, 17, 2, 3.5, { rebanada: 20 }, ['jamon']],
  ['tocino', 'Tocino', 541, 37, 1.4, 42, { rebanada: 8 }],
  ['salchicha', 'Salchicha de pavo', 170, 12, 4, 12, { pieza: 45 }],
  ['whey', 'Proteína en polvo', 400, 80, 8, 6, { scoop: 30, cda: 10 }, ['proteina', 'whey', 'batido de proteina', 'licuado de proteina']],
  ['frijol', 'Frijoles de la olla', 132, 8.9, 23.7, 0.5, { taza: 172, cda: 15 }, ['frijoles', 'frijol negro']],
  ['refritos', 'Frijoles refritos', 100, 5.5, 15, 2, { taza: 240, cda: 15 }],
  ['lenteja', 'Lentejas', 116, 9, 20, 0.4, { taza: 198 }],
  ['garbanzo', 'Garbanzos', 164, 8.9, 27, 2.6, { taza: 164 }],
  ['tofu', 'Tofu', 76, 8, 1.9, 4.8, { taza: 250, rebanada: 80 }],
  // Cereales y tubérculos
  ['arroz', 'Arroz blanco', 130, 2.7, 28, 0.3, { taza: 158 }, ['arroz rojo', 'arroz a la mexicana']],
  ['arroz-integral', 'Arroz integral', 123, 2.7, 26, 1, { taza: 195 }],
  ['avena', 'Avena (cruda)', 389, 16.9, 66, 6.9, { taza: 81, cda: 8 }],
  ['tortilla', 'Tortilla de maíz', 218, 5.7, 44.6, 2.9, { pieza: 30 }],
  ['tortilla-harina', 'Tortilla de harina', 310, 8, 51, 8, { pieza: 45 }],
  ['pan', 'Pan de caja', 265, 9, 49, 3.2, { rebanada: 25, pieza: 25 }, ['pan blanco']],
  ['pan-integral', 'Pan integral', 247, 13, 41, 3.4, { rebanada: 28, pieza: 28 }],
  ['bolillo', 'Bolillo', 274, 9, 52, 3, { pieza: 70 }, ['telera']],
  ['pasta', 'Pasta cocida', 158, 5.8, 31, 0.9, { taza: 140 }, ['espagueti', 'spaghetti', 'sopa de pasta']],
  ['papa', 'Papa cocida', 87, 1.9, 20, 0.1, { pieza: 170, taza: 150 }],
  ['camote', 'Camote', 90, 2, 21, 0.2, { pieza: 150, taza: 200 }],
  ['granola', 'Granola', 471, 10, 64, 20, { taza: 120, cda: 12 }],
  ['cereal', 'Cereal de caja', 357, 7.5, 84, 0.4, { taza: 30 }],
  ['quinoa', 'Quinoa', 120, 4.4, 21, 1.9, { taza: 185 }],
  ['palomitas', 'Palomitas naturales', 387, 13, 78, 4.5, { taza: 8 }],
  ['elote', 'Elote', 96, 3.4, 21, 1.5, { pieza: 100, taza: 145 }, ['esquite', 'maiz']],
  // Verduras
  ['ensalada', 'Ensalada verde', 15, 1.4, 2.9, 0.2, { taza: 50, porción: 100 }, ['lechuga']],
  ['verduras', 'Verduras mixtas cocidas', 50, 2.5, 10, 0.3, { taza: 180, porción: 150 }, ['verdura']],
  ['brocoli', 'Brócoli', 35, 2.4, 7.2, 0.4, { taza: 156 }],
  ['espinaca', 'Espinaca', 23, 2.9, 3.6, 0.4, { taza: 30 }],
  ['jitomate', 'Jitomate', 18, 0.9, 3.9, 0.2, { pieza: 120, taza: 180 }, ['tomate']],
  ['zanahoria', 'Zanahoria', 41, 0.9, 10, 0.2, { pieza: 60, taza: 128 }],
  ['calabacita', 'Calabacita', 15, 1.1, 2.7, 0.4, { pieza: 200, taza: 180 }],
  ['nopal', 'Nopales', 15, 1.3, 3.3, 0.1, { taza: 150, pieza: 80 }],
  ['pepino', 'Pepino', 15, 0.7, 3.6, 0.1, { pieza: 200, taza: 120 }],
  ['champinon', 'Champiñones', 22, 3.1, 3.3, 0.3, { taza: 70 }, ['hongos']],
  // Grasas y semillas
  ['nuez', 'Nuez', 654, 15, 14, 65, { pieza: 4, puño: 30, taza: 100, cda: 8 }, ['nueces']],
  ['almendra', 'Almendras', 579, 21, 22, 50, { pieza: 1.2, puño: 28, taza: 143 }],
  ['cacahuate', 'Cacahuates', 567, 26, 16, 49, { puño: 30, taza: 146, pieza: 1 }, ['mani']],
  ['crema-cacahuate', 'Crema de cacahuate', 588, 25, 20, 50, { cda: 16, cdita: 5 }, ['mantequilla de cacahuate']],
  ['aceite-oliva', 'Aceite de oliva', 884, 0, 0, 100, { cda: 13.5, cdita: 4.5 }],
  ['aceite', 'Aceite vegetal', 884, 0, 0, 100, { cda: 14, cdita: 4.5 }],
  ['chia', 'Chía', 486, 17, 42, 31, { cda: 12 }],
  ['linaza', 'Linaza', 534, 18, 29, 42, { cda: 10 }],
  // Bebidas
  ['cafe', 'Café negro', 1, 0.1, 0, 0, { taza: 240 }, ['cafe americano']],
  ['refresco', 'Refresco', 42, 0, 10.6, 0, { lata: 355, vaso: 250 }, ['coca', 'soda']],
  ['jugo', 'Jugo de naranja', 45, 0.7, 10, 0.2, { vaso: 250, taza: 248 }, ['jugo']],
  ['cerveza', 'Cerveza', 43, 0.5, 3.6, 0, { lata: 355, vaso: 355 }, ['chela']],
  ['vino', 'Vino tinto', 85, 0.1, 2.6, 0, { copa: 150 }, ['vino']],
  ['destilado', 'Tequila / mezcal', 231, 0, 0, 0, { caballito: 45 }, ['tequila', 'mezcal', 'whisky', 'ron']],
  // Otros
  ['azucar', 'Azúcar', 387, 0, 100, 0, { cda: 12, cdita: 4 }],
  ['miel', 'Miel', 304, 0.3, 82, 0, { cda: 21, cdita: 7 }],
  ['chocolate', 'Chocolate oscuro 70%', 598, 7.8, 46, 43, { pieza: 10 }, ['chocolate']],
  ['galleta', 'Galletas', 450, 7, 70, 15, { pieza: 6 }, ['galletas maria']],
  ['pan-dulce', 'Pan dulce', 380, 7, 55, 15, { pieza: 80 }, ['concha', 'dona', 'cuernito']],
  ['salsa', 'Salsa', 30, 1.2, 6, 0.2, { cda: 15 }, ['salsa verde', 'salsa roja', 'pico de gallo']],
  ['guacamole', 'Guacamole', 150, 2, 8.5, 13, { cda: 15, taza: 230 }],
  ['taco', 'Taco (carne, tortilla de maíz)', 230, 13, 20, 11, { pieza: 70 }, ['tacos', 'taco de pastor', 'taco de asada']],
  ['quesadilla', 'Quesadilla', 260, 11, 24, 13, { pieza: 80 }],
  ['pizza', 'Pizza', 266, 11, 33, 10, { rebanada: 107 }],
  ['hamburguesa', 'Hamburguesa', 254, 13, 24, 12, { pieza: 220 }],
  ['barra-proteina', 'Barra de proteína', 350, 30, 35, 10, { pieza: 60 }],
];

export const FOOD_DB: Food[] = ROWS.map(([id, name, kcal, p, c, f, units, aliases]) => ({ id, name, kcal, p, c, f, units, aliases }));

export const UNIT_LABEL: Record<FoodUnit, [string, string]> = {
  g: ['g', 'g'], ml: ['ml', 'ml'], pieza: ['pieza', 'piezas'], taza: ['taza', 'tazas'], cda: ['cucharada', 'cucharadas'],
  cdita: ['cucharadita', 'cucharaditas'], rebanada: ['rebanada', 'rebanadas'], vaso: ['vaso', 'vasos'], lata: ['lata', 'latas'],
  'puño': ['puño', 'puños'], scoop: ['scoop', 'scoops'], copa: ['copa', 'copas'], caballito: ['caballito', 'caballitos'], 'porción': ['porción', 'porciones'],
};
export const unitLabel = (u: FoodUnit, qty: number) => UNIT_LABEL[u][qty === 1 ? 0 : 1];

// Equivalencias genéricas cuando el alimento no define la medida (se marcan como aproximadas).
const GENERIC: Partial<Record<FoodUnit, number>> = {
  taza: 200, cda: 15, cdita: 5, vaso: 250, lata: 355, 'puño': 30, scoop: 30, copa: 150, caballito: 45, 'porción': 100, rebanada: 30, pieza: 100,
};

/* ---------------- Texto ---------------- */

export function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'n').replace(/[^a-z0-9.,/ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'en', 'a', 'al', 'un', 'una', 'unos', 'unas', 'mi', 'para', 'sin']);

function singular(w: string): string {
  if (w.length > 4 && w.endsWith('ces')) return w.slice(0, -3) + 'z';
  if (w.length > 4 && w.endsWith('es') && !/[aeiou]/.test(w[w.length - 3])) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1);
  return w;
}

export function tokens(s: string): string[] {
  return norm(s).split(' ').filter((w) => w && !STOP.has(w)).map(singular);
}

/** Busca el alimento que mejor coincide. Prefiere coincidencias completas y más específicas. */
export function matchFood(query: string, foods: Food[]): Food | null {
  const q = tokens(query);
  if (!q.length) return null;
  const qs = new Set(q);
  let best: { food: Food; score: number } | null = null;
  for (const food of foods) {
    for (const cand of [food.name, ...(food.aliases ?? [])]) {
      const ct = tokens(cand);
      if (!ct.length) continue;
      const hits = ct.filter((t) => qs.has(t)).length;
      let score = 0;
      if (hits === ct.length) score = 10 + ct.length * 2 - (q.length - hits) * 0.5; // todas las palabras del alimento están en el texto
      else if (hits > 0 && q.every((t) => ct.includes(t))) score = 10 + hits * 2 - (ct.length - hits) * 0.5; // el texto es parte del nombre
      else if (hits > 0) score = 2 + hits;
      else if (q.some((t) => t.length >= 4 && ct.some((c) => c.startsWith(t) || t.startsWith(c)))) score = 1;
      if (food.custom && score > 0) score += 0.5; // tus alimentos primero
      if (score > 0 && (!best || score > best.score)) best = { food, score };
    }
  }
  return best && best.score >= 2 ? best.food : best && best.score >= 1 ? best.food : null;
}

/** Busca varios candidatos (para el buscador). */
export function searchFoods(query: string, foods: Food[], limit = 8): Food[] {
  const q = norm(query);
  if (!q) return [];
  const qt = tokens(query);
  return foods
    .map((f) => {
      const names = [f.name, ...(f.aliases ?? [])].map(norm);
      let s = 0;
      for (const n of names) {
        if (n.startsWith(q)) s = Math.max(s, 3);
        else if (n.includes(q)) s = Math.max(s, 2);
        else if (qt.length && qt.every((t) => n.split(' ').some((w) => singular(w).startsWith(t)))) s = Math.max(s, 1);
      }
      return { f, s: s + (f.custom && s ? 0.5 : 0) };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.f.name.length - b.f.name.length)
    .slice(0, limit)
    .map((x) => x.f);
}

const NUM_WORDS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  medio: 0.5, media: 0.5, cuarto: 0.25,
};

const UNIT_WORDS: [RegExp, FoodUnit, number?][] = [
  [/^(kg|kilo|kilos|kilogramos?)$/, 'g', 1000],
  [/^(g|gr|grs|gramo\w*|gram\w*)$/, 'g'],
  [/^(ml|mililitros?)$/, 'ml'],
  [/^(l|lt|litros?)$/, 'ml', 1000],
  [/^(oz|onzas?)$/, 'g', 28.35],
  [/^(tazas?)$/, 'taza'],
  [/^(cdas?|cucharadas?)$/, 'cda'],
  [/^(cditas?|cucharaditas?)$/, 'cdita'],
  [/^(piezas?|pzas?|pz|unidad(es)?|barras?|barritas?|paquetes?|sobres?|bolsitas?)$/, 'pieza'],
  [/^(rebanadas?|rodajas?|tajadas?)$/, 'rebanada'],
  [/^(vasos?)$/, 'vaso'],
  [/^(latas?)$/, 'lata'],
  [/^(punos?|punados?)$/, 'puño'],
  [/^(scoops?|medidas?)$/, 'scoop'],
  [/^(copas?)$/, 'copa'],
  [/^(caballitos?|shots?)$/, 'caballito'],
  [/^(porcion(es)?|platos?|raciones?)$/, 'porción'],
];

export interface ParsedItem { text: string; qty: number; unit: FoodUnit | null; factor: number; foodText: string }

/** "100 g de fruta, 1 manzana y 1 taza de yogurt" → piezas separadas. */
export function parseText(input: string): ParsedItem[] {
  const clean = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\b(me )?(comi|desayune|cene|tome|bebi|almorce)\b/gi, ' ');
  return clean
    .split(/\n|,|;|\+|\s+y\s+|\s+con\s+(?=\d)|\s+mas\s+/i)
    .map((s) => s.trim())
    .filter((s) => /[a-z]/i.test(s))
    .map((seg) => {
      const words = norm(seg).split(' ');
      let i = 0;
      let qty = NaN;
      const w0 = words[0] ?? '';
      if (/^\d+([.,]\d+)?$/.test(w0)) { qty = Number(w0.replace(',', '.')); i = 1; }
      else if (/^\d+\/\d+$/.test(w0)) { const [a, b] = w0.split('/').map(Number); qty = b ? a / b : NaN; i = 1; }
      else if (/^\d+([.,]\d+)?[a-z]+$/.test(w0)) { // "100g", "250gr"
        const m = w0.match(/^(\d+(?:[.,]\d+)?)([a-z]+)$/)!;
        qty = Number(m[1].replace(',', '.'));
        words.splice(0, 1, m[1], m[2]);
        i = 1;
      } else if (NUM_WORDS[w0] !== undefined) { qty = NUM_WORDS[w0]; i = 1; }
      if (words[i] === 'y' && words[i + 1] === 'medio') { qty += 0.5; i += 2; }
      let unit: FoodUnit | null = null;
      let factor = 1;
      const u = words[i];
      if (u) for (const [re, un, fac] of UNIT_WORDS) if (re.test(u)) { unit = un; factor = fac ?? 1; i++; break; }
      while (words[i] === 'de' || words[i] === 'del') i++;
      return { text: seg, qty: Number.isFinite(qty) ? qty : 1, unit, factor, foodText: words.slice(i).join(' ') };
    })
    .filter((p) => p.foodText.length > 0);
}

/* ---------------- Cálculo ---------------- */

export function gramsFor(food: Food | null, qty: number, unit: FoodUnit): { grams: number; approx: boolean } {
  if (unit === 'g' || unit === 'ml') return { grams: qty, approx: false };
  const exact = food?.units?.[unit];
  if (exact) return { grams: qty * exact, approx: false };
  return { grams: qty * (GENERIC[unit] ?? 100), approx: true };
}

/** Medida por defecto si escribes solo "manzana": 1 pieza, o 1 taza, o 100 g. */
export function defaultUnit(food: Food | null): FoodUnit {
  if (!food?.units) return 'g';
  if (food.units.pieza) return 'pieza';
  for (const u of ['taza', 'rebanada', 'scoop', 'lata', 'vaso', 'copa', 'caballito', 'cda'] as FoodUnit[]) if (food.units[u]) return u;
  return 'g';
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function buildItem(id: string, food: Food | null, qty: number, unit: FoodUnit, name?: string, manualKcal?: number): MealItem {
  const { grams, approx } = gramsFor(food, qty, unit);
  const k = grams / 100;
  if (!food) {
    return { id, name: name || 'Alimento', qty, unit, grams: Math.round(grams), kcal: Math.round(manualKcal ?? 0), p: 0, c: 0, f: 0, unknown: true };
  }
  return {
    id, name: food.name, foodId: food.id, qty, unit, grams: Math.round(grams),
    kcal: Math.round(food.kcal * k), p: r1(food.p * k), c: r1(food.c * k), f: r1(food.f * k), ...(approx ? { approx } : {}),
  };
}

/** Convierte el texto libre en alimentos. Los no reconocidos quedan marcados para que elijas o pongas kcal. */
export function itemsFromText(text: string, foods: Food[], mkId: () => string): MealItem[] {
  return parseText(text).map((p) => {
    const food = matchFood(p.foodText, foods);
    const qty = p.qty * p.factor;
    const unit: FoodUnit = p.unit ?? (food ? defaultUnit(food) : p.qty !== 1 || /^\d/.test(p.text.trim()) ? 'pieza' : 'porción');
    return buildItem(mkId(), food, Math.round(qty * 100) / 100, unit, food ? undefined : capital(p.foodText));
  });
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function allFoods(data: AppData): Food[] {
  return [...data.foods, ...FOOD_DB];
}

export interface Totals { kcal: number; p: number; c: number; f: number; meals: number; rated: number; good: number; unknown: number }

export function totals(meals: Meal[]): Totals {
  const t: Totals = { kcal: 0, p: 0, c: 0, f: 0, meals: meals.length, rated: 0, good: 0, unknown: 0 };
  for (const m of meals) {
    for (const i of m.items) { t.kcal += i.kcal; t.p += i.p; t.c += i.c; t.f += i.f; if (i.unknown && !i.kcal) t.unknown++; }
    if (m.quality) { t.rated++; if (m.quality === 3) t.good++; }
  }
  t.kcal = Math.round(t.kcal); t.p = Math.round(t.p); t.c = Math.round(t.c); t.f = Math.round(t.f);
  return t;
}

export function mealsOn(data: AppData, d: ISODate): Meal[] {
  return data.meals.filter((m) => m.date === d).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99') || a.createdAt - b.createdAt);
}

/** Mantiene sincronizadas las métricas del día (comidas, proteína, calorías, calidad) con el registro de comidas. */
export function syncDayMetrics(data: AppData, d: ISODate): void {
  const meals = mealsOn(data, d);
  if (!data.logs[d]) data.logs[d] = { date: d, habits: {}, metrics: {} };
  const m = data.logs[d].metrics;
  if (!meals.length) { delete m.meals; delete m.calories; delete m.protein; return; }
  const t = totals(meals);
  m.meals = t.meals;
  m.calories = t.kcal;
  m.protein = t.p;
  const q = meals.filter((x) => x.quality).map((x) => x.quality as number);
  if (q.length) m.foodQuality = Math.max(1, Math.min(5, Math.round((q.reduce((a, b) => a + b, 0) / q.length) * 2 - 1))); // 3→5, 2→3, 1→1
}

/** Alimentos usados recientemente (para agregarlos con un toque). */
export function recentItems(data: AppData, limit = 8): MealItem[] {
  const seen = new Map<string, { item: MealItem; n: number; last: number }>();
  for (const m of data.meals) {
    for (const i of m.items) {
      if (i.unknown) continue;
      const key = `${i.name}|${i.qty}|${i.unit}`;
      const e = seen.get(key);
      if (e) { e.n++; e.last = Math.max(e.last, m.createdAt); } else seen.set(key, { item: i, n: 1, last: m.createdAt });
    }
  }
  return [...seen.values()].sort((a, b) => b.n - a.n || b.last - a.last).slice(0, limit).map((e) => e.item);
}

export const SLOTS = ['Desayuno', 'Colación', 'Comida', 'Cena', 'Otra'];

export function suggestSlot(time: string, existing: Meal[]): string {
  const h = Number(time.split(':')[0]);
  const bySlot = h < 11 ? 'Desayuno' : h < 13 ? 'Colación' : h < 17 ? 'Comida' : h < 19 ? 'Colación' : 'Cena';
  if (bySlot !== 'Colación' && existing.some((m) => m.slot === bySlot)) return 'Colación';
  return bySlot;
}

export const QUALITY_LABEL: Record<number, string> = { 3: 'Bien', 2: 'Regular', 1: 'Mal' };
