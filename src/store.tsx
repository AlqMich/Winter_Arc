import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AppData, DayLog, ISODate } from './lib/types';
import { storage, normalize, requestPersistence } from './lib/storage';
import { defaultData } from './lib/defaults';
import { today } from './lib/dates';

type Updater = (draft: AppData) => void;

interface Store {
  data: AppData;
  update: (fn: Updater) => void;
  replace: (next: AppData) => void;
  lastSaved: number | null;
  saveError: boolean;
  /** Día que se está viendo/registrando en "Hoy". */
  day: ISODate;
  setDay: (d: ISODate) => void;
  now: ISODate;
}

const Ctx = createContext<Store | null>(null);

function initial(): AppData {
  const loaded = storage.load();
  return loaded ? normalize(loaded) : defaultData();
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(initial);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [now, setNow] = useState<ISODate>(today());
  const [day, setDay] = useState<ISODate>(today());
  const pending = useRef<AppData | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = undefined; }
    if (!pending.current) return;
    const ok = storage.save(pending.current);
    pending.current = null;
    setSaveError(!ok);
    if (ok) setLastSaved(Date.now());
  }, []);

  const schedule = useCallback((next: AppData) => {
    pending.current = next;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 250);
  }, [flush]);

  const update = useCallback((fn: Updater) => {
    setData((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      schedule(draft);
      return draft;
    });
  }, [schedule]);

  const replace = useCallback((next: AppData) => {
    const n = normalize(next);
    setData(n);
    pending.current = n;
    flush();
  }, [flush]);

  // Guardado inmediato al salir/cerrar/cambiar de app (clave en iOS).
  useEffect(() => {
    const onHide = () => flush();
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
      else {
        // Al volver a la app al día siguiente, "Hoy" debe ser hoy.
        const t = today();
        setNow((prev) => {
          if (prev !== t) setDay((d) => (d === prev ? t : d));
          return t;
        });
      }
    };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onVis);
    const tick = window.setInterval(onVis, 60_000);
    requestPersistence();
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(tick);
    };
  }, [flush]);

  const value = useMemo<Store>(() => ({ data, update, replace, lastSaved, saveError, day, setDay, now }), [data, update, replace, lastSaved, saveError, day, now]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

/** Devuelve (creando si hace falta) el registro de un día dentro de un draft. */
export function ensureLog(draft: AppData, d: ISODate): DayLog {
  if (!draft.logs[d]) draft.logs[d] = { date: d, habits: {}, metrics: {} };
  draft.logs[d].updatedAt = Date.now();
  return draft.logs[d];
}
