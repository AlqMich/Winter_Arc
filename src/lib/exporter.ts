import type { AppData, DayMetrics } from './types';
import { dayScore, habitValue } from './score';
import { rangeDays, today } from './dates';

const METRIC_COLS: (keyof DayMetrics)[] = [
  'weight', 'waist', 'steps', 'water', 'sleep', 'calories', 'energy', 'mood', 'stress', 'motivation',
  'foodQuality', 'meals', 'protein', 'alcohol', 'offPlan', 'workHours', 'deepWork', 'mainGoal',
  'importantTasks', 'focus', 'distraction',
];

function cell(v: unknown): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(rows: unknown[][]): string {
  return rows.map((r) => r.map(cell).join(',')).join('\n');
}

export function toJSON(data: AppData): string {
  return JSON.stringify({ app: 'winter-arc', exportedAt: new Date().toISOString(), data }, null, 2);
}

export function daysCSV(data: AppData): string {
  const habits = data.habits.filter((h) => !h.archived);
  const dates = Object.keys(data.logs).concat(data.workouts.map((w) => w.date));
  const first = [data.settings.startDate, ...dates].sort()[0];
  const last = [today(), ...dates].sort().slice(-1)[0];
  const header = ['fecha', 'score', ...habits.map((h) => h.name), ...METRIC_COLS, 'que_salio_bien', 'que_mejorar'];
  const rows: unknown[][] = [header];
  for (const d of rangeDays(first, last)) {
    const log = data.logs[d];
    const ws = data.workouts.some((w) => w.date === d);
    if (!log && !ws) continue;
    rows.push([
      d, dayScore(data, d).score,
      ...habits.map((h) => habitValue(data, h, d)),
      ...METRIC_COLS.map((k) => log?.metrics[k]),
      log?.wentWell, log?.improve,
    ]);
  }
  return csv(rows);
}

export function workoutsCSV(data: AppData): string {
  return csv([
    ['fecha', 'tipo', 'duracion_min', 'distancia_km', 'esfuerzo', 'ejercicios', 'notas'],
    ...data.workouts.map((w) => [
      w.date, w.type, w.duration, w.distance, w.rpe,
      (w.sets ?? []).map((s) => `${s.exercise} ${s.sets ?? ''}x${s.reps ?? ''} @${s.weight ?? ''}`).join(' | '),
      w.notes,
    ]),
  ]);
}

export function moneyCSV(data: AppData): string {
  return csv([['fecha', 'tipo', 'monto', 'concepto'], ...data.money.map((m) => [m.date, m.type, m.amount, m.concept])]);
}

export function goalsCSV(data: AppData): string {
  return csv([
    ['objetivo', 'categoria', 'unidad', 'inicial', 'actual', 'meta', 'fecha_objetivo'],
    ...data.goals.map((g) => [g.name, g.category, g.unit, g.start, g.current, g.target, g.dueDate]),
  ]);
}

export function mealsCSV(data: AppData): string {
  const rows: unknown[][] = [['fecha', 'comida', 'hora', 'alimento', 'cantidad', 'medida', 'gramos', 'kcal', 'proteina_g', 'carbohidratos_g', 'grasa_g', 'calidad']];
  for (const m of [...data.meals].sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))) {
    for (const i of m.items) rows.push([m.date, m.slot, m.time, i.name, i.qty, i.unit, i.grams, i.kcal, i.p, i.c, i.f, m.quality === 3 ? 'bien' : m.quality === 2 ? 'regular' : m.quality === 1 ? 'mal' : '']);
  }
  return csv(rows);
}

export function notesCSV(data: AppData): string {
  return csv([['fecha', 'tipo', 'nota'], ...data.notes.map((n) => [n.date, n.type, n.text])]);
}

/** Intenta descargar. Devuelve false si el entorno lo bloquea (p. ej. vista previa embebida). */
export function download(filename: string, content: string, mime = 'text/plain'): boolean {
  try {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

/** Comparte el archivo con la hoja nativa de iOS (Guardar en Archivos, AirDrop…). */
export async function shareFile(filename: string, content: string, mime: string): Promise<boolean> {
  try {
    const file = new File([content], filename, { type: mime });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return true;
    }
  } catch { /* cancelado o no soportado */ }
  return false;
}
