import type { AppData, ISODate } from './types';
import { today, rangeDays, addDays, weekday } from './dates';
import { activeHabits, credit, habitValue, isScheduled, workoutsOn } from './score';

// Cliente de notificaciones push. El servidor (netlify/functions) guarda la suscripción,
// los recordatorios y un resumen del día para no avisar de lo que ya hiciste.

const ID_KEY = 'winter-arc:push-id';
const ON_KEY = 'winter-arc:push-on';
const API = '/api/push/';

export type PushState =
  | 'unsupported'   // navegador sin Web Push
  | 'needs-install' // iPhone: hay que abrirla desde la pantalla de inicio
  | 'no-server'     // versión sin servidor (p. ej. el artefacto de vista previa)
  | 'denied'        // el usuario bloqueó las notificaciones
  | 'off'
  | 'on';

function ls(k: string, v?: string | null): string | null {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  } catch { /* sin storage */ }
  return null;
}

export function deviceId(): string {
  let id = ls(ID_KEY);
  if (!id) {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    id = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    ls(ID_KEY, id);
  }
  return id;
}

export const isEnabledLocally = () => ls(ON_KEY) === '1';

export function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function pushState(): Promise<PushState> {
  const hasPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!hasPush) return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const r = await fetch(`${API}key`, { cache: 'no-store' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return 'no-server';
  } catch { return 'no-server'; }
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && isEnabledLocally() ? 'on' : 'off';
}

function urlB64ToUint8(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Debe llamarse desde un toque del usuario (requisito de iOS). */
export async function enablePush(data: AppData): Promise<{ ok: boolean; error?: string }> {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, error: 'Permiso de notificaciones no concedido.' };
    const reg = await navigator.serviceWorker.ready;
    const { publicKey } = await (await fetch(`${API}key`, { cache: 'no-store' })).json();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(publicKey) as BufferSource });
      } catch {
        return { ok: false, error: 'El teléfono no pudo registrarse para notificaciones. Revisa tu conexión e intenta de nuevo.' };
      }
    }
    const res = await fetch(`${API}subscribe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deviceId(), subscription: sub.toJSON(), ...syncPayload(data) }),
    });
    if (!res.ok) return { ok: false, error: 'El servidor no aceptó la suscripción.' };
    ls(ON_KEY, '1');
    return { ok: true };
  } catch (e) {
    void e;
    return { ok: false, error: 'No se pudieron activar las notificaciones. Revisa tu conexión e intenta de nuevo.' };
  }
}

export async function disablePush(): Promise<void> {
  ls(ON_KEY, null);
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch { /* ya no existe */ }
  try {
    await fetch(`${API}unsubscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deviceId() }) });
  } catch { /* sin conexión */ }
}

export async function testPush(): Promise<boolean> {
  try {
    const r = await fetch(`${API}test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deviceId() }) });
    return r.ok;
  } catch { return false; }
}

/** Envía recordatorios + resumen del día. keepalive permite completarlo al cerrar la app. */
export function syncPush(data: AppData): void {
  if (!isEnabledLocally()) return;
  try {
    fetch(`${API}sync`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ id: deviceId(), ...syncPayload(data) }),
    }).catch(() => {});
  } catch { /* sin conexión: se reintenta en el siguiente cambio */ }
}

export function syncPayload(data: AppData, d: ISODate = today()) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City';
  return { tz, reminders: data.reminders, status: dayStatusSnapshot(data, d), arc: { startDate: data.settings.startDate, durationDays: data.settings.durationDays }, plan: weekPlan(data) };
}

/** Resumen compacto del día para recordatorios inteligentes. */
export function dayStatusSnapshot(data: AppData, d: ISODate) {
  const habits: Record<string, { name: string; done: boolean; value?: number; target?: number; unit?: string; scheduled: boolean }> = {};
  let water: { value: number; target: number; unit: string } | undefined;
  let sleepTarget: number | undefined;
  for (const h of activeHabits(data)) {
    const v = habitValue(data, h, d);
    const scheduled = isScheduled(h, d) && h.frequency === 'daily';
    habits[h.id] = { name: h.name, done: credit(h, v) >= 0.999, scheduled, ...(h.kind === 'number' ? { value: v ?? 0, target: h.target, unit: h.unit } : {}) };
    if (h.link === 'water') water = { value: v ?? 0, target: h.target, unit: h.unit || 'L' };
    if (h.link === 'sleep') sleepTarget = h.target;
  }
  return { date: d, closed: !!data.logs[d]?.closed, workoutDone: workoutsOn(data, d).length > 0, habits, water, sleepTarget };
}

/** Qué toca cada día de la semana (para el aviso de la mañana), ordenado por importancia. */
export function weekPlan(data: AppData): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  const base = today();
  for (const d of rangeDays(base, addDays(base, 6))) {
    out[weekday(d)] = activeHabits(data)
      .filter((h) => isScheduled(h, d))
      .sort((a, b) => b.weight - a.weight)
      .map((h) => (h.kind === 'number' && !h.lessIsBetter ? `${h.name} ${h.target} ${h.unit}`.trim() : h.name));
  }
  return out;
}
