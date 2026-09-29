import type { ISODate } from './types';

// Todas las fechas se manejan como YYYY-MM-DD en hora LOCAL.
// Nunca usamos toISOString() para fechas: en México (UTC-6) después de las 18:00
// devolvería el día siguiente.

export function toISO(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // mediodía: inmune a cambios de horario
}

export function today(): ISODate {
  return toISO(new Date());
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Días enteros de a → b (b − a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export function weekday(s: ISODate): number {
  return parseISO(s).getDay();
}

/** Lunes de la semana de `s`. */
export function weekStart(s: ISODate): ISODate {
  const wd = weekday(s);
  return addDays(s, wd === 0 ? -6 : 1 - wd);
}

export function rangeDays(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const n = diffDays(from, to);
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

export function monthKey(s: ISODate): string {
  return s.slice(0, 7);
}

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DOW_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MON_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const dowShort = (s: ISODate) => DOW[weekday(s)];
export const dowLong = (s: ISODate) => DOW_LONG[weekday(s)];
export const DOW_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function fmtShort(s: ISODate): string {
  const d = parseISO(s);
  return `${d.getDate()} ${MON[d.getMonth()]}`;
}

export function fmtLong(s: ISODate): string {
  const d = parseISO(s);
  return `${DOW_LONG[d.getDay()]} ${d.getDate()} de ${MON_LONG[d.getMonth()]}`;
}

export function fmtMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MON_LONG[m - 1]} ${y}`;
}
