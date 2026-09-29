import React, { useMemo, useState } from 'react';
import { ensureLog, useStore } from '../store';
import { useNav } from '../nav';
import type { Habit, ISODate, MetricKey, Workout } from '../lib/types';
import { addDays, fmtLong, fmtShort, diffDays } from '../lib/dates';
import {
  arcInfo, arcStats, credit, dayScore, habitValue, isScheduled, lastMetric, weeklyPace, workoutsOn, hasData,
} from '../lib/score';
import { Bar, Chips, Field, NumInput, Ring, Scale, Sheet, Stepper, Toggle, cx, fmtNum, useUi } from '../ui/kit';
import { IconCheck, IconFlame, IconLeft, IconRight, IconPlus, IconAlert, IconMoon } from '../ui/icons';
import { WorkoutIcon, WorkoutSheet, workoutSummary, typeLabel } from '../ui/WorkoutSheet';
import { MealSheet, mealSummary } from '../ui/MealSheet';
import { mealsOn, totals, QUALITY_LABEL } from '../lib/foods';
import type { Meal } from '../lib/types';

export default function Today() {
  const { data, update, day, setDay, now } = useStore();
  const { go } = useNav();
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [editing, setEditing] = useState<Workout | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [mealOpen, setMealOpen] = useState(false);
  const [editMeal, setEditMeal] = useState<Meal | null>(null);

  const arc = arcInfo(data, day);
  const score = dayScore(data, day);
  const stats = useMemo(() => arcStats(data, now), [data, now]);
  const pace = useMemo(() => weeklyPace(data, day), [data, day]);
  const log = data.logs[day];
  const isToday = day === now;
  const workouts = workoutsOn(data, day);
  const threshold = data.settings.dayThreshold;

  const setValue = (h: Habit, v: number | undefined) => {
    update((d) => {
      const l = ensureLog(d, day);
      if (h.link && h.link !== 'workout') {
        if (v === undefined) delete l.metrics[h.link as MetricKey]; else l.metrics[h.link as MetricKey] = v;
      } else if (v === undefined) delete l.habits[h.id];
      else l.habits[h.id] = v;
    });
  };
  const setMetric = (k: MetricKey, v: number | undefined) => {
    update((d) => {
      const l = ensureLog(d, day);
      if (v === undefined) delete l.metrics[k]; else l.metrics[k] = v;
    });
  };

  const groups = data.categories
    .map((c) => ({ cat: c, habits: data.habits.filter((h) => h.categoryId === c.id && isScheduled(h, day)) }))
    .filter((g) => g.habits.length);
  const orphan = data.habits.filter((h) => isScheduled(h, day) && !data.categories.some((c) => c.id === h.categoryId));
  if (orphan.length) groups.push({ cat: { id: '_', name: 'Otros' }, habits: orphan });

  // Avisos: solo lo accionable.
  const yesterday = addDays(now, -1);
  const yesterdayMissing = isToday && arc.started && diffDays(data.settings.startDate, yesterday) >= 0 && !hasData(data, yesterday);
  const hour = new Date().toTimeString().slice(0, 5);
  const closeRem = data.reminders.find((r) => r.kind === 'close' && r.enabled);
  const remind = isToday && !log?.closed && closeRem && hour >= closeRem.time;

  const remaining = score.total - score.done;

  return (
    <div className="screen">
      <header className="day-nav">
        <button className="icon-btn" aria-label="Día anterior" onClick={() => setDay(addDays(day, -1))}><IconLeft /></button>
        <button className="day-nav-title" onClick={() => setDay(now)}>
          <span className="eyebrow">{isToday ? 'Hoy' : day < now ? 'Registro pasado' : ''}</span>
          <span>{fmtLong(day)}</span>
        </button>
        <button className="icon-btn" aria-label="Día siguiente" disabled={day >= now} onClick={() => setDay(addDays(day, 1))}><IconRight /></button>
      </header>

      <section className="hero">
        <Ring value={score.score} label="score" sub={score.score !== null && score.score >= threshold ? 'día cumplido' : `meta ${threshold}`} />
        <div className="hero-side">
          {arc.started ? (
            <>
              <div className="eyebrow">Winter Arc</div>
              <div className="hero-day"><span className="num">Día {arc.finished ? arc.total : arc.day}</span><span className="of"> / {arc.total}</span></div>
              <Bar value={arc.pct} />
              <div className="hero-meta">{arc.finished ? 'Reto terminado' : `${arc.daysLeft - 1} días restantes`}</div>
            </>
          ) : (
            <>
              <div className="eyebrow">Winter Arc</div>
              <div className="hero-day"><span className="num">{-diffDays(data.settings.startDate, day)}</span><span className="of"> días para empezar</span></div>
              <div className="hero-meta">Inicia el {fmtShort(data.settings.startDate)}</div>
            </>
          )}
          <div className="streak"><IconFlame size={18} /><span className="num">{stats.currentStreak}</span> <span>{stats.currentStreak === 1 ? 'día' : 'días'} de racha</span></div>
        </div>
      </section>

      {yesterdayMissing && (
        <button className="banner" onClick={() => setDay(yesterday)}>
          <IconAlert size={18} /><span>Ayer quedó sin registrar. <u>Completar ayer</u></span>
        </button>
      )}
      {remind && !yesterdayMissing && (
        <button className="banner" onClick={() => setCloseOpen(true)}>
          <IconMoon size={18} /><span>Ya es tarde: cierra tu día en 1 minuto.</span>
        </button>
      )}

      {groups.map(({ cat, habits }) => {
        const done = habits.filter((h) => credit(h, habitValue(data, h, day)) >= 0.999).length;
        return (
          <section key={cat.id} className="group">
            <div className="group-head">
              <h3>{cat.name}</h3>
              <span className={cx('group-count', done === habits.length && 'all')}>{done}/{habits.length}</span>
            </div>
            <div className="card list">
              {habits.map((h) => (
                <HabitRow key={h.id} habit={h} value={habitValue(data, h, day)}
                  weekly={pace.find((p) => p.habit.id === h.id)}
                  workoutsToday={workouts}
                  onSet={(v) => setValue(h, v)}
                  onWorkout={() => { setEditing(null); setWorkoutOpen(true); }}
                  onEditWorkout={(w) => { setEditing(w); setWorkoutOpen(true); }} />
              ))}
            </div>
          </section>
        );
      })}

      {data.habits.filter((h) => !h.archived).length === 0 && (
        <div className="card pad">
          <p className="muted">No tienes hábitos activos.</p>
          <button className="btn btn-primary" onClick={() => go('mas', 'habitos')}>Crear hábitos</button>
        </div>
      )}

      <FoodSection day={day} onAdd={() => { setEditMeal(null); setMealOpen(true); }} onEdit={(m) => { setEditMeal(m); setMealOpen(true); }} />

      <section className="group">
        <div className="group-head"><h3>Medidas</h3><span className="group-count">opcional</span></div>
        <div className="card pad grid2">
          <Field label={`Peso (${data.settings.weightUnit})`} htmlFor="m-weight">
            <NumInput id="m-weight" value={log?.metrics.weight} onChange={(v) => setMetric('weight', v)}
              placeholder={fmtPrev(lastMetric(data, 'weight'))} />
          </Field>
          <Field label="Cintura (cm)" htmlFor="m-waist">
            <NumInput id="m-waist" value={log?.metrics.waist} onChange={(v) => setMetric('waist', v)}
              placeholder={fmtPrev(lastMetric(data, 'waist'))} />
          </Field>
        </div>
      </section>

      {(workouts.length > 1 || !data.habits.some((h) => h.link === 'workout' && !h.archived && isScheduled(h, day))) && (
        <section className="group">
          <div className="group-head"><h3>Entrenamientos</h3>
            <button className="link-btn" onClick={() => { setEditing(null); setWorkoutOpen(true); }}><IconPlus size={16} /> Agregar</button>
          </div>
          <div className="card list">
            {workouts.length === 0 && <div className="row-item muted">Sin entrenamientos este día.</div>}
            {workouts.map((w) => (
              <button key={w.id} className="row-item" onClick={() => { setEditing(w); setWorkoutOpen(true); }}>
                <span className="row-icon"><WorkoutIcon type={w.type} /></span>
                <span className="row-main"><span className="row-title">{typeLabel(w.type)}</span><span className="row-sub">{workoutSummary(w) || 'Sin detalles'}</span></span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className={cx('close-day', log?.closed && 'is-closed')}>
        <button className={cx('btn btn-block', log?.closed ? 'btn-ghost' : 'btn-primary')} onClick={() => setCloseOpen(true)}>
          {log?.closed ? <><IconCheck size={18} /> Día cerrado · revisar</> : remaining > 0 && score.total > 0 ? `Cerrar el día · faltan ${remaining}` : 'Cerrar el día'}
        </button>
      </div>

      <WorkoutSheet open={workoutOpen} onClose={() => setWorkoutOpen(false)} date={day} editing={editing} />
      <CloseDaySheet open={closeOpen} onClose={() => setCloseOpen(false)} day={day} />
      <MealSheet open={mealOpen} onClose={() => setMealOpen(false)} date={day} editing={editMeal} />
    </div>
  );
}

function fmtPrev(v: number | undefined) {
  return v === undefined ? '—' : `últ. ${fmtNum(v, 1)}`;
}

function HabitRow({ habit: h, value, weekly, workoutsToday, onSet, onWorkout, onEditWorkout }: {
  habit: Habit; value: number | undefined; weekly?: { doneDays: number; target: number; behind: boolean };
  workoutsToday: Workout[]; onSet: (v: number | undefined) => void; onWorkout: () => void; onEditWorkout: (w: Workout) => void;
}) {
  const c = credit(h, value);
  const done = c >= 0.999;
  const meta = h.frequency === 'weekly' && weekly
    ? <span className={cx(weekly.behind && 'warn-text')}>{weekly.doneDays}/{weekly.target} esta semana{weekly.behind ? ' · vas atrasado' : ''}</span>
    : h.kind === 'number'
      ? <span>{h.lessIsBetter ? 'máx. ' : 'meta '}{fmtNum(h.target, 2)} {h.unit}</span>
      : h.time ? <span>{h.time}</span> : null;

  if (h.link === 'workout') {
    const w = workoutsToday[0];
    return (
      <button className={cx('habit', done && 'done')} onClick={() => (w ? onEditWorkout(w) : onWorkout())}>
        <span className="check">{done && <IconCheck size={18} strokeWidth={2.4} />}</span>
        <span className="habit-main">
          <span className="habit-name">{h.name}</span>
          <span className="habit-meta">{w ? `${typeLabel(w.type)}${workoutSummary(w) ? ' · ' + workoutSummary(w) : ''}` : meta}</span>
        </span>
        <span className="habit-cta">{w ? (workoutsToday.length > 1 ? `+${workoutsToday.length - 1}` : '') : 'Registrar'}</span>
      </button>
    );
  }

  if (h.kind === 'check') {
    return (
      <button className={cx('habit', done && 'done')} aria-pressed={done} onClick={() => onSet(done ? undefined : 1)}>
        <span className="check">{done && <IconCheck size={18} strokeWidth={2.4} />}</span>
        <span className="habit-main">
          <span className="habit-name">{h.name}</span>
          {meta && <span className="habit-meta">{meta}</span>}
        </span>
      </button>
    );
  }

  return (
    <div className={cx('habit habit-num', done && 'done')}>
      <button className="check" aria-label={done ? `${h.name}: quitar` : `${h.name}: completar meta`}
        onClick={() => onSet(done ? undefined : h.lessIsBetter ? 0 : h.target)}>
        {done && <IconCheck size={18} strokeWidth={2.4} />}
      </button>
      <span className="habit-main">
        <span className="habit-name">{h.name}</span>
        <span className="habit-meta">{meta}</span>
        {!h.lessIsBetter && <span className="mini-bar"><span style={{ width: `${c * 100}%` }} /></span>}
      </span>
      <Stepper value={value} onChange={onSet} step={h.step || 1} unit={h.unit.length <= 3 ? h.unit : undefined} id={`hv-${h.id}`} />
    </div>
  );
}

const FOOD = [
  { value: 1, label: 'Mala' }, { value: 2, label: 'Regular' }, { value: 3, label: 'Buena' },
  { value: 4, label: 'Muy buena' }, { value: 5, label: 'Perfecta' },
];

function CloseDaySheet({ open, onClose, day }: { open: boolean; onClose: () => void; day: ISODate }) {
  const { data, update, now } = useStore();
  const { toast } = useUi();
  const log = data.logs[day];
  const m = log?.metrics ?? {};
  const hasMeals = data.meals.some((x) => x.date === day);
  const setM = (k: MetricKey, v: number | undefined) => update((d) => {
    const l = ensureLog(d, day);
    if (v === undefined) delete l.metrics[k]; else l.metrics[k] = v;
  });
  const setText = (k: 'wentWell' | 'improve' | 'foodNotes', v: string) => update((d) => { ensureLog(d, day)[k] = v; });

  const save = () => {
    update((d) => { ensureLog(d, day).closed = true; });
    const s = dayScore(data, day);
    const st = arcStats(data, now);
    const passed = (s.score ?? 0) >= data.settings.dayThreshold;
    toast(passed ? `Día cerrado · ${s.score} pts · racha ${st.currentStreak}` : `Día cerrado · ${s.score ?? 0} pts. Mañana se recupera.`);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={day === now ? 'Cerrar el día' : `Cerrar ${fmtShort(day)}`}
      footer={<button className="btn btn-primary btn-block" onClick={save}>{log?.closed ? 'Guardar' : 'Cerrar día'}</button>}>
      <div className="stack">
        <p className="muted small">Todo es opcional. Toca un número; vuelve a tocarlo para borrarlo.</p>
        <Field label="Energía"><Scale value={m.energy} onChange={(v) => setM('energy', v)} low="Agotado" high="A tope" /></Field>
        <Field label="Estado de ánimo"><Scale value={m.mood} onChange={(v) => setM('mood', v)} /></Field>
        <Field label="Estrés"><Scale value={m.stress} onChange={(v) => setM('stress', v)} low="Tranquilo" high="Muy alto" /></Field>
        <Field label="Motivación"><Scale value={m.motivation} onChange={(v) => setM('motivation', v)} /></Field>

        <Field label="¿Qué salió bien hoy?" htmlFor="c-well">
          <textarea id="c-well" className="input textarea" rows={2} value={log?.wentWell ?? ''} onChange={(e) => setText('wentWell', e.target.value)} />
        </Field>
        <Field label="¿Qué puedo mejorar mañana?" htmlFor="c-improve">
          <textarea id="c-improve" className="input textarea" rows={2} value={log?.improve ?? ''} onChange={(e) => setText('improve', e.target.value)} />
        </Field>

        <details className="more">
          <summary>Alimentación</summary>
          <div className="stack">
            {hasMeals ? (
              <p className="muted small">Calculado de tus comidas: <b className="num">{m.meals}</b> comidas · <b className="num">{m.calories}</b> kcal · <b className="num">{m.protein}</b> g de proteína{m.foodQuality ? ` · calidad ${FOOD.find((x) => x.value === m.foodQuality)?.label.toLowerCase()}` : ''}.</p>
            ) : (
              <>
                <Field label="Calidad del día"><Chips value={m.foodQuality} options={FOOD} onChange={(v) => setM('foodQuality', m.foodQuality === v ? undefined : v)} /></Field>
                <div className="grid2">
                  <Field label="Comidas"><Stepper value={m.meals} onChange={(v) => setM('meals', v)} /></Field>
                  <Field label="Proteína aprox. (g)" htmlFor="c-prot"><NumInput id="c-prot" value={m.protein} onChange={(v) => setM('protein', v)} integer /></Field>
                </div>
                <p className="muted small">Para calcular calorías, registra tus comidas en Hoy → Alimentación.</p>
              </>
            )}
            <Field label="Alcohol (bebidas)"><Stepper value={m.alcohol} onChange={(v) => setM('alcohol', v)} /></Field>
            <Toggle label="Comí fuera del plan" on={!!m.offPlan} onChange={(b) => setM('offPlan', b ? 1 : undefined)} />
            <Field label="Comentarios" htmlFor="c-food"><textarea id="c-food" className="input textarea" rows={2} value={log?.foodNotes ?? ''} onChange={(e) => setText('foodNotes', e.target.value)} /></Field>
          </div>
        </details>

        <details className="more">
          <summary>Productividad</summary>
          <div className="stack">
            <div className="grid2">
              <Field label="Horas de trabajo"><Stepper value={m.workHours} onChange={(v) => setM('workHours', v)} step={0.5} /></Field>
              <Field label="Tareas importantes"><Stepper value={m.importantTasks} onChange={(v) => setM('importantTasks', v)} /></Field>
            </div>
            <Field label="Nivel de enfoque"><Scale value={m.focus} onChange={(v) => setM('focus', v)} /></Field>
            <p className="muted small">Trabajo profundo, objetivo principal y tiempo en redes se registran en la lista de hábitos.</p>
          </div>
        </details>
      </div>
    </Sheet>
  );
}

function FoodSection({ day, onAdd, onEdit }: { day: ISODate; onAdd: () => void; onEdit: (m: Meal) => void }) {
  const { data } = useStore();
  const meals = mealsOn(data, day);
  const t = totals(meals);
  const { kcalTarget, proteinTarget } = data.settings;
  return (
    <section className="group">
      <div className="group-head"><h3>Alimentación</h3>
        <button className="link-btn" onClick={onAdd}><IconPlus size={16} /> Comida</button>
      </div>
      <div className="card list">
        {meals.length > 0 && (
          <div className="food-totals">
            <div><span className="num food-big">{t.kcal.toLocaleString('es-MX')}</span><span className="muted small">{kcalTarget ? ` / ${kcalTarget.toLocaleString('es-MX')}` : ''} kcal</span>
              {kcalTarget ? <span className="mini-bar"><span style={{ width: `${Math.min(1, t.kcal / kcalTarget) * 100}%`, background: t.kcal > kcalTarget * 1.05 ? 'var(--warn)' : undefined }} /></span> : null}</div>
            <div><span className="num food-big">{t.p}</span><span className="muted small">{proteinTarget ? ` / ${proteinTarget}` : ''} g prot.</span>
              {proteinTarget ? <span className="mini-bar"><span style={{ width: `${Math.min(1, t.p / proteinTarget) * 100}%` }} /></span> : null}</div>
            <div><span className="num food-big">{t.meals}</span><span className="muted small"> comida{t.meals === 1 ? '' : 's'}</span>
              {t.rated > 0 && <span className="muted small block">{t.good} de {t.rated} bien</span>}</div>
          </div>
        )}
        {meals.map((m) => (
          <button key={m.id} className="row-item meal-row" onClick={() => onEdit(m)}>
            <span className="row-main">
              <span className="row-title">{m.slot}{m.time && <span className="muted small"> · {m.time}</span>}</span>
              <span className="row-sub">{mealSummary(m) || m.notes || 'Sin alimentos'}</span>
            </span>
            <span className="meal-row-right">
              <span className="num">{totals([m]).kcal}<small> kcal</small></span>
              {m.quality && <span className={cx('pill', m.quality === 3 ? 'good' : m.quality === 2 ? 'warn' : 'bad')}>{QUALITY_LABEL[m.quality]}</span>}
            </span>
          </button>
        ))}
        {meals.length === 0 && (
          <button className="row-item" onClick={onAdd}>
            <span className="row-icon"><IconPlus size={18} /></span>
            <span className="row-main"><span className="row-title">Registrar comida</span><span className="row-sub">Escríbelo como mensaje: “2 huevos, 1 tortilla, café”</span></span>
          </button>
        )}
      </div>
    </section>
  );
}
