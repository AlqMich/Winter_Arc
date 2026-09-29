// Acceso a Netlify Blobs. En pruebas se inyecta un store en memoria con setStore().
let override = null;
export function setStore(s) { override = s; }
export async function store() {
  if (override) return override;
  const { getStore } = await import('@netlify/blobs');
  return getStore({ name: 'winter-arc-push', consistency: 'strong' });
}

import { generateVapidKeys } from './webpush.mjs';

/** Llaves VAPID: se generan solas la primera vez y se guardan en Blobs (o se toman de variables de entorno). */
export async function vapidKeys(s) {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const existing = await s.get('vapid', { type: 'json' });
  if (existing && existing.publicKey) return existing;
  const keys = generateVapidKeys();
  await s.setJSON('vapid', keys);
  return keys;
}

export function subject() {
  return process.env.VAPID_SUBJECT || process.env.URL || 'https://winter-arc.netlify.app';
}
