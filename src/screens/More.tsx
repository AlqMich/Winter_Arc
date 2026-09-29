import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useNav, type Sub } from '../nav';
import type { Note, NoteType, Workout, WorkoutType } from '../lib/types';
import { fmtShort, monthKey, today, weekStart, dowShort, parseISO } from '../lib/dates';
import { uid } from '../lib/defaults';
import { Chips, Field, Sheet, useUi, Empty, fmtNum, cx } from '../ui/kit';
import { IconRun, IconWallet, IconNote, IconList, IconSettings, IconDatabase, IconRight, IconPlus, IconTrash, IconSearch, IconShare } from '../ui/icons';
import { WorkoutIcon, WorkoutSheet, workoutSummary, typeLabel, WORKOUT_TYPES } from '../ui/WorkoutSheet';

const ITEMS: { sub: Exclude<Sub, null>; label: string; sub2: string; icon: React.ReactNode }[] = [
  { sub: 'entrenos', label: 'Entrenamientos', sub2: 'Historial y registro', icon: <IconRun /> },
  { sub: 'finanzas', label: 'Finanzas', sub2: 'Ingresos, gastos y ahorro', icon: <IconWallet /> },
  { sub: 'notas', label: 'Notas', sub2: 'Ideas, reflexiones, aprendizajes', icon: <IconNote /> },
  { sub: 'habitos', label: 'Hábitos', sub2: 'Crear, editar, metas y pesos', icon: <IconList /> },
  { sub: 'ajustes', label: 'Ajustes', sub2: 'Reto, score, tema, recordatorio', icon: <IconSettings /> },
  { sub: 'datos', label: 'Datos y respaldo', sub2: 'Exportar JSON / CSV, restaurar', icon: <IconDatabase /> },
];

export default function More() {
  const { go } = useNav();
  const { data } = useStore();
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone);
  const counts: Record<string, string> = {
    entrenos: String(data.workouts.length),
    notas: String(data.notes.length),
    habitos: String(data.habits.filter((h) => !h.archived).length),
  };
  return (
    <div className="screen">
      <header className="screen-head"><h1 className="title">Más</h1></header>
      <div className="card list">
        {ITEMS.map((it) => (
          <button key={it.sub} className="row-item" onClick={() => go('mas', it.sub)}>
            <span className="row-icon">{it.icon}</span>
            <span className="row-main"><span className="row-title">{it.label}</span><span className="row-sub">{it.sub2}</span></span>
            {counts[it.sub] && <span className="num muted">{counts[it.sub]}</span>}
            <IconRight size={18} className="muted" />
          </button>
        ))}
      </div>
      {!standalone && (
        <div className="card pad install">
          <div className="row gap-s"><IconShare size={20} /><b>Instálala en tu iPhone</b></div>
          <p className="muted small">En Safari toca Compartir → “Agregar a pantalla de inicio”. Se abre a pantalla completa, funciona sin conexión y tus datos quedan guardados en el teléfono.</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Entrenamientos ---------------- */

export function Workouts() {
  const { data } = useStore();
  const [filter, setFilter] = useState<'all' | WorkoutType>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Workout | null>(null);
  const list = useMemo(() => [...data.workouts].filter((w) => filter === 'all' || w.type === filter).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)), [data.workouts, filter]);
  const month = monthKey(today());
  const thisMonth = data.workouts.filter((w) => monthKey(w.date) === month);
  const byWeek = useMemo(() => {
    const m = new Map<string, Workout[]>();
    for (const w of list) { const k = weekStart(w.date); m.set(k, [...(m.get(k) ?? []), w]); }
    return [...m.entries()];
  }, [list]);

  return (
    <div className="screen">
      <div className="tiles3">
        <div className="tile"><div className="tile-num">{thisMonth.length}</div><div className="tile-label">este mes</div></div>
        <div className="tile"><div className="tile-num">{fmtNum(thisMonth.reduce((a, w) => a + (w.distance ?? 0), 0), 1)}</div><div className="tile-label">km mes</div></div>
        <div className="tile"><div className="tile-num">{fmtNum(thisMonth.reduce((a, w) => a + (w.duration ?? 0), 0) / 60, 1)}</div><div className="tile-label">horas mes</div></div>
      </div>
      <div className="scroll-x"><Chips value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todos' }, ...WORKOUT_TYPES] as { value: 'all' | WorkoutType; label: string }[]} /></div>
      {list.length === 0 && <Empty title="Sin entrenamientos" body="Registra el primero. También puedes hacerlo desde Hoy tocando “Entrenar”." />}
      {byWeek.map(([ws, ws_list]) => (
        <section key={ws} className="group">
          <div className="group-head"><h3>Semana del {fmtShort(ws)}</h3><span className="group-count">{ws_list.length}</span></div>
          <div className="card list">
            {ws_list.map((w) => (
              <button key={w.id} className="row-item" onClick={() => { setEditing(w); setOpen(true); }}>
                <span className="row-icon"><WorkoutIcon type={w.type} /></span>
                <span className="row-main"><span className="row-title">{typeLabel(w.type)} <span className="muted small">· {dowShort(w.date)} {parseISO(w.date).getDate()}</span></span><span className="row-sub">{workoutSummary(w) || 'Sin detalles'}</span></span>
              </button>
            ))}
          </div>
        </section>
      ))}
      <button className="fab" aria-label="Registrar entrenamiento" onClick={() => { setEditing(null); setOpen(true); }}><IconPlus /></button>
      <WorkoutSheet open={open} onClose={() => setOpen(false)} date={today()} editing={editing} />
    </div>
  );
}

/* ---------------- Notas ---------------- */

export const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'reflexion', label: 'Reflexión' },
  { value: 'problema', label: 'Problema' },
  { value: 'aprendizaje', label: 'Aprendizaje' },
  { value: 'objetivo', label: 'Objetivo' },
  { value: 'recordar', label: 'Recordar' },
];

export function Notes() {
  const { data, update } = useStore();
  const { toast, confirm } = useUi();
  const [filter, setFilter] = useState<'all' | NoteType>('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Note | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Note>({ id: '', type: 'idea', text: '', date: today(), createdAt: 0 });

  const list = data.notes
    .filter((n) => (filter === 'all' || n.type === filter) && (!q || n.text.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.createdAt - a.createdAt);

  const startNew = () => { setEditing(null); setDraft({ id: uid(), type: filter === 'all' ? 'idea' : filter, text: '', date: today(), createdAt: Date.now() }); setOpen(true); };
  const startEdit = (n: Note) => { setEditing(n); setDraft({ ...n }); setOpen(true); };
  const save = () => {
    if (!draft.text.trim()) return;
    update((d) => {
      const i = d.notes.findIndex((x) => x.id === draft.id);
      if (i >= 0) d.notes[i] = draft; else d.notes.push(draft);
    });
    toast('Nota guardada');
    setOpen(false);
  };
  const remove = async () => {
    if (editing && await confirm({ title: 'Eliminar nota', confirm: 'Eliminar', danger: true })) {
      update((d) => { d.notes = d.notes.filter((x) => x.id !== editing.id); });
      setOpen(false);
    }
  };

  return (
    <div className="screen">
      <div className="search"><IconSearch size={18} /><input className="input" placeholder="Buscar en notas" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" /></div>
      <div className="scroll-x"><Chips value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todas' }, ...NOTE_TYPES] as { value: 'all' | NoteType; label: string }[]} /></div>
      {list.length === 0 && <Empty title={q ? 'Sin resultados' : 'Sin notas'} body="Ideas, aprendizajes y cosas que quieres recordar. Opcionalmente ligadas a una fecha." />}
      <div className="stack-s">
        {list.map((n) => (
          <button key={n.id} className="card pad note" onClick={() => startEdit(n)}>
            <div className="row between"><span className="eyebrow">{NOTE_TYPES.find((t) => t.value === n.type)?.label}</span><span className="muted small">{n.date ? fmtShort(n.date) : ''}</span></div>
            <div className="note-text">{n.text}</div>
          </button>
        ))}
      </div>
      <button className="fab" aria-label="Nueva nota" onClick={startNew}><IconPlus /></button>
      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? 'Editar nota' : 'Nueva nota'}
        footer={<div className="row gap-s">
          {editing && <button className="btn btn-ghost icon-only" aria-label="Eliminar" onClick={remove}><IconTrash /></button>}
          <button className="btn btn-primary grow" disabled={!draft.text.trim()} onClick={save}>Guardar</button>
        </div>}>
        <div className="stack">
          <Chips value={draft.type} options={NOTE_TYPES} onChange={(t) => setDraft({ ...draft, type: t })} />
          <textarea className="input textarea" rows={6} autoFocus value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="Escribe…" aria-label="Nota" />
          <Field label="Fecha (opcional)" htmlFor="n-date">
            <div className="row gap-s">
              <input id="n-date" type="date" className="input grow" value={draft.date ?? ''} onChange={(e) => setDraft({ ...draft, date: e.target.value || undefined })} />
              {draft.date && <button className={cx('btn btn-ghost btn-s')} onClick={() => setDraft({ ...draft, date: undefined })}>Sin fecha</button>}
            </div>
          </Field>
        </div>
      </Sheet>
    </div>
  );
}
