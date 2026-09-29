import React, { useEffect, useState } from 'react';
import type { ISODate, Workout, WorkoutSet, WorkoutType } from '../lib/types';
import { useStore } from '../store';
import { Chips, Field, NumInput, Scale, Sheet, useUi, fmtNum } from './kit';
import { fmtPace, pace } from '../lib/score';
import { uid } from '../lib/defaults';
import { IconPlus, IconTrash, IconRun, IconDumbbell, IconWalk, IconStretch, IconSpark } from './icons';

export const WORKOUT_TYPES: { value: WorkoutType; label: string }[] = [
  { value: 'running', label: 'Running' },
  { value: 'gym', label: 'Gimnasio' },
  { value: 'walk', label: 'Caminata' },
  { value: 'mobility', label: 'Movilidad' },
  { value: 'other', label: 'Otro' },
];

export const typeLabel = (t: WorkoutType) => WORKOUT_TYPES.find((x) => x.value === t)?.label ?? t;

export function WorkoutIcon({ type, size = 20 }: { type: WorkoutType; size?: number }) {
  if (type === 'running') return <IconRun size={size} />;
  if (type === 'gym') return <IconDumbbell size={size} />;
  if (type === 'walk') return <IconWalk size={size} />;
  if (type === 'mobility') return <IconStretch size={size} />;
  return <IconSpark size={size} />;
}

export function workoutSummary(w: Workout): string {
  const parts: string[] = [];
  if (w.distance) parts.push(`${fmtNum(w.distance, 2)} km`);
  if (w.duration) parts.push(`${fmtNum(w.duration, 0)} min`);
  const p = pace(w.duration, w.distance);
  if (p && (w.type === 'running' || w.type === 'walk')) parts.push(`${fmtPace(p)} /km`);
  if (w.sets?.length) parts.push(`${w.sets.length} ejercicio${w.sets.length > 1 ? 's' : ''}`);
  if (w.rpe) parts.push(`esfuerzo ${w.rpe}`);
  return parts.join(' · ');
}

/** Último tipo usado: el caso más común es repetir el entrenamiento habitual. */
function lastType(workouts: Workout[]): WorkoutType {
  const last = [...workouts].sort((a, b) => b.createdAt - a.createdAt)[0];
  return last?.type ?? 'running';
}

export function WorkoutSheet({ open, onClose, date, editing }: {
  open: boolean; onClose: () => void; date: ISODate; editing?: Workout | null;
}) {
  const { data, update } = useStore();
  const { toast, confirm } = useUi();
  const [w, setW] = useState<Workout>(() => blank());

  function blank(): Workout {
    return { id: uid(), date, type: lastType(data.workouts), createdAt: Date.now() };
  }

  useEffect(() => {
    if (open) setW(editing ? structuredClone(editing) : blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, date]);

  const set = (p: Partial<Workout>) => setW((prev) => ({ ...prev, ...p }));
  const hasDistance = w.type === 'running' || w.type === 'walk' || w.type === 'other';
  const p = pace(w.duration, w.distance);

  const save = () => {
    update((d) => {
      const i = d.workouts.findIndex((x) => x.id === w.id);
      const clean: Workout = { ...w, sets: w.sets?.filter((s) => s.exercise.trim()) };
      if (!hasDistance) delete clean.distance;
      if (i >= 0) d.workouts[i] = clean; else d.workouts.push(clean);
    });
    toast(editing ? 'Entrenamiento actualizado' : 'Entrenamiento guardado');
    onClose();
  };

  const remove = async () => {
    if (!editing) return;
    if (await confirm({ title: 'Eliminar entrenamiento', body: 'Se borrará de tu historial.', confirm: 'Eliminar', danger: true })) {
      update((d) => { d.workouts = d.workouts.filter((x) => x.id !== editing.id); });
      toast('Entrenamiento eliminado');
      onClose();
    }
  };

  const setRow = (i: number, p: Partial<WorkoutSet>) =>
    set({ sets: (w.sets ?? []).map((s, j) => (j === i ? { ...s, ...p } : s)) });

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Editar entrenamiento' : 'Registrar entrenamiento'}
      footer={<div className="row gap-s">
        {editing && <button className="btn btn-ghost icon-only" onClick={remove} aria-label="Eliminar"><IconTrash /></button>}
        <button className="btn btn-primary grow" onClick={save}>Guardar</button>
      </div>}>
      <div className="stack">
        <Chips value={w.type} options={WORKOUT_TYPES} onChange={(t) => set({ type: t })} />
        <div className="grid2">
          <Field label="Duración (min)" htmlFor="w-dur"><NumInput id="w-dur" value={w.duration} onChange={(v) => set({ duration: v })} integer /></Field>
          {hasDistance
            ? <Field label="Distancia (km)" htmlFor="w-dist"><NumInput id="w-dist" value={w.distance} onChange={(v) => set({ distance: v })} /></Field>
            : <Field label="Fecha" htmlFor="w-date"><input id="w-date" type="date" className="input" value={w.date} onChange={(e) => e.target.value && set({ date: e.target.value })} /></Field>}
        </div>
        {hasDistance && (
          <div className="grid2">
            <Field label="Ritmo" hint="Se calcula solo"><div className="input readonly">{p ? `${fmtPace(p)} min/km` : '—'}</div></Field>
            <Field label="Fecha" htmlFor="w-date2"><input id="w-date2" type="date" className="input" value={w.date} onChange={(e) => e.target.value && set({ date: e.target.value })} /></Field>
          </div>
        )}
        <Field label="Esfuerzo percibido (1 fácil · 10 máximo)">
          <Scale value={w.rpe} onChange={(v) => set({ rpe: v })} />
        </Field>

        {(w.type === 'gym' || (w.sets?.length ?? 0) > 0) && (
          <div className="stack-s">
            <div className="label">Ejercicios</div>
            {(w.sets ?? []).map((s, i) => (
              <div key={i} className="set-row">
                <input className="input" placeholder="Ejercicio" value={s.exercise} onChange={(e) => setRow(i, { exercise: e.target.value })} aria-label="Ejercicio" />
                <div className="set-nums">
                  <NumInput value={s.sets} onChange={(v) => setRow(i, { sets: v })} placeholder="Series" integer />
                  <NumInput value={s.reps} onChange={(v) => setRow(i, { reps: v })} placeholder="Reps" integer />
                  <NumInput value={s.weight} onChange={(v) => setRow(i, { weight: v })} placeholder="kg" />
                  <button className="icon-btn" aria-label="Quitar ejercicio" onClick={() => set({ sets: (w.sets ?? []).filter((_, j) => j !== i) })}><IconTrash size={18} /></button>
                </div>
              </div>
            ))}
            <button className="btn btn-ghost" onClick={() => set({ sets: [...(w.sets ?? []), { exercise: '' }] })}><IconPlus size={18} /> Agregar ejercicio</button>
          </div>
        )}
        <Field label="Notas" htmlFor="w-notes">
          <textarea id="w-notes" className="input textarea" rows={2} value={w.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Opcional" />
        </Field>
      </div>
    </Sheet>
  );
}
