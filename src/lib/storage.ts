import type { AppData, Habit } from './types';
import { defaultData, defaultReminders } from './defaults';

/**
 * Adaptador de almacenamiento. Hoy: localStorage.
 * Para migrar a un backend (Supabase, Firebase, API propia) basta con implementar
 * esta misma interfaz y cambiar `storage` abajo.
 */
export interface StorageAdapter {
  load(): AppData | null;
  save(data: AppData): boolean;
  clear(): void;
}

const KEY = 'winter-arc:data:v1';
const BACKUP_KEY = 'winter-arc:data:prev';

export const localAdapter: StorageAdapter = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AppData;
    } catch {
      // Si el JSON principal se corrompe, intenta la copia anterior.
      try {
        const prev = localStorage.getItem(BACKUP_KEY);
        return prev ? (JSON.parse(prev) as AppData) : null;
      } catch {
        return null;
      }
    }
  },
  save(data) {
    try {
      const raw = JSON.stringify(data);
      const current = localStorage.getItem(KEY);
      if (current) localStorage.setItem(BACKUP_KEY, current);
      localStorage.setItem(KEY, raw);
      return true;
    } catch {
      return false;
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(BACKUP_KEY);
    } catch { /* sin acceso a storage */ }
  },
};

export const storage: StorageAdapter = localAdapter;

/** Completa campos faltantes (datos viejos o backups parciales) sin perder nada. */
export function normalize(input: unknown): AppData {
  const base = defaultData();
  if (!input || typeof input !== 'object') return base;
  const d = input as Partial<AppData>;
  return {
    version: 1,
    settings: { ...base.settings, ...(d.settings ?? {}) },
    categories: Array.isArray(d.categories) && d.categories.length ? d.categories : base.categories,
    habits: Array.isArray(d.habits)
      ? (d.habits as Partial<Habit>[]).map((h) => ({
          kind: 'check' as const, target: 1, unit: '', step: 1, frequency: 'daily' as const, timesPerWeek: 7,
          activeDays: [0, 1, 2, 3, 4, 5, 6], weight: 10, categoryId: base.categories[0].id, ...h,
        }) as Habit)
      : base.habits,
    logs: d.logs && typeof d.logs === 'object' ? d.logs : {},
    workouts: Array.isArray(d.workouts) ? d.workouts : [],
    goals: Array.isArray(d.goals) ? d.goals : [],
    money: Array.isArray(d.money) ? d.money : [],
    notes: Array.isArray(d.notes) ? d.notes : [],
    reviews: d.reviews && typeof d.reviews === 'object' ? d.reviews : {},
    reminders: Array.isArray(d.reminders) ? d.reminders : defaultReminders(d.settings?.reminderTime || '21:00'),
  };
}

/** Pide al navegador que no borre los datos por falta de espacio (PWA instalada). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch { /* no soportado */ }
  return false;
}
