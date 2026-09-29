import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import type { AppData, Habit, MetricKey } from '../lib/types';
import { uid, defaultData } from '../lib/defaults';
import { addDays, DOW_LETTERS, fmtLong, today } from '../lib/dates';
import { arcInfo } from '../lib/score';
import { normalize, storage } from '../lib/storage';
import { toJSON, daysCSV, workoutsCSV, moneyCSV, goalsCSV, notesCSV, download, shareFile } from '../lib/exporter';
import { Field, NumInput, Seg, Sheet, Stepper, Toggle, useUi, cx, fmtNum, SectionTitle } from '../ui/kit';
import { IconPlus, IconUp, IconDown, IconTrash, IconCopy, IconShare } from '../ui/icons';

const LINK_LABEL: Partial<Record<MetricKey | 'workout', string>> = {
  workout: 'Se marca al registrar un entrenamiento', sleep: 'Horas de sueño del día', water: 'Litros de agua del día',
  steps: 'Pasos del día', distraction: 'Minutos en redes / distracciones', mainGoal: 'Objetivo principal cumplido',
  deepWork: 'Horas de trabajo profundo',
};

/* ---------------- Hábitos ---------------- */

export function HabitsAdmin() {
  const { data, update } = useStore();
  const [editing, setEditing] = useState<Habit | null>(null);
  const [open, setOpen] = useState(false);
  const active = data.habits.filter((h) => !h.archived);
  const archived = data.habits.filter((h) => h.archived);
  const totalW = active.reduce((a, h) => a + h.weight, 0) || 1;

  const move = (id: string, dir: -1 | 1) => update((d) => {
    const i = d.habits.findIndex((h) => h.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= d.habits.length) return;
    [d.habits[i], d.habits[j]] = [d.habits[j], d.habits[i]];
  });

  return (
    <div className="screen">
      <p className="muted small">El porcentaje es cuánto pesa cada hábito en el score del día. Los hábitos semanales (p. ej. entrenar 4×/semana) suman el día que los haces y no restan en días de descanso.</p>
      {data.categories.map((c) => {
        const hs = active.filter((h) => h.categoryId === c.id);
        if (!hs.length) return null;
        return (
          <section key={c.id} className="group">
            <div className="group-head"><h3>{c.name}</h3></div>
            <div className="card list">
              {hs.map((h) => (
                <div key={h.id} className="row-item">
                  <button className="row-main left" onClick={() => { setEditing(h); setOpen(true); }}>
                    <span className="row-title">{h.name}</span>
                    <span className="row-sub">{describe(h)}</span>
                  </button>
                  <span className="num weight-pct">{Math.round((h.weight / totalW) * 100)}%</span>
                  <span className="reorder">
                    <button className="icon-btn sm" aria-label="Subir" onClick={() => move(h.id, -1)}><IconUp size={16} /></button>
                    <button className="icon-btn sm" aria-label="Bajar" onClick={() => move(h.id, 1)}><IconDown size={16} /></button>
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {archived.length > 0 && (
        <section className="group">
          <div className="group-head"><h3>Archivados</h3></div>
          <div className="card list">
            {archived.map((h) => (
              <button key={h.id} className="row-item" onClick={() => { setEditing(h); setOpen(true); }}>
                <span className="row-main"><span className="row-title muted">{h.name}</span><span className="row-sub">Toca para reactivar o eliminar</span></span>
              </button>
            ))}
          </div>
        </section>
      )}
      <button className="fab" aria-label="Nuevo hábito" onClick={() => { setEditing(null); setOpen(true); }}><IconPlus /></button>
      <HabitSheet open={open} onClose={() => setOpen(false)} editing={editing} />
    </div>
  );
}

function describe(h: Habit) {
  const days = h.activeDays.length === 7 ? 'todos los días' : h.activeDays.length === 5 && !h.activeDays.includes(0) && !h.activeDays.includes(6) ? 'L–V' : h.activeDays.map((d) => DOW_LETTERS[d]).join(' ');
  const goal = h.frequency === 'weekly' ? `${h.timesPerWeek}× por semana` : h.kind === 'number' ? `${h.lessIsBetter ? 'máx. ' : ''}${fmtNum(h.target, 2)} ${h.unit}` : 'sí / no';
  return `${goal} · ${days}${h.time ? ' · ' + h.time : ''}`;
}

function blankHabit(catId: string): Habit {
  return { id: uid(), name: '', categoryId: catId, kind: 'check', target: 1, unit: '', step: 1, frequency: 'daily', timesPerWeek: 3, activeDays: [0, 1, 2, 3, 4, 5, 6], weight: 10 };
}

function HabitSheet({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Habit | null }) {
  const { data, update } = useStore();
  const { toast, confirm } = useUi();
  const [h, setH] = useState<Habit>(blankHabit(data.categories[0]?.id ?? ''));
  useEffect(() => { if (open) setH(editing ? structuredClone(editing) : blankHabit(data.categories[0]?.id ?? '')); }, [open, editing, data.categories]);
  const set = (p: Partial<Habit>) => setH((x) => ({ ...x, ...p }));
  const valid = h.name.trim() && h.activeDays.length > 0 && (h.kind === 'check' || h.target > 0 || h.lessIsBetter);

  const save = () => {
    if (!valid) return;
    update((d) => {
      const clean = { ...h, name: h.name.trim(), target: h.kind === 'check' ? 1 : h.target };
      const i = d.habits.findIndex((x) => x.id === h.id);
      if (i >= 0) d.habits[i] = clean; else d.habits.push(clean);
    });
    toast(editing ? 'Hábito actualizado' : 'Hábito creado');
    onClose();
  };
  const archive = () => {
    update((d) => { const x = d.habits.find((y) => y.id === h.id); if (x) x.archived = !x.archived; });
    toast(h.archived ? 'Hábito reactivado' : 'Hábito archivado: tu historial se conserva');
    onClose();
  };
  const remove = async () => {
    if (await confirm({ title: 'Eliminar hábito', body: 'Se borra el hábito y deja de contar en el score de todos los días, incluidos los pasados. Si solo quieres dejar de usarlo, mejor archívalo.', confirm: 'Eliminar', danger: true })) {
      update((d) => { d.habits = d.habits.filter((x) => x.id !== h.id); });
      onClose();
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Editar hábito' : 'Nuevo hábito'}
      footer={<div className="row gap-s">
        {editing && <button className="btn btn-ghost" onClick={archive}>{h.archived ? 'Reactivar' : 'Archivar'}</button>}
        <button className="btn btn-primary grow" disabled={!valid} onClick={save}>Guardar</button>
      </div>}>
      <div className="stack">
        <Field label="Nombre" htmlFor="h-name"><input id="h-name" className="input" value={h.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej. Suplementos" /></Field>
        <Field label="Categoría">
          <div className="chips">{data.categories.map((c) => <button key={c.id} className={cx('chip', h.categoryId === c.id && 'on')} onClick={() => set({ categoryId: c.id })}>{c.name}</button>)}</div>
        </Field>
        {h.link !== 'workout' && (
          <Field label="Tipo"><Seg value={h.kind} onChange={(k) => set({ kind: k, ...(k === 'number' && h.target <= 1 ? { target: 1 } : {}) })} options={[{ value: 'check', label: 'Sí / no' }, { value: 'number', label: 'Cantidad' }]} size="s" /></Field>
        )}
        {h.kind === 'number' && h.link !== 'workout' && (
          <>
            <div className="grid3">
              <Field label={h.lessIsBetter ? 'Máximo' : 'Meta diaria'} htmlFor="h-target"><NumInput id="h-target" value={h.target} onChange={(v) => set({ target: v ?? 0 })} /></Field>
              <Field label="Unidad" htmlFor="h-unit"><input id="h-unit" className="input" value={h.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="min, L, km" /></Field>
              <Field label="Botón +/−" htmlFor="h-step"><NumInput id="h-step" value={h.step} onChange={(v) => set({ step: v && v > 0 ? v : 1 })} /></Field>
            </div>
            <Toggle label="Menos es mejor (límite máximo)" on={!!h.lessIsBetter} onChange={(b) => set({ lessIsBetter: b || undefined })} />
          </>
        )}
        <Field label="Frecuencia">
          <Seg value={h.frequency} onChange={(f) => set({ frequency: f })} options={[{ value: 'daily', label: 'Cada día activo' }, { value: 'weekly', label: 'Veces por semana' }]} size="s" />
        </Field>
        {h.frequency === 'weekly' && <Field label="Veces por semana"><Stepper value={h.timesPerWeek} onChange={(v) => set({ timesPerWeek: Math.max(1, Math.min(7, v ?? 1)) })} min={1} /></Field>}
        <Field label="Días activos">
          <div className="dow-pick">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button key={d} className={cx('dow-btn', h.activeDays.includes(d) && 'on')} aria-pressed={h.activeDays.includes(d)}
                onClick={() => set({ activeDays: h.activeDays.includes(d) ? h.activeDays.filter((x) => x !== d) : [...h.activeDays, d] })}>{DOW_LETTERS[d]}</button>
            ))}
          </div>
        </Field>
        <Field label="Importancia (peso en el score)" hint="Referencia: 5 = menor, 10 = normal, 20 = clave">
          <Stepper value={h.weight} onChange={(v) => set({ weight: Math.max(1, v ?? 1) })} step={5} min={1} />
        </Field>
        <div className="grid2">
          <Field label="Hora (opcional)" htmlFor="h-time"><input id="h-time" type="time" className="input" value={h.time ?? ''} onChange={(e) => set({ time: e.target.value || undefined })} /></Field>
          <div />
        </div>
        <Field label="Notas" htmlFor="h-notes"><textarea id="h-notes" className="input textarea" rows={2} value={h.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
        {h.link && <p className="muted small">Conectado a: {LINK_LABEL[h.link] ?? h.link}. Se registra una sola vez y alimenta hábito y gráficas.</p>}
        {editing && <button className="btn btn-ghost danger-text" onClick={remove}><IconTrash size={18} /> Eliminar definitivamente</button>}
      </div>
    </Sheet>
  );
}

/* ---------------- Ajustes ---------------- */

export function Settings() {
  const { data, update } = useStore();
  const { toast, confirm } = useUi();
  const s = data.settings;
  const arc = arcInfo(data);
  const set = (p: Partial<typeof s>) => update((d) => { d.settings = { ...d.settings, ...p }; });
  const [newCat, setNewCat] = useState('');

  return (
    <div className="screen">
      <SectionTitle>Reto</SectionTitle>
      <div className="card pad stack">
        <div className="grid2">
          <Field label="Fecha de inicio" htmlFor="s-start"><input id="s-start" type="date" className="input" value={s.startDate} onChange={(e) => e.target.value && set({ startDate: e.target.value })} /></Field>
          <Field label="Duración (días)" htmlFor="s-dur"><NumInput id="s-dur" value={s.durationDays} onChange={(v) => v && v > 0 && set({ durationDays: Math.round(v) })} integer /></Field>
        </div>
        <p className="muted small">{arc.started ? `Hoy es el día ${arc.day} de ${arc.total}.` : 'Aún no empieza.'} Termina el {fmtLong(addDays(s.startDate, s.durationDays - 1))}.</p>
      </div>

      <SectionTitle>Score</SectionTitle>
      <div className="card pad stack">
        <Field label={`Día cumplido desde ${s.dayThreshold} puntos`} htmlFor="s-thr">
          <input id="s-thr" type="range" min={50} max={100} step={5} value={s.dayThreshold} onChange={(e) => set({ dayThreshold: Number(e.target.value) })} className="range" />
        </Field>
        <ul className="muted small bullets">
          <li><b>Score del día</b> = puntos de tus hábitos del día / puntos posibles. Las metas numéricas dan crédito parcial (2 de 2.5 L suma 80%).</li>
          <li><b>Consistencia</b> (la métrica principal) = días cumplidos / días transcurridos. Un día malo mueve poco el total.</li>
          <li><b>Racha</b>: un día flojo (registraste pero no llegaste) la pausa; dos seguidos o un día sin registrar la reinician.</li>
          <li>Hoy nunca rompe la racha: solo cuenta cuando ya lo cumpliste.</li>
        </ul>
      </div>

      <SectionTitle>Apariencia y aviso</SectionTitle>
      <div className="card pad stack">
        <Field label="Tema"><Seg value={s.theme} onChange={(t) => set({ theme: t })} options={[{ value: 'system', label: 'Sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]} size="s" /></Field>
        <Field label="Aviso para cerrar el día" htmlFor="s-rem" hint="A partir de esta hora, Hoy muestra un aviso si no has cerrado el día.">
          <input id="s-rem" type="time" className="input" value={s.reminderTime ?? ''} onChange={(e) => set({ reminderTime: e.target.value || undefined })} />
        </Field>
      </div>

      <SectionTitle>Unidades y finanzas</SectionTitle>
      <div className="card pad stack">
        <div className="grid2">
          <Field label="Unidad de peso" htmlFor="s-wu"><Seg value={s.weightUnit} onChange={(v) => set({ weightUnit: v })} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} size="s" /></Field>
          <Field label="Moneda" htmlFor="s-cur"><select id="s-cur" className="input" value={s.currency} onChange={(e) => set({ currency: e.target.value })}>{['MXN', 'USD', 'EUR'].map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <Field label="Meta de ahorro mensual" htmlFor="s-sav"><NumInput id="s-sav" value={s.monthlySavingsTarget || undefined} onChange={(v) => set({ monthlySavingsTarget: v ?? 0 })} placeholder="0" /></Field>
      </div>

      <SectionTitle>Categorías</SectionTitle>
      <div className="card list">
        {data.categories.map((c, i) => (
          <div key={c.id} className="row-item">
            <input className="input flat grow" value={c.name} aria-label="Nombre de categoría" onChange={(e) => update((d) => { d.categories[i].name = e.target.value; })} />
            <button className="icon-btn" aria-label="Eliminar categoría" onClick={async () => {
              if (data.habits.some((h) => h.categoryId === c.id)) { toast('Mueve primero sus hábitos a otra categoría'); return; }
              if (await confirm({ title: `Eliminar "${c.name}"`, confirm: 'Eliminar', danger: true })) update((d) => { d.categories = d.categories.filter((x) => x.id !== c.id); });
            }}><IconTrash size={18} /></button>
          </div>
        ))}
        <div className="row-item">
          <input className="input flat grow" placeholder="Nueva categoría" value={newCat} onChange={(e) => setNewCat(e.target.value)} aria-label="Nueva categoría" />
          <button className="icon-btn" aria-label="Agregar categoría" disabled={!newCat.trim()} onClick={() => { update((d) => { d.categories.push({ id: uid(), name: newCat.trim() }); }); setNewCat(''); }}><IconPlus size={18} /></button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Datos ---------------- */

export function DataScreen() {
  const { data, replace, lastSaved, saveError } = useStore();
  const { toast, confirm } = useUi();
  const [shown, setShown] = useState<{ name: string; text: string } | null>(null);
  const [paste, setPaste] = useState('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null)); }, []);

  const stamp = today();
  const exporters: { name: string; label: string; mime: string; make: () => string }[] = [
    { name: `winter-arc-respaldo-${stamp}.json`, label: 'Respaldo completo (JSON)', mime: 'application/json', make: () => toJSON(data) },
    { name: `winter-arc-dias-${stamp}.csv`, label: 'Días y hábitos (CSV)', mime: 'text/csv', make: () => daysCSV(data) },
    { name: `winter-arc-entrenos-${stamp}.csv`, label: 'Entrenamientos (CSV)', mime: 'text/csv', make: () => workoutsCSV(data) },
    { name: `winter-arc-finanzas-${stamp}.csv`, label: 'Finanzas (CSV)', mime: 'text/csv', make: () => moneyCSV(data) },
    { name: `winter-arc-objetivos-${stamp}.csv`, label: 'Objetivos (CSV)', mime: 'text/csv', make: () => goalsCSV(data) },
    { name: `winter-arc-notas-${stamp}.csv`, label: 'Notas (CSV)', mime: 'text/csv', make: () => notesCSV(data) },
  ];

  const doExport = async (x: typeof exporters[number]) => {
    const text = x.make();
    if (await shareFile(x.name, text, x.mime)) return;
    download(x.name, text, x.mime);
    setShown({ name: x.name, text }); // respaldo visible por si la descarga está bloqueada
  };

  const restoreText = async (text: string) => {
    try {
      const parsed = JSON.parse(text);
      const payload: AppData = parsed?.data ?? parsed;
      if (!payload || typeof payload !== 'object' || !('settings' in payload || 'habits' in payload)) throw new Error('formato');
      const n = normalize(payload);
      const ok = await confirm({ title: 'Restaurar respaldo', body: `Se reemplazarán tus datos actuales por el respaldo: ${Object.keys(n.logs).length} días, ${n.workouts.length} entrenamientos, ${n.goals.length} objetivos.`, confirm: 'Restaurar' });
      if (!ok) return;
      replace(n);
      setPaste('');
      toast('Respaldo restaurado');
    } catch {
      toast('Ese archivo no es un respaldo válido de Winter Arc (JSON).');
    }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('Copiado'); }
    catch { toast('Selecciona el texto y cópialo manualmente'); }
  };

  return (
    <div className="screen">
      <div className="card pad stack-s">
        <div className="kv"><span>Almacenamiento</span><b>{saveError ? 'Error al guardar' : 'En este dispositivo'}</b></div>
        <div className="kv"><span>Último guardado</span><b>{lastSaved ? new Date(lastSaved).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'al abrir'}</b></div>
        <div className="kv"><span>Protección contra borrado</span><b>{persisted === null ? '—' : persisted ? 'Activa' : 'Instala la app para activarla'}</b></div>
        <div className="kv"><span>Registros</span><b className="num">{Object.keys(data.logs).length} días · {data.workouts.length} entrenos</b></div>
        <p className="muted small">Tus datos viven solo en este teléfono. Haz un respaldo JSON cada semana (p. ej. el domingo después de tu revisión).</p>
      </div>

      <SectionTitle>Exportar</SectionTitle>
      <div className="card list">
        {exporters.map((x) => (
          <button key={x.name} className="row-item" onClick={() => doExport(x)}>
            <span className="row-icon"><IconShare size={18} /></span>
            <span className="row-main"><span className="row-title">{x.label}</span></span>
          </button>
        ))}
      </div>
      {shown && (
        <div className="card pad stack-s">
          <div className="row between"><b className="small">{shown.name}</b><button className="btn btn-ghost btn-s" onClick={() => copy(shown.text)}><IconCopy size={16} /> Copiar</button></div>
          <p className="muted small">Si la descarga no empezó, copia este contenido y guárdalo en Notas o Archivos.</p>
          <textarea className="input textarea mono" rows={6} readOnly value={shown.text} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}

      <SectionTitle>Restaurar</SectionTitle>
      <div className="card pad stack">
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) restoreText(await f.text());
          e.target.value = '';
        }} />
        <button className="btn btn-ghost btn-block" onClick={() => fileRef.current?.click()}>Elegir archivo de respaldo</button>
        <textarea className="input textarea mono" rows={3} placeholder="…o pega aquí el contenido del respaldo JSON" value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="Pegar respaldo" />
        {paste.trim() && <button className="btn btn-primary btn-block" onClick={() => restoreText(paste)}>Restaurar desde texto</button>}
      </div>

      <SectionTitle>Zona de riesgo</SectionTitle>
      <div className="card pad">
        <button className="btn btn-ghost btn-block danger-text" onClick={async () => {
          if (await confirm({ title: 'Borrar todos los datos', body: 'Se eliminan registros, entrenamientos, objetivos, finanzas y notas de este dispositivo. Haz un respaldo antes. No se puede deshacer.', confirm: 'Borrar todo', danger: true })) {
            storage.clear();
            replace(defaultData());
            toast('Datos borrados');
          }
        }}>Borrar todos los datos</button>
      </div>
    </div>
  );
}
