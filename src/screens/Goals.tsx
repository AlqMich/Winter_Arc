import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import type { Goal, GoalCategory, GoalSource } from '../lib/types';
import { goalCurrent, goalExpected, goalProgress } from '../lib/score';
import { GOAL_TEMPLATES, newGoal } from '../lib/defaults';
import { fmtShort, diffDays } from '../lib/dates';
import { Bar, Chips, Field, NumInput, Seg, Sheet, cx, fmtMoney, fmtNum, fmtPct, useUi, Empty } from '../ui/kit';
import { IconPlus, IconMinus, IconTrash } from '../ui/icons';

const CATS: { value: GoalCategory; label: string }[] = [
  { value: 'fisico', label: 'Físico' },
  { value: 'profesional', label: 'Profesional' },
  { value: 'financiero', label: 'Financiero' },
  { value: 'personal', label: 'Personal' },
];

const SOURCES: { value: GoalSource; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'weight', label: 'Último peso' },
  { value: 'waist', label: 'Última cintura' },
  { value: 'longestRun', label: 'Carrera más larga' },
  { value: 'savings', label: 'Ahorro registrado' },
  { value: 'monthIncome', label: 'Ingreso del mes' },
];

export function fmtGoal(v: number, unit: string, currency = 'MXN') {
  if (unit === '$') return fmtMoney(v, currency);
  return `${fmtNum(v, 2)}${unit ? ' ' + unit : ''}`;
}

export default function Goals() {
  const { data, update, now } = useStore();
  const { toast } = useUi();
  const [filter, setFilter] = useState<'all' | GoalCategory>('all');
  const [editing, setEditing] = useState<Goal | null>(null);
  const [open, setOpen] = useState(false);

  const goals = data.goals.filter((g) => !g.archived && (filter === 'all' || g.category === filter));

  const bump = (g: Goal, delta: number) => {
    update((d) => {
      const x = d.goals.find((y) => y.id === g.id);
      if (x) x.current = Math.round((x.current + delta) * 100) / 100;
    });
    toast(`${g.name}: ${fmtGoal(g.current + delta, g.unit, data.settings.currency)}`);
  };

  return (
    <div className="screen">
      <header className="screen-head row between">
        <h1 className="title">Objetivos</h1>
        <button className="btn btn-primary btn-s" onClick={() => { setEditing(null); setOpen(true); }}><IconPlus size={18} /> Nuevo</button>
      </header>
      <div className="scroll-x">
        <Chips value={filter} options={[{ value: 'all', label: 'Todos' }, ...CATS] as { value: 'all' | GoalCategory; label: string }[]} onChange={setFilter} />
      </div>

      {goals.length === 0 && (
        <Empty title="Sin objetivos todavía" body="Un objetivo tiene un valor inicial, uno actual y una meta. El progreso se calcula solo; peso, cintura, running y ahorro se actualizan con tus registros."
          action={<button className="btn btn-primary" onClick={() => { setEditing(null); setOpen(true); }}>Crear objetivo</button>} />
      )}

      <div className="stack">
        {goals.map((g) => {
          const cur = goalCurrent(data, g);
          const p = goalProgress(g, cur);
          const exp = goalExpected(g, data, now);
          const status = p >= 1 ? 'Logrado' : exp === null ? null : p >= exp - 0.05 ? 'A tiempo' : p >= exp - 0.15 ? 'Un poco atrás' : 'Atrasado';
          const tone = p >= 1 || status === 'A tiempo' ? 'good' : status === 'Un poco atrás' ? 'warn' : 'bad';
          const daysLeft = g.dueDate ? diffDays(now, g.dueDate) : null;
          return (
            <div key={g.id} className="card pad goal">
              <button className="goal-top" onClick={() => { setEditing(g); setOpen(true); }}>
                <div>
                  <div className="eyebrow">{CATS.find((c) => c.value === g.category)?.label}{g.source !== 'manual' ? ' · automático' : ''}</div>
                  <div className="goal-name">{g.name}</div>
                </div>
                <div className="goal-pct num">{fmtPct(p)}</div>
              </button>
              <div className="goal-values num">
                <span className="muted">{fmtGoal(g.start, g.unit, data.settings.currency)}</span>
                <span className="goal-cur">{fmtGoal(cur, g.unit, data.settings.currency)}</span>
                <span className="muted">{fmtGoal(g.target, g.unit, data.settings.currency)}</span>
              </div>
              <Bar value={p} marker={exp} tone={tone === 'good' ? 'good' : tone === 'warn' ? 'warn' : 'accent'} />
              <div className="row between goal-foot">
                <span className="small">
                  {status && <span className={cx('pill', tone)}>{status}</span>}
                  {daysLeft !== null && <span className="muted"> {daysLeft >= 0 ? `${daysLeft} días · ${fmtShort(g.dueDate!)}` : `venció ${fmtShort(g.dueDate!)}`}</span>}
                </span>
                {g.source === 'manual' && (
                  <span className="row gap-s">
                    <button className="step-btn" aria-label="Restar" onClick={() => bump(g, -quickStep(g))}><IconMinus size={18} /></button>
                    <button className="step-btn" aria-label="Sumar" onClick={() => bump(g, quickStep(g))}><IconPlus size={18} /></button>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="muted small center">La marca vertical en cada barra es dónde deberías ir según la fecha objetivo.</p>

      <GoalSheet open={open} onClose={() => setOpen(false)} editing={editing} />
    </div>
  );
}

function quickStep(g: Goal) {
  const span = Math.abs(g.target - g.start);
  if (g.unit === '$') return span >= 100000 ? 5000 : span >= 10000 ? 1000 : 100;
  return span >= 100 ? 10 : 1;
}

function GoalSheet({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Goal | null }) {
  const { data, update } = useStore();
  const { toast, confirm } = useUi();
  const [g, setG] = useState<Goal>(newGoal({}));
  useEffect(() => { if (open) setG(editing ? structuredClone(editing) : newGoal({ dueDate: undefined })); }, [open, editing]);
  const set = (p: Partial<Goal>) => setG((x) => ({ ...x, ...p }));
  const auto = g.source !== 'manual';
  const valid = g.name.trim() && g.target !== g.start;

  const save = () => {
    if (!valid) return;
    update((d) => {
      const i = d.goals.findIndex((x) => x.id === g.id);
      const clean = { ...g, name: g.name.trim(), current: auto ? g.current : g.current };
      if (i >= 0) d.goals[i] = clean; else d.goals.push(clean);
    });
    toast(editing ? 'Objetivo actualizado' : 'Objetivo creado');
    onClose();
  };
  const remove = async () => {
    if (!editing) return;
    if (await confirm({ title: 'Eliminar objetivo', body: `"${editing.name}" se eliminará.`, confirm: 'Eliminar', danger: true })) {
      update((d) => { d.goals = d.goals.filter((x) => x.id !== editing.id); });
      onClose();
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Editar objetivo' : 'Nuevo objetivo'}
      footer={<div className="row gap-s">
        {editing && <button className="btn btn-ghost icon-only" onClick={remove} aria-label="Eliminar"><IconTrash /></button>}
        <button className="btn btn-primary grow" disabled={!valid} onClick={save}>Guardar</button>
      </div>}>
      <div className="stack">
        {!editing && (
          <Field label="Plantilla rápida">
            <div className="chips">
              {GOAL_TEMPLATES.map((t) => (
                <button key={t.name} className={cx('chip', g.name === t.name && 'on')} onClick={() => set({ name: t.name, category: t.category, unit: t.unit, source: t.source })}>{t.name}</button>
              ))}
            </div>
          </Field>
        )}
        <Field label="Nombre" htmlFor="g-name"><input id="g-name" className="input" value={g.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej. Cotizaciones enviadas" /></Field>
        <Field label="Categoría"><Seg value={g.category} onChange={(v) => set({ category: v })} options={CATS} size="s" /></Field>
        <div className="grid2">
          <Field label="Unidad" htmlFor="g-unit" hint="Usa $ para dinero"><input id="g-unit" className="input" value={g.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="kg, km, $…" /></Field>
          <Field label="Fecha objetivo" htmlFor="g-due" hint="Vacío = fin del reto"><input id="g-due" type="date" className="input" value={g.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value || undefined })} /></Field>
        </div>
        <div className="grid3">
          <Field label="Inicial" htmlFor="g-start"><NumInput id="g-start" value={g.start} onChange={(v) => set({ start: v ?? 0, ...(editing ? {} : { current: v ?? 0 }) })} /></Field>
          <Field label="Actual" htmlFor="g-cur">{auto ? <div className="input readonly">{fmtNum(goalCurrent(data, g), 2)}</div> : <NumInput id="g-cur" value={g.current} onChange={(v) => set({ current: v ?? 0 })} />}</Field>
          <Field label="Meta" htmlFor="g-target"><NumInput id="g-target" value={g.target} onChange={(v) => set({ target: v ?? 0 })} /></Field>
        </div>
        <Field label="Valor actual" hint={auto ? 'Se actualiza con tus registros. Si no hay registros, usa el valor inicial.' : 'Lo actualizas tú con + / − o editando.'}>
          <select className="input" value={g.source} onChange={(e) => set({ source: e.target.value as GoalSource })}>
            {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
      </div>
    </Sheet>
  );
}
