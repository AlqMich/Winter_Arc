import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useNav } from '../nav';
import { addDays, diffDays, dowShort, fmtShort, parseISO, weekStart } from '../lib/dates';
import { weekSummary, arcInfo } from '../lib/score';
import type { WeeklyReview } from '../lib/types';
import { Bar, Chips, Field, SectionTitle, cx, fmtNum, fmtPct, toneFor, useUi } from '../ui/kit';
import { IconLeft, IconRight, IconDumbbell, IconCheck } from '../ui/icons';

export default function Week() {
  const { data, update, now } = useStore();
  const { openDay, weekAnchor } = useNav();
  const { toast } = useUi();
  const [anchor, setAnchor] = useState(weekStart(weekAnchor));
  useEffect(() => setAnchor(weekStart(weekAnchor)), [weekAnchor]);

  const w = useMemo(() => weekSummary(data, anchor, now), [data, anchor, now]);
  const prev = useMemo(() => weekSummary(data, addDays(anchor, -7), now), [data, anchor, now]);
  const isCurrent = anchor === weekStart(now);
  const weekNo = Math.floor(diffDays(weekStart(data.settings.startDate), anchor) / 7) + 1;
  const arc = arcInfo(data, now);
  const inArcWeek = weekNo >= 1 && weekNo <= Math.ceil((arc.total + 6) / 7) + 1;

  const saved = data.reviews[anchor];
  const [rev, setRev] = useState<WeeklyReview>(saved ?? { weekStart: anchor });
  useEffect(() => setRev(data.reviews[anchor] ?? { weekStart: anchor }), [anchor, data.reviews]);
  const reviewDue = !saved && (anchor < weekStart(now) || parseISO(now).getDay() === 0 || (isCurrent && parseISO(now).getDay() >= 5));

  const worst = w.ranking.slice(0, 3).filter((r) => r.pct < 0.8);
  const best = [...w.ranking].reverse().slice(0, 3).filter((r) => r.pct > 0);
  const delta = w.avgScore !== null && prev.avgScore !== null ? w.avgScore - prev.avgScore : null;

  const saveReview = () => {
    update((d) => { d.reviews[anchor] = { ...rev, weekStart: anchor, savedAt: Date.now() }; });
    toast('Revisión semanal guardada');
  };

  return (
    <div className="screen">
      <header className="day-nav">
        <button className="icon-btn" aria-label="Semana anterior" onClick={() => setAnchor(addDays(anchor, -7))}><IconLeft /></button>
        <div className="day-nav-title static">
          <span className="eyebrow">{inArcWeek && weekNo >= 1 ? `Semana ${weekNo}` : 'Semana'}{isCurrent ? ' · actual' : ''}</span>
          <span>{fmtShort(w.start)} – {fmtShort(w.end)}</span>
        </div>
        <button className="icon-btn" aria-label="Semana siguiente" disabled={isCurrent} onClick={() => setAnchor(addDays(anchor, 7))}><IconRight /></button>
      </header>

      <div className="tiles4">
        <div className="tile"><div className="tile-num">{w.avgScore ?? '—'}</div><div className="tile-label">score prom.</div>
          {delta !== null && <div className={cx('tile-delta', delta >= 0 ? 'up' : 'down')}>{delta >= 0 ? '+' : ''}{delta} vs ant.</div>}</div>
        <div className="tile"><div className="tile-num">{fmtPct(w.habitsPct)}</div><div className="tile-label">hábitos</div></div>
        <div className="tile"><div className="tile-num">{w.workouts}</div><div className="tile-label">entrenos</div></div>
        <div className="tile"><div className="tile-num">{w.daysDone}<span className="of">/7</span></div><div className="tile-label">cumplidos</div></div>
      </div>

      <div className="card list week-list">
        <div className="week-row head">
          <span>Día</span><span>Score</span><span className="c">Háb.</span><span className="c">Entr.</span><span className="r">Peso</span><span className="r">Sueño</span>
        </div>
        {w.rows.map((r) => {
          const future = r.status === 'future' || r.status === 'outside' && r.date > now;
          return (
            <button key={r.date} className={cx('week-row', r.date === now && 'is-today', future && 'future')} disabled={r.date > now} onClick={() => openDay(r.date)}>
              <span className="wd"><b>{dowShort(r.date)}</b> <span className="muted">{parseISO(r.date).getDate()}</span></span>
              <span className="wscore">
                {r.score !== null ? <><span className="num">{r.score}</span><Bar value={r.score / 100} tone={r.status === 'done' ? 'good' : r.score >= 50 ? 'warn' : 'bad'} /></> : <span className="muted">—</span>}
              </span>
              <span className="c num">{r.date <= now && r.total ? `${r.done}/${r.total}` : '—'}</span>
              <span className="c">{r.workouts ? <IconDumbbell size={16} /> : <span className="muted">·</span>}</span>
              <span className="r num">{r.weight !== undefined ? fmtNum(r.weight, 1) : '—'}</span>
              <span className="r num">{r.sleep !== undefined ? `${fmtNum(r.sleep, 1)}h` : '—'}</span>
            </button>
          );
        })}
      </div>

      <SectionTitle>Resumen</SectionTitle>
      <div className="card pad stack-s">
        <div className="kv"><span>Mejor día</span><b>{w.bestDay ? `${dowShort(w.bestDay.date)} ${parseISO(w.bestDay.date).getDate()} · ${w.bestDay.score}` : '—'}</b></div>
        <div className="kv-block">
          <span className="label">Más consistentes</span>
          {best.length ? best.map((r) => <RankRow key={r.habit.id} name={r.habit.name} pct={r.pct} />) : <span className="muted small">Aún sin datos esta semana.</span>}
        </div>
        <div className="kv-block">
          <span className="label">Más descuidados</span>
          {worst.length ? worst.map((r) => <RankRow key={r.habit.id} name={r.habit.name} pct={r.pct} />) : <span className="muted small">{w.ranking.length ? 'Ningún hábito por debajo de 80%.' : 'Aún sin datos esta semana.'}</span>}
        </div>
      </div>

      <SectionTitle right={saved ? <span className="pill good"><IconCheck size={14} /> guardada</span> : reviewDue ? <span className="pill warn">pendiente</span> : null}>
        Revisión semanal
      </SectionTitle>
      <div className={cx('card pad stack', reviewDue && 'card-attn')}>
        {!saved && !reviewDue && <p className="muted small">Se activa el domingo. Puedes llenarla antes si quieres.</p>}
        <Field label="¿Qué hice bien?" htmlFor="r-well"><textarea id="r-well" className="input textarea" rows={2} value={rev.didWell ?? ''} onChange={(e) => setRev({ ...rev, didWell: e.target.value })} /></Field>
        <Field label="¿Qué no hice?" htmlFor="r-didnt"><textarea id="r-didnt" className="input textarea" rows={2} value={rev.didnt ?? ''} onChange={(e) => setRev({ ...rev, didnt: e.target.value })} /></Field>
        <Field label="¿Qué hábito falló más?" htmlFor="r-worst" hint={worst[0] ? `Según tus datos: ${worst[0].habit.name} (${fmtPct(worst[0].pct)})` : undefined}>
          {worst.length > 0 && <Chips value={rev.worstHabit} options={worst.map((r) => ({ value: r.habit.name, label: r.habit.name }))} onChange={(v) => setRev({ ...rev, worstHabit: v })} />}
          <input id="r-worst" className="input" value={rev.worstHabit ?? ''} onChange={(e) => setRev({ ...rev, worstHabit: e.target.value })} />
        </Field>
        <Field label="¿Qué mejoró?" htmlFor="r-imp" hint={delta !== null ? `Score promedio ${delta >= 0 ? '+' : ''}${delta} vs la semana anterior` : undefined}>
          <textarea id="r-imp" className="input textarea" rows={2} value={rev.improved ?? ''} onChange={(e) => setRev({ ...rev, improved: e.target.value })} />
        </Field>
        <Field label="¿Qué debo corregir?" htmlFor="r-fix"><textarea id="r-fix" className="input textarea" rows={2} value={rev.fix ?? ''} onChange={(e) => setRev({ ...rev, fix: e.target.value })} /></Field>
        <Field label="Prioridad de la próxima semana" htmlFor="r-prio"><input id="r-prio" className="input" value={rev.priority ?? ''} onChange={(e) => setRev({ ...rev, priority: e.target.value })} /></Field>
        <button className="btn btn-primary btn-block" onClick={saveReview}>Guardar revisión</button>
      </div>
    </div>
  );
}

function RankRow({ name, pct }: { name: string; pct: number }) {
  return (
    <div className="rank-row">
      <span className="rank-name">{name}</span>
      <Bar value={pct} tone={toneFor(pct)} />
      <span className="num rank-pct">{fmtPct(pct)}</span>
    </div>
  );
}
