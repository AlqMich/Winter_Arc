// Modelo de datos del Winter Arc.
// Todo vive en un único objeto `AppData` versionado. La capa de almacenamiento
// (storage.ts) solo sabe guardar/cargar ese objeto, así que migrar a un backend
// consiste en reemplazar el adaptador, no la app.

export type ISODate = string; // YYYY-MM-DD en hora local

export interface Category {
  id: string;
  name: string;
}

/**
 * Métricas del día que un hábito puede "leer" en lugar de guardar su propio valor.
 * Así Agua, Sueño o Pasos se registran una sola vez y alimentan hábito + gráficas.
 */
export type MetricKey =
  | 'weight' | 'waist' | 'steps' | 'water' | 'sleep' | 'calories'
  | 'energy' | 'mood' | 'stress' | 'motivation'
  | 'foodQuality' | 'meals' | 'protein' | 'alcohol' | 'offPlan'
  | 'workHours' | 'deepWork' | 'mainGoal' | 'importantTasks' | 'focus' | 'distraction';

export type HabitKind = 'check' | 'number';

export interface Habit {
  id: string;
  name: string;
  categoryId: string;
  kind: HabitKind;
  /** Meta diaria (number) o 1 (check). Para 'lessIsBetter' es el máximo permitido. */
  target: number;
  unit: string;
  /** Incremento del botón + / − */
  step: number;
  /** 'daily' = cuenta cada día activo. 'weekly' = N veces por semana. */
  frequency: 'daily' | 'weekly';
  timesPerWeek: number;
  /** 0 = domingo … 6 = sábado */
  activeDays: number[];
  weight: number;
  time?: string;
  notes?: string;
  /** Si está enlazado, el valor se lee de la métrica del día (o de entrenamientos). */
  link?: MetricKey | 'workout';
  lessIsBetter?: boolean;
  archived?: boolean;
}

export interface DayMetrics {
  weight?: number; waist?: number; steps?: number; water?: number; sleep?: number; calories?: number;
  energy?: number; mood?: number; stress?: number; motivation?: number;
  foodQuality?: number; meals?: number; protein?: number; alcohol?: number; offPlan?: number;
  workHours?: number; deepWork?: number; mainGoal?: number; importantTasks?: number; focus?: number; distraction?: number;
}

export interface DayLog {
  date: ISODate;
  habits: Record<string, number>;
  metrics: DayMetrics;
  wentWell?: string;
  improve?: string;
  foodNotes?: string;
  closed?: boolean;
  updatedAt?: number;
}

export type WorkoutType = 'running' | 'gym' | 'walk' | 'mobility' | 'other';

export interface WorkoutSet {
  exercise: string;
  sets?: number;
  reps?: number;
  weight?: number;
}

export interface Workout {
  id: string;
  date: ISODate;
  type: WorkoutType;
  duration?: number; // min
  distance?: number; // km
  rpe?: number; // 1-10
  sets?: WorkoutSet[];
  notes?: string;
  createdAt: number;
}

export type GoalCategory = 'fisico' | 'profesional' | 'financiero' | 'personal';
/** Fuente automática del valor actual. 'manual' = lo actualizas tú. */
export type GoalSource = 'manual' | 'weight' | 'waist' | 'longestRun' | 'savings' | 'monthIncome';

export interface Goal {
  id: string;
  name: string;
  category: GoalCategory;
  unit: string;
  start: number;
  current: number;
  target: number;
  dueDate?: ISODate;
  source: GoalSource;
  createdAt: number;
  archived?: boolean;
}

export type MoneyType = 'ingreso' | 'gasto' | 'ahorro' | 'inversion';

export interface MoneyEntry {
  id: string;
  date: ISODate;
  type: MoneyType;
  amount: number;
  concept?: string;
}

export type NoteType = 'idea' | 'reflexion' | 'problema' | 'aprendizaje' | 'objetivo' | 'recordar';

export interface Note {
  id: string;
  type: NoteType;
  text: string;
  date?: ISODate;
  createdAt: number;
}

export interface WeeklyReview {
  weekStart: ISODate; // lunes
  didWell?: string;
  didnt?: string;
  worstHabit?: string;
  improved?: string;
  fix?: string;
  priority?: string;
  savedAt?: number;
}

export interface Settings {
  startDate: ISODate;
  durationDays: number;
  /** Score mínimo para que un día cuente como "cumplido" (racha y consistencia). */
  dayThreshold: number;
  theme: 'system' | 'light' | 'dark';
  reminderTime?: string; // HH:MM, aviso en la app para cerrar el día
  monthlySavingsTarget: number;
  currency: string;
  weightUnit: string;
  onboarded: boolean;
}

export interface AppData {
  version: 1;
  settings: Settings;
  categories: Category[];
  habits: Habit[];
  logs: Record<ISODate, DayLog>;
  workouts: Workout[];
  goals: Goal[];
  money: MoneyEntry[];
  notes: Note[];
  reviews: Record<ISODate, WeeklyReview>;
}
