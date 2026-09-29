import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StoreProvider, useStore } from './store';
import { NavCtx, type Nav, type Sub, type Tab } from './nav';
import { UiProvider, Sheet, Field, NumInput, cx } from './ui/kit';
import { IconToday, IconWeek, IconChart, IconTarget, IconMore, IconLeft } from './ui/icons';
import Today from './screens/Today';
import Week from './screens/Week';
import Progress from './screens/Progress';
import Goals from './screens/Goals';
import More, { Workouts, Notes } from './screens/More';
import Finance from './screens/Finance';
import { HabitsAdmin, Settings, DataScreen } from './screens/Setup';
import Reminders from './screens/Reminders';
import { syncPush } from './lib/push';
import { today, fmtLong, addDays } from './lib/dates';
import type { ISODate } from './lib/types';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'hoy', label: 'Hoy', icon: <IconToday /> },
  { id: 'semana', label: 'Semana', icon: <IconWeek /> },
  { id: 'progreso', label: 'Progreso', icon: <IconChart /> },
  { id: 'metas', label: 'Objetivos', icon: <IconTarget /> },
  { id: 'mas', label: 'Más', icon: <IconMore /> },
];

const SUB_TITLES: Record<Exclude<Sub, null>, string> = {
  recordatorios: 'Recordatorios', entrenos: 'Entrenamientos', finanzas: 'Finanzas', notas: 'Notas', habitos: 'Hábitos', ajustes: 'Ajustes', datos: 'Datos y respaldo',
};

function Shell() {
  const { data, setDay } = useStore();
  const [tab, setTab] = useState<Tab>('hoy'); // "Hoy" siempre es la pantalla de entrada
  const [sub, setSub] = useState<Sub>(null);
  const [weekAnchor, setWeekAnchor] = useState<ISODate>(today());

  const go = useCallback((t: Tab, s: Sub = null) => {
    setTab(t); setSub(s);
    window.scrollTo({ top: 0 });
  }, []);
  const openDay = useCallback((d: ISODate) => { setDay(d); go('hoy'); }, [go, setDay]);
  const openWeek = useCallback((d: ISODate) => { setWeekAnchor(d); go('semana'); }, [go]);
  const nav = useMemo<Nav>(() => ({ tab, sub, go, openDay, openWeek, weekAnchor }), [tab, sub, go, openDay, openWeek, weekAnchor]);

  // Tema
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    if (data.settings.theme !== 'system') root.classList.add(`theme-${data.settings.theme}`);
    const dark = data.settings.theme === 'dark' || (data.settings.theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d0f12' : '#f1f3f5');
  }, [data.settings.theme]);

  // Notificaciones: mantiene al servidor al tanto de recordatorios y de lo que ya registraste hoy.
  const dataRef = React.useRef(data);
  dataRef.current = data;
  useEffect(() => {
    const t = window.setTimeout(() => syncPush(data), 4000);
    return () => window.clearTimeout(t);
  }, [data]);
  useEffect(() => {
    syncPush(dataRef.current);
    const onVis = () => { if (document.visibilityState === 'hidden') syncPush(dataRef.current); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Botón atrás del sistema / gesto: cierra subpágina en lugar de salir.
  useEffect(() => {
    const onPop = () => setSub(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (sub) { try { history.pushState({ sub }, ''); } catch { /* entorno sin history */ } }
  }, [sub]);

  let screen: React.ReactNode;
  if (tab === 'mas' && sub) {
    screen = (
      <>
        <header className="sub-head">
          <button className="icon-btn" aria-label="Volver" onClick={() => go('mas')}><IconLeft /></button>
          <h1 className="title">{SUB_TITLES[sub]}</h1>
        </header>
        {sub === 'entrenos' && <Workouts />}
        {sub === 'finanzas' && <Finance />}
        {sub === 'notas' && <Notes />}
        {sub === 'habitos' && <HabitsAdmin />}
        {sub === 'ajustes' && <Settings />}
        {sub === 'datos' && <DataScreen />}
        {sub === 'recordatorios' && <Reminders />}
      </>
    );
  } else {
    screen = tab === 'hoy' ? <Today /> : tab === 'semana' ? <Week /> : tab === 'progreso' ? <Progress /> : tab === 'metas' ? <Goals /> : <More />;
  }

  return (
    <NavCtx.Provider value={nav}>
      <main className="app" key={`${tab}-${sub ?? ''}`}>{screen}</main>
      <nav className="tabbar" aria-label="Navegación principal">
        {TABS.map((t) => (
          <button key={t.id} className={cx('tab', tab === t.id && 'on')} aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => { if (t.id === 'hoy') setDay(today()); go(t.id); }}>
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </nav>
      <Onboarding />
    </NavCtx.Provider>
  );
}

/** Primer arranque: solo lo indispensable. Todo lo demás tiene valores editables. */
function Onboarding() {
  const { data, update } = useStore();
  const [start, setStart] = useState(data.settings.startDate);
  const [dur, setDur] = useState<number | undefined>(data.settings.durationDays);
  const open = !data.settings.onboarded;
  const finish = () => update((d) => {
    d.settings.startDate = start || today();
    d.settings.durationDays = dur && dur > 0 ? Math.round(dur) : 90;
    d.settings.onboarded = true;
  });
  return (
    <Sheet open={open} onClose={finish} title="Tu Winter Arc"
      footer={<button className="btn btn-primary btn-block" onClick={finish}>Empezar</button>}>
      <div className="stack">
        <p className="muted">Define cuándo empieza el reto. La app calcula el día, tu score y tu progreso a partir de aquí. Todo se puede cambiar después en Ajustes.</p>
        <div className="grid2">
          <Field label="Fecha de inicio" htmlFor="o-start"><input id="o-start" type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Duración (días)" htmlFor="o-dur"><NumInput id="o-dur" value={dur} onChange={setDur} integer /></Field>
        </div>
        <p className="muted small">Termina el {fmtLong(addDays(start || today(), (dur && dur > 0 ? Math.round(dur) : 90) - 1))}.</p>
        <p className="muted small">Incluye 12 hábitos base (entrenar, alimentación, sueño, agua, lectura, trabajo profundo…) con metas genéricas. Ajústalos en Más → Hábitos.</p>
      </div>
    </Sheet>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <UiProvider>
        <Shell />
      </UiProvider>
    </StoreProvider>
  );
}
