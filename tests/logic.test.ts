// Pruebas de lógica: node --import tsx tests/logic.test.ts  (o: npx tsx tests/logic.test.ts)
import assert from 'node:assert/strict';
import { defaultData } from '../src/lib/defaults';
import { addDays, diffDays, toISO, weekStart, parseISO } from '../src/lib/dates';
import {
  arcInfo, dayScore, dayStatus, arcStats, credit, weekSummary, goalProgress, goalCurrent,
  weeklyPace, habitCompliance, fmtPace, pace, monthMoney, movingAvg,
} from '../src/lib/score';
import { normalize } from '../src/lib/storage';
import type { AppData } from '../src/lib/types';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name); throw e; }
}

const START = '2026-09-07'; // lunes
function fresh(): AppData {
  const d = defaultData();
  d.settings.startDate = START;
  return d;
}
function checkAll(d: AppData, date: string) {
  d.logs[date] = {
    date, habits: { alimentacion: 1, lectura: 20, reflexion: 1, orden: 1, finanzas: 1 },
    metrics: { sleep: 8, water: 2.5, steps: 9000, distraction: 30, mainGoal: 1, deepWork: 2 },
  };
}

console.log('Fechas');
test('toISO usa hora local (sin desfase UTC)', () => {
  assert.equal(toISO(new Date(2026, 8, 29, 23, 30)), '2026-09-29');
});
test('diffDays cruza cambio de mes', () => assert.equal(diffDays('2026-09-28', '2026-10-02'), 4));
test('weekStart = lunes; domingo pertenece a la semana anterior', () => {
  assert.equal(weekStart('2026-09-27'), '2026-09-21');
  assert.equal(weekStart('2026-09-28'), '2026-09-28');
});
test('parseISO al mediodía', () => assert.equal(parseISO('2026-11-01').getHours(), 12));

console.log('Reto');
test('día 1 es la fecha de inicio', () => {
  const a = arcInfo(fresh(), START);
  assert.equal(a.day, 1); assert.equal(a.daysLeft, 90);
});
test('día 90 y fin', () => {
  const a = arcInfo(fresh(), addDays(START, 89));
  assert.equal(a.day, 90); assert.equal(a.daysLeft, 1); assert.equal(a.pct, 1);
  const b = arcInfo(fresh(), addDays(START, 90));
  assert.equal(b.finished, true); assert.equal(b.daysLeft, 0);
});
test('antes de iniciar', () => {
  const a = arcInfo(fresh(), addDays(START, -3));
  assert.equal(a.started, false); assert.equal(a.day, 0);
});

console.log('Score');
test('crédito parcial en metas numéricas', () => {
  const agua = fresh().habits.find((h) => h.id === 'agua')!;
  assert.equal(credit(agua, 1.25), 0.5);
  assert.equal(credit(agua, 5), 1);
  assert.equal(credit(agua, undefined), 0);
});
test('"menos es mejor" (redes)', () => {
  const r = fresh().habits.find((h) => h.id === 'redes')!;
  assert.equal(credit(r, 30), 1);
  assert.equal(credit(r, 90), 0.5);
  assert.equal(credit(r, 200), 0);
  assert.equal(credit(r, undefined), 0, 'sin registro no cuenta como cumplido');
});
test('día perfecto = 100 sin entrenar (descanso no castiga)', () => {
  const d = fresh();
  checkAll(d, '2026-09-08');
  assert.equal(dayScore(d, '2026-09-08').score, 100);
});
test('entrenar suma cuando se hace', () => {
  const d = fresh();
  d.logs['2026-09-08'] = { date: '2026-09-08', habits: { alimentacion: 1 }, metrics: {} };
  const before = dayScore(d, '2026-09-08').score!;
  d.workouts.push({ id: 'w', date: '2026-09-08', type: 'gym', createdAt: 0 });
  const after = dayScore(d, '2026-09-08').score!;
  assert.ok(after > before, `${after} > ${before}`);
});
test('trabajo profundo no cuenta en fin de semana', () => {
  const d = fresh();
  checkAll(d, '2026-09-13'); // domingo
  delete d.logs['2026-09-13'].metrics.deepWork;
  assert.equal(dayScore(d, '2026-09-13').score, 100);
});

console.log('Estados y rachas');
test('día sin nada = omitido; con algo bajo umbral = parcial', () => {
  const d = fresh();
  d.logs['2026-09-08'] = { date: '2026-09-08', habits: { orden: 1 }, metrics: {} };
  const now = '2026-09-10';
  assert.equal(dayStatus(d, '2026-09-07', now), 'missed');
  assert.equal(dayStatus(d, '2026-09-08', now), 'partial');
  assert.equal(dayStatus(d, '2026-09-10', now), 'pending');
  assert.equal(dayStatus(d, '2026-09-11', now), 'future');
});
test('hoy sin completar NO rompe la racha', () => {
  const d = fresh();
  for (let i = 0; i < 5; i++) checkAll(d, addDays(START, i));
  const now = addDays(START, 5);
  const s = arcStats(d, now);
  assert.equal(s.currentStreak, 5);
  assert.equal(s.evaluated, 5);
  assert.equal(s.consistency, 1);
  checkAll(d, now);
  assert.equal(arcStats(d, now).currentStreak, 6);
});
test('un día flojo (con registro) pausa la racha; dos seguidos la rompen', () => {
  const d = fresh();
  for (let i = 0; i < 6; i++) checkAll(d, addDays(START, i));
  d.logs[addDays(START, 2)] = { date: addDays(START, 2), habits: { orden: 1 }, metrics: {} };
  let s = arcStats(d, addDays(START, 6));
  assert.equal(s.currentStreak, 5, 'pausa: 2 + 3');
  assert.equal(s.partial, 1);
  d.logs[addDays(START, 3)] = { date: addDays(START, 3), habits: { orden: 1 }, metrics: {} };
  s = arcStats(d, addDays(START, 6));
  assert.equal(s.currentStreak, 2);
});
test('un día sin registrar corta la racha pero la consistencia apenas baja', () => {
  const d = fresh();
  for (let i = 0; i < 10; i++) if (i !== 4) checkAll(d, addDays(START, i));
  const s = arcStats(d, addDays(START, 10));
  assert.equal(s.currentStreak, 5);
  assert.equal(s.bestStreak, 5);
  assert.equal(s.consistency, 0.9);
  assert.equal(s.missed, 1);
});

console.log('Semana');
test('resumen semanal con mejor día y entrenamientos', () => {
  const d = fresh();
  checkAll(d, '2026-09-07');
  d.logs['2026-09-08'] = { date: '2026-09-08', habits: { orden: 1 }, metrics: {} };
  d.workouts.push({ id: 'a', date: '2026-09-07', type: 'running', distance: 5, duration: 30, createdAt: 0 });
  const w = weekSummary(d, '2026-09-09', '2026-09-09');
  assert.equal(w.start, '2026-09-07');
  assert.equal(w.workouts, 1);
  assert.equal(w.bestDay?.date, '2026-09-07');
  assert.equal(w.rows.length, 7);
  assert.equal(w.rows[3].score, null, 'días futuros sin score');
});
test('entrenar 4×/semana: ritmo semanal', () => {
  const d = fresh();
  d.workouts.push({ id: 'a', date: '2026-09-07', type: 'gym', createdAt: 0 });
  const p = weeklyPace(d, '2026-09-11')[0]; // viernes, quedan 3 días, faltan 3
  assert.equal(p.doneDays, 1);
  assert.equal(p.behind, true);
  const p2 = weeklyPace(d, '2026-09-09')[0];
  assert.equal(p2.behind, false);
});
test('cumplimiento semanal de hábito semanal', () => {
  const d = fresh();
  const h = d.habits.find((x) => x.id === 'entrenar')!;
  ['2026-09-07', '2026-09-09'].forEach((dt, i) => d.workouts.push({ id: String(i), date: dt, type: 'gym', createdAt: 0 }));
  assert.equal(habitCompliance(d, h, '2026-09-07', '2026-09-13'), 0.5);
});

console.log('Objetivos y finanzas');
test('progreso de meta que baja (peso 78 → 72)', () => {
  const g = { start: 78, target: 72 } as never;
  assert.equal(goalProgress(g, 75), 0.5);
  assert.equal(goalProgress(g, 80), 0);
  assert.equal(goalProgress(g, 70), 1);
});
test('meta de peso lee el último registro', () => {
  const d = fresh();
  d.logs['2026-09-08'] = { date: '2026-09-08', habits: {}, metrics: { weight: 77.4 } };
  d.logs['2026-09-10'] = { date: '2026-09-10', habits: {}, metrics: { weight: 76.9 } };
  const g = { source: 'weight', start: 78, current: 78, target: 72 } as never;
  assert.equal(goalCurrent(d, g), 76.9);
});
test('ahorro acumulado y tasa de ahorro', () => {
  const d = fresh();
  d.money.push({ id: '1', date: '2026-09-10', type: 'ingreso', amount: 40000 });
  d.money.push({ id: '2', date: '2026-09-11', type: 'ahorro', amount: 6000 });
  d.money.push({ id: '3', date: '2026-09-12', type: 'inversion', amount: 2000 });
  const m = monthMoney(d, '2026-09');
  assert.equal(m.savingsRate, 0.2);
  assert.equal(goalCurrent(d, { source: 'savings', start: 1000 } as never), 7000);
});
test('ritmo de carrera', () => {
  assert.equal(fmtPace(pace(31, 5)), '6:12');
  assert.equal(fmtPace(pace(29.99, 5)), '6:00');
});
test('promedio móvil', () => {
  const m = movingAvg([{ date: '2026-09-01', value: 80 }, { date: '2026-09-02', value: 78 }]);
  assert.equal(m[1].value, 79);
});
test('normalize conserva datos y completa faltantes', () => {
  const n = normalize({ settings: { startDate: '2026-01-01' }, habits: [{ id: 'x', name: 'X' }] });
  assert.equal(n.settings.durationDays, 90);
  assert.equal(n.habits[0].frequency, 'daily');
  assert.deepEqual(n.logs, {});
});

console.log(`\n${passed} pruebas OK`);
