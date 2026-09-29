import { createContext, useContext } from 'react';
import type { ISODate } from './lib/types';

export type Tab = 'hoy' | 'semana' | 'progreso' | 'metas' | 'mas';
export type Sub = null | 'entrenos' | 'finanzas' | 'notas' | 'habitos' | 'ajustes' | 'datos';

export interface Nav {
  tab: Tab;
  sub: Sub;
  go: (t: Tab, sub?: Sub) => void;
  openDay: (d: ISODate) => void;
  openWeek: (d: ISODate) => void;
  weekAnchor: ISODate;
}

export const NavCtx = createContext<Nav | null>(null);
export function useNav(): Nav {
  const n = useContext(NavCtx);
  if (!n) throw new Error('Nav missing');
  return n;
}
