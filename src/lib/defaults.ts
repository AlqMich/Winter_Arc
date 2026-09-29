import type { AppData, Habit, Goal, GoalCategory, GoalSource, Reminder } from './types';
import { today } from './dates';

const ALL = [0, 1, 2, 3, 4, 5, 6];

function h(p: Partial<Habit> & Pick<Habit, 'id' | 'name' | 'categoryId'>): Habit {
  return {
    kind: 'check', target: 1, unit: '', step: 1, frequency: 'daily', timesPerWeek: 7,
    activeDays: ALL, weight: 10, ...p,
  };
}

/** Configuración inicial editable. No contiene datos personales: solo metas genéricas. */
export function defaultData(): AppData {
  return {
    version: 1,
    settings: {
      startDate: today(),
      durationDays: 90,
      dayThreshold: 70,
      theme: 'system',
      reminderTime: '21:00',
      monthlySavingsTarget: 0,
      currency: 'MXN',
      weightUnit: 'kg',
      onboarded: false,
    },
    categories: [
      { id: 'cuerpo', name: 'Cuerpo' },
      { id: 'mente', name: 'Mente' },
      { id: 'trabajo', name: 'Trabajo' },
      { id: 'vida', name: 'Vida' },
    ],
    habits: [
      h({ id: 'entrenar', name: 'Entrenar', categoryId: 'cuerpo', frequency: 'weekly', timesPerWeek: 4, weight: 20, link: 'workout' }),
      h({ id: 'alimentacion', name: 'Comer según el plan', categoryId: 'cuerpo', weight: 20 }),
      h({ id: 'sueno', name: 'Dormir', categoryId: 'cuerpo', kind: 'number', target: 7.5, unit: 'h', step: 0.5, weight: 15, link: 'sleep' }),
      h({ id: 'agua', name: 'Agua', categoryId: 'cuerpo', kind: 'number', target: 2.5, unit: 'L', step: 0.25, weight: 10, link: 'water' }),
      h({ id: 'pasos', name: 'Pasos', categoryId: 'cuerpo', kind: 'number', target: 8000, unit: 'pasos', step: 1000, weight: 5, link: 'steps' }),
      h({ id: 'lectura', name: 'Lectura', categoryId: 'mente', kind: 'number', target: 20, unit: 'min', step: 5, weight: 5 }),
      h({ id: 'reflexion', name: 'Meditación / reflexión', categoryId: 'mente', weight: 5 }),
      h({ id: 'redes', name: 'Redes sociales', categoryId: 'mente', kind: 'number', target: 60, unit: 'min', step: 15, weight: 5, link: 'distraction', lessIsBetter: true, notes: 'Máximo permitido al día' }),
      h({ id: 'objetivo', name: 'Objetivo principal del día', categoryId: 'trabajo', weight: 10, link: 'mainGoal' }),
      h({ id: 'profundo', name: 'Trabajo profundo', categoryId: 'trabajo', kind: 'number', target: 2, unit: 'h', step: 0.5, weight: 15, link: 'deepWork', activeDays: [1, 2, 3, 4, 5] }),
      h({ id: 'orden', name: 'Orden', categoryId: 'vida', weight: 5 }),
      h({ id: 'finanzas', name: 'Registrar gastos', categoryId: 'vida', weight: 5 }),
    ],
    logs: {},
    workouts: [],
    goals: [],
    money: [],
    notes: [],
    reviews: {},
    reminders: defaultReminders(),
  };
}

/** Horarios genéricos y editables. Solo "Cerrar el día" viene activo. */
export function defaultReminders(closeTime = '21:00'): Reminder[] {
  return [
    { id: 'wake', kind: 'wake', enabled: false, time: '07:00', days: [] },
    { id: 'water', kind: 'water', enabled: false, time: '10:00', until: '20:00', every: 120, days: [] },
    { id: 'workout', kind: 'workout', enabled: false, time: '18:00', days: [] },
    { id: 'close', kind: 'close', enabled: true, time: closeTime, days: [] },
    { id: 'sleep', kind: 'sleep', enabled: false, time: '22:30', days: [] },
  ];
}

export interface GoalTemplate {
  name: string; category: GoalCategory; unit: string; source: GoalSource; hint: string;
}

/** Plantillas: el usuario pone los números, la app nunca los inventa. */
export const GOAL_TEMPLATES: GoalTemplate[] = [
  { name: 'Peso', category: 'fisico', unit: 'kg', source: 'weight', hint: 'Se actualiza con tu último peso registrado' },
  { name: 'Cintura', category: 'fisico', unit: 'cm', source: 'waist', hint: 'Se actualiza con tu última medida' },
  { name: 'Carrera más larga', category: 'fisico', unit: 'km', source: 'longestRun', hint: 'Toma tu running más largo del reto' },
  { name: 'Ahorro', category: 'financiero', unit: '$', source: 'savings', hint: 'Suma lo que registres como ahorro' },
  { name: 'Cotizaciones', category: 'profesional', unit: 'cotizaciones', source: 'manual', hint: 'Suma con +1 cada vez que envíes una' },
  { name: 'Ventas', category: 'profesional', unit: '$', source: 'manual', hint: 'Actualiza el monto vendido' },
  { name: 'Proyectos entregados', category: 'profesional', unit: 'proyectos', source: 'manual', hint: 'Suma con +1' },
  { name: 'Nuevos clientes', category: 'profesional', unit: 'clientes', source: 'manual', hint: 'Suma con +1' },
];

export function newGoal(p: Partial<Goal>): Goal {
  return {
    id: uid(), name: '', category: 'personal', unit: '', start: 0, current: 0, target: 0,
    source: 'manual', createdAt: Date.now(), ...p,
  };
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
