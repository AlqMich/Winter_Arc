import type { AppData, Habit, ISODate, Goal, DayLog, MetricKey } from './types';
import { addDays, diffDays, rangeDays, today, weekday, weekStart, monthKey } from './dates';

/* ------------------------------------------------------------------ */
/*  Reto                                                               */
/* ------------------------------------------------------------------ */

export interface ArcInfo {
  day: number;        // 1..total (0 si aún no empieza)
  total: number;
  daysLeft: number;   // incluye hoy
  pct: number;        // 0..1 del tiempo transcurrido
  endDate: ISODate;
  started: boolean;
  finished: boolean;
}

export function arcInfo(data: AppData, on: ISODate = today()): ArcInfo {
  const { startDate, durationDays } = data.settings;
  const total = Math.max(1, durationDays);
  const endDate = addDays(startDate, total - 1);
  const raw = diffDays(startDate, on) + 1;
  const started = raw >= 1;
  const finished = raw > total;
  const day = Math.min(Math.max(raw, 0), total);
  return {
    day, total, endDate, started, finished,
    daysLeft: finished ? 0 : started ? total - day + 1 : total,
    pct: finished ? 1 : started ? day / total : 0,
  };
}

export function inArc(data: AppData, d: ISODate): boolean {
  const { startDate, durationDays } = data.settings;
  const i = diffDays(startDate, d);
  return i >= 0 && i < durationDays;
}

/* ------------------------------------------------------------------ */
/*  Hábitos                                                            */
/* ------------------------------------------------------------------ */

export function activeHabits(data: AppData): Habit[] {
  return data.habits.filter((h) => !h.archived);
}

export function isScheduled(h: Habit, d: ISODate): boolean {
  return !h.archived && h.activeDays.includes(weekday(d));
}

export function workoutsOn(data: AppData, d: ISODate) {
  return data.workouts.filter((w) => w.date === d);
}

/** Valor registrado de un hábito ese día (undefined = sin registro). */
export function habitValue(data: AppData, h: Habit, d: ISODate): number | undefined {
  if (h.link === 'workout') {
    const n = workoutsOn(data, d).length;
    return n > 0 ? n : undefined;
  }
  const log = data.logs[d];
  if (!log) return undefined;
  if (h.link) return log.metrics[h.link as MetricKey];
  return log.habits[h.id];
}

/** Crédito 0..1. Da crédito parcial en metas numéricas: 2 de 2.5 L no es un cero. */
export function credit(h: Habit, v: number | undefined): number {
  if (v === undefined || v === null || Number.isNaN(v)) return 0;
  if (h.kind === 'check' || h.link === 'workout') return v >= 1 ? 1 : 0;
  if (h.target <= 0) return v > 0 ? 1 : 0;
  if (h.lessIsBetter) {
    if (v <= h.target) return 1;
    return Math.max(0, 1 - (v - h.target) / h.target);
  }
  return Math.min(1, v / h.target);
}

export function isDone(h: Habit, v: number | undefined): boolean {
  return credit(h, v) >= 0.999;
}

/* ------------------------------------------------------------------ */
/*  Score diario                                                       */
/* ------------------------------------------------------------------ */

export interface DayScore {
  score: number | null;   // 0..100, null si no hay nada programado
  earned: number;
  possible: number;
  done: number;           // hábitos completos
  total: number;          // hábitos que cuentan hoy
  hasData: boolean;
}

/**
 * Regla:
 *  - Hábitos diarios programados ese día: su peso siempre cuenta en el total.
 *  - Hábitos semanales (p. ej. Entrenar 4×/semana): suman cuando se hacen,
 *    pero un día de descanso NO baja el score. Se evalúan en la semana.
 *  - Metas numéricas dan crédito proporcional.
 */
export function dayScore(data: AppData, d: ISODate): DayScore {
  let earned = 0, possible = 0, done = 0, total = 0;
  for (const h of activeHabits(data)) {
    if (!isScheduled(h, d)) continue;
    const v = habitValue(data, h, d);
    const c = credit(h, v);
    if (h.frequency === 'weekly') {
      if (c > 0) { earned += h.weight * c; possible += h.weight; total++; if (c >= 0.999) done++; }
      continue;
    }
    possible += h.weight;
    earned += h.weight * c;
    total++;
    if (c >= 0.999) done++;
  }
  return {
    score: possible > 0 ? Math.round((earned / possible) * 100) : null,
    earned, possible, done, total, hasData: hasData(data, d),
  };
}

export function hasData(data: AppData, d: ISODate): boolean {
  const log: DayLog | undefined = data.logs[d];
  if (workoutsOn(data, d).length) return true;
  if (!log) return false;
  if (log.closed) return true;
  if (Object.values(log.habits).some((v) => v !== undefined && v !== null)) return true;
  return Object.values(log.metrics).some((v) => v !== undefined && v !== null);
}

export type DayStatus = 'done' | 'partial' | 'missed' | 'pending' | 'future' | 'outside';

export function dayStatus(data: AppData, d: ISODate, now: ISODate = today()): DayStatus {
  if (!inArc(data, d)) return 'outside';
  if (d > now) return 'future';
  const s = dayScore(data, d);
  const passed = s.score !== null && s.score >= data.settings.dayThreshold;
  if (passed) return 'done';
  if (d === now) return 'pending';
  return s.hasData ? 'partial' : 'missed';
}

/* ------------------------------------------------------------------ */
/*  Estadísticas del reto                                              */
/* ------------------------------------------------------------------ */

/** Días del reto ya "evaluables": desde el inicio hasta ayer, más hoy si ya cumpliste. */
export function evaluatedDays(data: AppData, now: ISODate = today()): ISODate[] {
  const a = arcInfo(data, now);
  if (!a.started) return [];
  const last = a.finished ? a.endDate : now;
  const days = rangeDays(data.settings.startDate, last);
  if (!a.finished && dayStatus(data, now, now) !== 'done') days.pop();
  return days;
}

/**
 * Rachas que premian constancia, no perfección:
 *  - Día cumplido (score ≥ umbral): suma 1.
 *  - Día flojo (registraste algo pero no llegaste): pausa la racha, no la rompe.
 *    Dos días flojos seguidos sí la rompen.
 *  - Día sin registro: rompe la racha.
 */
export function streaks(statuses: DayStatus[]): { current: number; best: number } {
  let run = 0, best = 0, softMiss = false;
  for (const st of statuses) {
    if (st === 'done') { run++; softMiss = false; }
    else if (st === 'partial' && !softMiss && run > 0) { softMiss = true; }
    else { run = 0; softMiss = false; }
    best = Math.max(best, run);
  }
  return { current: run, best };
}

export interface ArcStats {
  evaluated: number;
  done: number;
  partial: number;
  missed: number;
  consistency: number;      // done / evaluated (0..1) — la métrica principal
  consistency7: number;     // últimos 7 días evaluados
  avgScore: number;         // promedio de score (días sin registro = 0)
  totalPoints: number;      // score acumulado
  currentStreak: number;
  bestStreak: number;
}

export function arcStats(data: AppData, now: ISODate = today()): ArcStats {
  const days = evaluatedDays(data, now);
  let done = 0, partial = 0, missed = 0, points = 0;
  const statuses = days.map((d) => {
    const st = dayStatus(data, d, now);
    points += dayScore(data, d).score ?? 0;
    if (st === 'done') done++; else if (st === 'partial') partial++; else missed++;
    return st;
  });
  const { current, best } = streaks(statuses);
  const last7 = statuses.slice(-7);
  return {
    evaluated: days.length, done, partial, missed,
    consistency: days.length ? done / days.length : 0,
    consistency7: last7.length ? last7.filter((s) => s === 'done').length / last7.length : 0,
    avgScore: days.length ? Math.round(points / days.length) : 0,
    totalPoints: Math.round(points),
    currentStreak: current,
    bestStreak: best,
  };
}

/* ------------------------------------------------------------------ */
/*  Cumplimiento por hábito                                            */
/* ------------------------------------------------------------------ */

/** Cumplimiento 0..1 de un hábito entre `from` y `to` (inclusive). null = no aplica. */
export function habitCompliance(data: AppData, h: Habit, from: ISODate, to: ISODate): number | null {
  if (to < from) return null;
  if (h.frequency === 'weekly') {
    // Por semana: veces hechas / meta, prorrateado si la ventana es parcial.
    const days = rangeDays(from, to);
    const doneDays = days.filter((d) => credit(h, habitValue(data, h, d)) >= 0.999).length;
    const expected = (h.timesPerWeek * days.length) / 7;
    return expected > 0 ? Math.min(1, doneDays / expected) : null;
  }
  let sum = 0, n = 0;
  for (const d of rangeDays(from, to)) {
    if (!isScheduled(h, d)) continue;
    sum += credit(h, habitValue(data, h, d));
    n++;
  }
  return n ? sum / n : null;
}

export interface HabitRank { habit: Habit; pct: number }

/** Ventana de análisis: últimos `n` días evaluados (sin contar hoy si aún no cierra). */
export function recentWindow(data: AppData, n: number, now: ISODate = today()): [ISODate, ISODate] | null {
  const days = evaluatedDays(data, now);
  if (!days.length) return null;
  const to = days[days.length - 1];
  const from = days[Math.max(0, days.length - n)];
  return [from, to];
}

export function habitRanking(data: AppData, from: ISODate, to: ISODate): HabitRank[] {
  const out: HabitRank[] = [];
  for (const h of activeHabits(data)) {
    const c = habitCompliance(data, h, from, to);
    if (c !== null) out.push({ habit: h, pct: c });
  }
  return out.sort((a, b) => a.pct - b.pct);
}

/* ------------------------------------------------------------------ */
/*  Semana                                                             */
/* ------------------------------------------------------------------ */

export interface WeekDayRow {
  date: ISODate;
  score: number | null;
  status: DayStatus;
  done: number;
  total: number;
  workouts: number;
  weight?: number;
  sleep?: number;
}

export interface WeekSummary {
  start: ISODate;
  end: ISODate;
  rows: WeekDayRow[];
  avgScore: number | null;
  habitsPct: number | null;
  workouts: number;
  bestDay: WeekDayRow | null;
  daysDone: number;
  ranking: HabitRank[];
}

export function weekSummary(data: AppData, anyDay: ISODate, now: ISODate = today()): WeekSummary {
  const start = weekStart(anyDay);
  const end = addDays(start, 6);
  const rows: WeekDayRow[] = rangeDays(start, end).map((d) => {
    const s = dayScore(data, d);
    const log = data.logs[d];
    return {
      date: d, score: d <= now && inArc(data, d) ? s.score : null, status: dayStatus(data, d, now),
      done: s.done, total: s.total, workouts: workoutsOn(data, d).length,
      weight: log?.metrics.weight, sleep: log?.metrics.sleep,
    };
  });
  // Solo días ya transcurridos dentro del reto. Hoy cuenta solo si ya tiene registro.
  const counted = rows.filter((r) => inArc(data, r.date) && (r.date < now || (r.date === now && (r.status === 'done' || dayScore(data, r.date).hasData))));
  const scores = counted.map((r) => r.score ?? 0);
  const lastCounted = counted.length ? counted[counted.length - 1].date : null;
  const firstCounted = counted.length ? counted[0].date : null;
  const ranking = firstCounted && lastCounted ? habitRanking(data, firstCounted, lastCounted) : [];
  const habitsPct = ranking.length
    ? (() => {
        // Promedio ponderado por peso.
        let w = 0, s = 0;
        for (const r of ranking) { w += r.habit.weight; s += r.pct * r.habit.weight; }
        return w ? s / w : null;
      })()
    : null;
  const best = counted.reduce<WeekDayRow | null>((b, r) => (b === null || (r.score ?? 0) > (b.score ?? 0) ? r : b), null);
  return {
    start, end, rows,
    avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    habitsPct,
    workouts: rows.reduce((a, r) => a + r.workouts, 0),
    bestDay: best && (best.score ?? 0) > 0 ? best : null,
    daysDone: rows.filter((r) => r.status === 'done').length,
    ranking,
  };
}

/** Score promedio de un mes (días del reto ya evaluados). */
export function monthAvg(data: AppData, key: string, now: ISODate = today()): number | null {
  const days = evaluatedDays(data, now).filter((d) => monthKey(d) === key);
  if (!days.length) return null;
  return Math.round(days.reduce((a, d) => a + (dayScore(data, d).score ?? 0), 0) / days.length);
}

/* ------------------------------------------------------------------ */
/*  Hábitos semanales: ¿vas a tiempo?                                  */
/* ------------------------------------------------------------------ */

export interface WeeklyPace { habit: Habit; doneDays: number; target: number; daysLeft: number; behind: boolean }

export function weeklyPace(data: AppData, now: ISODate = today()): WeeklyPace[] {
  const start = weekStart(now);
  const daysLeft = diffDays(now, addDays(start, 6)) + 1; // incluye hoy
  return activeHabits(data).filter((h) => h.frequency === 'weekly').map((h) => {
    const doneDays = rangeDays(start, now).filter((d) => isDone(h, habitValue(data, h, d))).length;
    const remaining = Math.max(0, h.timesPerWeek - doneDays);
    return { habit: h, doneDays, target: h.timesPerWeek, daysLeft, behind: remaining > 0 && remaining >= daysLeft };
  });
}

/* ------------------------------------------------------------------ */
/*  Series para gráficas                                               */
/* ------------------------------------------------------------------ */

export interface Point { date: ISODate; value: number }

export function metricSeries(data: AppData, key: MetricKey): Point[] {
  return Object.values(data.logs)
    .filter((l) => typeof l.metrics[key] === 'number')
    .map((l) => ({ date: l.date, value: l.metrics[key] as number }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Promedio móvil de 7 días calendario (usa los registros existentes en la ventana). */
export function movingAvg(points: Point[], window = 7): Point[] {
  return points.map((p) => {
    const from = addDays(p.date, -(window - 1));
    const win = points.filter((q) => q.date >= from && q.date <= p.date);
    return { date: p.date, value: win.reduce((a, q) => a + q.value, 0) / win.length };
  });
}

export interface WeekBucket { weekStart: ISODate; value: number }

/** Suma por semana (lunes) dentro del reto. */
export function weeklyBuckets(data: AppData, fn: (d: ISODate) => number, now: ISODate = today()): WeekBucket[] {
  const a = arcInfo(data, now);
  if (!a.started) return [];
  const last = a.finished ? a.endDate : now;
  const out: WeekBucket[] = [];
  for (let ws = weekStart(data.settings.startDate); ws <= last; ws = addDays(ws, 7)) {
    let v = 0;
    for (const d of rangeDays(ws, addDays(ws, 6))) if (d <= last && inArc(data, d)) v += fn(d);
    out.push({ weekStart: ws, value: v });
  }
  return out;
}

export function runs(data: AppData) {
  return data.workouts
    .filter((w) => w.type === 'running' && (w.distance ?? 0) > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Ritmo en min/km, o null si falta dato. */
export function pace(duration?: number, distance?: number): number | null {
  if (!duration || !distance) return null;
  return duration / distance;
}

export function fmtPace(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return '—';
  let m = Math.floor(p);
  let s = Math.round((p - m) * 60);
  if (s === 60) { m += 1; s = 0; }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Objetivos                                                          */
/* ------------------------------------------------------------------ */

export function lastMetric(data: AppData, key: MetricKey): number | undefined {
  const s = metricSeries(data, key);
  return s.length ? s[s.length - 1].value : undefined;
}

export function goalCurrent(data: AppData, g: Goal): number {
  switch (g.source) {
    case 'weight': return lastMetric(data, 'weight') ?? g.current;
    case 'waist': return lastMetric(data, 'waist') ?? g.current;
    case 'longestRun': {
      const r = runs(data).filter((w) => w.date >= data.settings.startDate);
      return r.length ? Math.max(g.start, ...r.map((w) => w.distance ?? 0)) : g.current;
    }
    case 'savings': {
      const saved = data.money
        .filter((m) => m.type === 'ahorro' && m.date >= data.settings.startDate)
        .reduce((a, m) => a + m.amount, 0);
      return g.start + saved;
    }
    case 'monthIncome':
      return monthMoney(data, monthKey(today())).ingreso;
    default: return g.current;
  }
}

/** Progreso 0..1, funciona para metas que suben (ahorro) o bajan (peso). */
export function goalProgress(g: Goal, current: number): number {
  const span = g.target - g.start;
  if (span === 0) return current === g.target ? 1 : 0;
  return Math.max(0, Math.min(1, (current - g.start) / span));
}

/** Avance esperado según el tiempo transcurrido hacia la fecha objetivo. null si no hay fecha. */
export function goalExpected(g: Goal, data: AppData, now: ISODate = today()): number | null {
  const from = data.settings.startDate;
  const to = g.dueDate ?? arcInfo(data, now).endDate;
  const span = diffDays(from, to);
  if (span <= 0) return null;
  return Math.max(0, Math.min(1, diffDays(from, now) / span));
}

/* ------------------------------------------------------------------ */
/*  Finanzas                                                           */
/* ------------------------------------------------------------------ */

export interface MonthMoney { ingreso: number; gasto: number; ahorro: number; inversion: number; savingsRate: number | null }

export function monthMoney(data: AppData, key: string): MonthMoney {
  const m = { ingreso: 0, gasto: 0, ahorro: 0, inversion: 0 };
  for (const e of data.money) if (monthKey(e.date) === key) m[e.type] += e.amount;
  return { ...m, savingsRate: m.ingreso > 0 ? (m.ahorro + m.inversion) / m.ingreso : null };
}
