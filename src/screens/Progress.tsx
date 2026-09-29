import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useNav } from '../nav';
import type { ISODate } from '../lib/types';
import { addDays, fmtShort, fmtMonth, monthKey, parseISO, rangeDays, weekStart, diffDays, DOW_LETTERS, fmtLong } from '../lib/dates';
import {
  arcInfo, arcStats, dayScore, dayStatus, habitRanking, recentWindow, weeklyPace, metricSeries, movingAvg,
  weeklyBuckets, runs, pace, fmtPace, workoutsOn, goalCurrent, goalProgress, goalExpected, monthMoney, monthAvg, evaluatedDays, hasData,
} from '../lib/score';
import { Bar, Seg, SectionTitle, cx, fmtMoney, fmtNum, fmtPct, toneFor, Empty } from '../ui/kit';
import { Bars, LineChart } from '../ui/charts';
import { IconAlert, IconFlame, IconRight } from '../ui/icons';

type View = 'habitos' | 'cuerpo' | 'calendario';

export default function Progress() {
  const { data, now } = useStore();
  const { openDay, go, openWeek } = useNav();
  const [view, setView] = useState<View>('habitos');
  const arc = arcInfo(data, now);
  const st = useMemo(() => arcStats(data, now), [data, now]);
  const alerts = useAlerts();
  const goals = data.goals.filter((g) => !g.archived);
  const mm = monthMoney(data, monthKey(now));
  const mAvg = monthAvg(data, monthKey(now), now);

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="eyebrow">Winter Arc · {fmtShort(data.settings.startDate)} – {fmtShort(arc.endDate)}</div>
        <h1 className="big-title">Día <span className="num">{arc.started ? arc.day : 0}</span><span className="of"> / {arc.total}</span></h1>
        <Bar value={arc.pct} />
        <div className="hero-meta row between"><span>{fmtPct(arc.pct)} del reto</span><span>{arc.finished ? 'Terminado' : `${Math.max(0, arc.daysLeft - 1)} días restantes`}</span></div>
      </header>

      <section className="card pad consistency">
        <div>
          <div className="label">Consistencia</div>
          <div className="mega num">{st.evaluated ? fmtPct(st.consistency) : '—'}</div>
          <div className="muted small">{st.done} de {st.evaluated} días cumplidos · últimos 7: {st.evaluated ? fmtPct(st.consistency7) : '—'}</div>
        </div>
        <div className="consistency-split">
          <Split n={st.done} label="cumplidos" tone="good" />
          <Split n={st.partial} label="flojos" tone="warn" />
          <Split n={st.missed} label="sin registro" tone="bad" />
        </div>
      </section>

      <div className="tiles4">
        <div className="tile"><div className="tile-num"><IconFlame size={16} /> {st.currentStreak}</div><div className="tile-label">racha</div></div>
        <div className="tile"><div className="tile-num">{st.bestStreak}</div><div className="tile-label">mejor racha</div></div>
        <div className="tile"><div className="tile-num">{st.evaluated ? st.avgScore : '—'}</div><div className="tile-label">score prom.</div></div>
        <div className="tile"><div className="tile-num">{mAvg ?? '—'}</div><div className="tile-label">score mes</div></div>
      </div>
      <p className="muted small center">Score acumulado: <b className="num">{st.totalPoints.toLocaleString('es-MX')}</b> pts de {(st.evaluated * 100).toLocaleString('es-MX')} posibles</p>

      {alerts.length > 0 && (
        <>
          <SectionTitle>Atención</SectionTitle>
          <div className="card list">
            {alerts.map((a, i) => (
              <button key={i} className="row-item alert" onClick={a.action}>
                <span className={cx('row-icon', a.level)}><IconAlert size={18} /></span>
                <span className="row-main"><span className="row-title">{a.title}</span>{a.sub && <span className="row-sub">{a.sub}</span>}</span>
                <IconRight size={18} className="muted" />
              </button>
            ))}
          </div>
        </>
      )}

      <SectionTitle right={<button className="link-btn" onClick={() => go('metas')}>Ver todo</button>}>Objetivos</SectionTitle>
      <div className="card pad stack-s">
        {goals.length === 0 && <p className="muted small">Define objetivos (peso, running, ventas, ahorro) para ver aquí tu avance.</p>}
        {goals.slice(0, 5).map((g) => {
          const cur = goalCurrent(data, g);
          const p = goalProgress(g, cur);
          const exp = goalExpected(g, data, now);
          return (
            <div key={g.id} className="goal-mini">
              <div className="row between"><span className="goal-mini-name">{g.name}</span>
                <span className="num small">{fmtVal(g.start, g.unit)} → <b>{fmtVal(cur, g.unit)}</b> / {fmtVal(g.target, g.unit)}</span></div>
              <Bar value={p} marker={exp} tone={p >= 1 ? 'good' : exp !== null && p < exp - 0.15 ? 'warn' : 'accent'} />
            </div>
          );
        })}
        <button className="goal-mini money-line" onClick={() => go('mas', 'finanzas')}>
          <div className="row between"><span className="goal-mini-name">Ahorro de {fmtMonth(monthKey(now)).split(' ')[0]}</span>
            <span className="num small"><b>{fmtMoney(mm.ahorro + mm.inversion, data.settings.currency)}</b>{data.settings.monthlySavingsTarget ? ` / ${fmtMoney(data.settings.monthlySavingsTarget, data.settings.currency)}` : ''}{mm.savingsRate !== null ? ` · ${fmtPct(mm.savingsRate)}` : ''}</span></div>
          {data.settings.monthlySavingsTarget > 0 && <Bar value={(mm.ahorro + mm.inversion) / data.settings.monthlySavingsTarget} />}
        </button>
      </div>

      <div className="sticky-seg">
        <Seg value={view} onChange={setView} options={[{ value: 'habitos', label: 'Hábitos' }, { value: 'cuerpo', label: 'Cuerpo' }, { value: 'calendario', label: 'Calendario' }]} />
      </div>
      {view === 'habitos' && <HabitsView onPick={openDay} onWeek={openWeek} />}
      {view === 'cuerpo' && <BodyView />}
      {view === 'calendario' && <CalendarView onPick={openDay} />}
    </div>
  );
}

function fmtVal(v: number, unit: string) {
  if (unit === '$') return fmtMoney(v);
  return `${fmtNum(v, 1)}${unit && unit.length <= 3 ? ' ' + unit : ''}`;
}

function Split({ n, label, tone }: { n: number; label: string; tone: string }) {
  return <div className="split"><span className={cx('dot-s', tone)} /><span className="num">{n}</span><span className="muted small">{label}</span></div>;
}

interface Alert { level: 'bad' | 'warn'; title: string; sub?: string; action: () => void }

function useAlerts(): Alert[] {
  const { data, now } = useStore();
  const { go, openDay, openWeek } = useNav();
  return useMemo(() => {
    const out: Alert[] = [];
    const arc = arcInfo(data, now);
    if (!arc.started) return out;
    const y = addDays(now, -1);
    if (diffDays(data.settings.startDate, y) >= 0 && !hasData(data, y)) {
      out.push({ level: 'bad', title: 'Ayer quedó sin registrar', sub: 'Complétalo ahora para no perder la racha', action: () => openDay(y) });
    }
    for (const p of weeklyPace(data, now)) {
      if (p.behind) out.push({ level: 'warn', title: `${p.habit.name}: ${p.doneDays}/${p.target} esta semana`, sub: `Quedan ${p.daysLeft} día${p.daysLeft > 1 ? 's' : ''}, necesitas ${p.target - p.doneDays}`, action: () => go('hoy') });
    }
    const win = recentWindow(data, 7, now);
    const evald = evaluatedDays(data, now);
    const last7 = evald.slice(-7);
    const missed7 = last7.filter((d) => !hasData(data, d)).length;
    if (last7.length >= 3 && missed7 / last7.length >= 0.5) {
      // Si el problema es no registrar, eso es lo único que importa: no listar 10 hábitos "descuidados".
      out.push({ level: 'bad', title: `${missed7} de los últimos ${last7.length} días sin registro`, sub: 'La consistencia empieza por abrir la app cada día', action: () => go('progreso') });
    } else if (win && evald.length >= 3) {
      const weak = habitRanking(data, win[0], win[1]).filter((r) => r.pct < 0.5 && r.habit.frequency === 'daily');
      if (weak.length > 2) {
        out.push({ level: 'warn', title: `Descuidando ${weak.length} hábitos`, sub: weak.slice(0, 3).map((r) => `${r.habit.name} ${fmtPct(r.pct)}`).join(' · ') + (weak.length > 3 ? '…' : ''), action: () => go('hoy') });
      } else {
        for (const r of weak) out.push({ level: r.pct < 0.25 ? 'bad' : 'warn', title: `Descuidando: ${r.habit.name}`, sub: `${fmtPct(r.pct)} en los últimos 7 días`, action: () => go('hoy') });
      }
    }
    const w = metricSeries(data, 'weight');
    const lastW = w.length ? w[w.length - 1].date : null;
    if (!lastW) out.push({ level: 'warn', title: 'Sin peso registrado', sub: 'Regístralo en Hoy → Medidas para ver tu evolución', action: () => go('hoy') });
    else if (diffDays(lastW, now) >= 7) out.push({ level: 'warn', title: `Sin pesarte desde hace ${diffDays(lastW, now)} días`, action: () => go('hoy') });
    const lastWeek = addDays(weekStart(now), -7);
    if (diffDays(data.settings.startDate, addDays(lastWeek, 6)) >= 0 && !data.reviews[lastWeek]) {
      out.push({ level: 'warn', title: 'Revisión semanal pendiente', sub: `Semana del ${fmtShort(lastWeek)}`, action: () => openWeek(lastWeek) });
    }
    for (const g of data.goals.filter((x) => !x.archived)) {
      const p = goalProgress(g, goalCurrent(data, g));
      const e = goalExpected(g, data, now);
      if (e !== null && p < 1 && p < e - 0.15) out.push({ level: 'warn', title: `Objetivo atrasado: ${g.name}`, sub: `${fmtPct(p)} logrado, deberías ir en ${fmtPct(e)}`, action: () => go('metas') });
    }
    return out.slice(0, 6);
  }, [data, now, go, openDay, openWeek]);
}

function HabitsView({ onPick, onWeek }: { onPick: (d: ISODate) => void; onWeek: (d: ISODate) => void }) {
  const { data, now } = useStore();
  const arc = arcInfo(data, now);
  const [range, setRange] = useState<'14' | '28' | 'all'>('28');
  const days = useMemo(() => {
    if (!arc.started) return [];
    const last = arc.finished ? arc.endDate : now;
    const n = range === 'all' ? 10000 : Number(range);
    const from = [data.settings.startDate, addDays(last, -(n - 1))].sort().slice(-1)[0];
    return rangeDays(from, last);
  }, [data.settings.startDate, arc.started, arc.finished, arc.endDate, now, range]);
  const win = recentWindow(data, range === 'all' ? 10000 : Number(range), now);
  const ranking = useMemo(() => (win ? habitRanking(data, win[0], win[1]) : []), [data, win?.[0], win?.[1]]);
  const weekly = useMemo(() => weeklyBuckets(data, (d) => dayScore(data, d).score ?? 0, now), [data, now]);

  if (!arc.started) return <Empty title="El reto aún no empieza" body={`Inicia el ${fmtLong(data.settings.startDate)}.`} />;

  const cats = data.categories.map((c) => {
    const rs = ranking.filter((r) => r.habit.categoryId === c.id);
    let w = 0, s = 0;
    for (const r of rs) { w += r.habit.weight; s += r.pct * r.habit.weight; }
    return { name: c.name, pct: w ? s / w : null };
  }).filter((c) => c.pct !== null);

  return (
    <div className="stack">
      <div className="card pad">
        <div className="row between chart-head">
          <div><div className="label">Score diario</div><div className="muted small">Línea: umbral de día cumplido ({data.settings.dayThreshold})</div></div>
          <Seg size="s" value={range} onChange={setRange} options={[{ value: '14', label: '14d' }, { value: '28', label: '28d' }, { value: 'all', label: 'Todo' }]} />
        </div>
        <Bars max={100} threshold={data.settings.dayThreshold} onPick={onPick}
          data={days.map((d) => {
            const s = dayStatus(data, d, now);
            return { key: d, label: days.length <= 14 ? DOW_LETTERS[parseISO(d).getDay()] : '', value: dayScore(data, d).score ?? 0,
              tone: s === 'done' ? 'good' : s === 'partial' ? 'warn' : s === 'pending' ? 'muted' : 'bad' };
          })} />
        {days.length > 14 && <div className="row between axis-row"><span>{fmtShort(days[0])}</span><span>{fmtShort(days[days.length - 1])}</span></div>}
      </div>

      <div className="card pad">
        <div className="label">Cumplimiento por hábito</div>
        <div className="muted small mb">{win ? `${fmtShort(win[0])} – ${fmtShort(win[1])} · de menor a mayor` : 'Sin días evaluados todavía'}</div>
        <div className="stack-s">
          {ranking.map((r) => (
            <div key={r.habit.id} className="rank-row">
              <span className="rank-name">{r.habit.name}</span>
              <Bar value={r.pct} tone={toneFor(r.pct)} />
              <span className="num rank-pct">{fmtPct(r.pct)}</span>
            </div>
          ))}
        </div>
      </div>

      {cats.length > 0 && (
        <div className="card pad">
          <div className="label mb">Por área</div>
          <div className="cat-grid">
            {cats.map((c) => (
              <div key={c.name} className="cat-cell"><div className={cx('num cat-pct', `t-${toneFor(c.pct)}`)}>{fmtPct(c.pct)}</div><div className="muted small">{c.name}</div></div>
            ))}
          </div>
        </div>
      )}

      {weekly.length > 1 && (
        <div className="card pad">
          <div className="label">Score semanal promedio</div>
          <div className="muted small mb">Toca una barra para ver la semana</div>
          <Bars max={100} threshold={data.settings.dayThreshold} onPick={(k) => onWeek(k)}
            data={weekly.map((b, i) => {
              const nDays = rangeDays(b.weekStart, addDays(b.weekStart, 6)).filter((d) => d <= now && d >= data.settings.startDate && diffDays(data.settings.startDate, d) < arc.total).length;
              const avg = nDays ? b.value / nDays : 0;
              return { key: b.weekStart, label: `S${i + 1}`, value: Math.round(avg), tone: avg >= data.settings.dayThreshold ? 'good' : avg >= 50 ? 'warn' : 'bad' };
            })} />
        </div>
      )}
    </div>
  );
}

function BodyView() {
  const { data, now } = useStore();
  const weight = metricSeries(data, 'weight');
  const waist = metricSeries(data, 'waist');
  const sleep = metricSeries(data, 'sleep').filter((p) => p.date >= addDays(now, -41));
  const weightGoal = data.goals.find((g) => g.source === 'weight' && !g.archived);
  const waistGoal = data.goals.find((g) => g.source === 'waist' && !g.archived);
  const rs = runs(data);
  const kmWeek = weeklyBuckets(data, (d) => workoutsOn(data, d).filter((w) => w.type === 'running').reduce((a, w) => a + (w.distance ?? 0), 0), now);
  const perWeek = weeklyBuckets(data, (d) => workoutsOn(data, d).length, now);
  const trainHabit = data.habits.find((h) => h.link === 'workout' && !h.archived);
  const paces = rs.map((w) => ({ date: w.date, value: pace(w.duration, w.distance) })).filter((p): p is { date: string; value: number } => p.value !== null);
  const sleepHabit = data.habits.find((h) => h.link === 'sleep');

  return (
    <div className="stack">
      <MetricCard title="Peso" unit={data.settings.weightUnit} points={weight} goal={weightGoal?.target} lowerIsBetter
        empty="Registra tu peso en Hoy → Medidas. Con 2 registros aparece la gráfica y el promedio de 7 días." />
      <MetricCard title="Cintura" unit="cm" points={waist} goal={waistGoal?.target} lowerIsBetter
        empty="Mide tu cintura una vez por semana, mismo día y hora." />

      <div className="card pad">
        <div className="label">Entrenamientos por semana</div>
        <div className="muted small mb">{trainHabit?.frequency === 'weekly' ? `Meta: ${trainHabit.timesPerWeek} por semana` : 'Todos los tipos'}</div>
        {perWeek.length ? (
          <Bars data={perWeek.map((b, i) => ({ key: b.weekStart, label: `S${i + 1}`, value: b.value, tone: trainHabit && b.value >= trainHabit.timesPerWeek ? 'good' : 'accent' }))}
            threshold={trainHabit?.frequency === 'weekly' ? trainHabit.timesPerWeek : undefined} max={Math.max(trainHabit?.timesPerWeek ?? 1, ...perWeek.map((b) => b.value)) + 1} />
        ) : <p className="muted small">Sin datos todavía.</p>}
      </div>

      <div className="card pad">
        <div className="label">Running · km por semana</div>
        <div className="muted small mb">{rs.length ? `${rs.length} carreras · ${fmtNum(rs.reduce((a, w) => a + (w.distance ?? 0), 0), 1)} km totales · más larga ${fmtNum(Math.max(...rs.map((w) => w.distance ?? 0)), 1)} km` : 'Registra una carrera con distancia para ver esta gráfica.'}</div>
        {rs.length > 0 && <Bars data={kmWeek.map((b, i) => ({ key: b.weekStart, label: `S${i + 1}`, value: Math.round(b.value * 10) / 10 }))} format={(v) => fmtNum(v, 1)} />}
      </div>

      {paces.length > 0 && (
        <div className="card pad">
          <div className="row between"><div className="label">Ritmo por carrera (min/km)</div><div className="num small">últ. <b>{fmtPace(paces[paces.length - 1].value)}</b></div></div>
          <div className="muted small mb">Más abajo es más rápido. Mejor: {fmtPace(Math.min(...paces.map((p) => p.value)))}</div>
          {paces.length > 1 ? <LineChart points={paces} format={(v) => fmtPace(v)} /> : <p className="muted small">Con 2 carreras aparece la tendencia.</p>}
        </div>
      )}

      {sleep.length > 1 && (
        <div className="card pad">
          <div className="row between"><div className="label">Sueño (últimas 6 semanas)</div>
            <div className="num small">prom. <b>{fmtNum(sleep.reduce((a, p) => a + p.value, 0) / sleep.length, 1)} h</b></div></div>
          <LineChart points={sleep} avg={movingAvg(sleep)} goal={sleepHabit?.target} format={(v) => fmtNum(v, 1)} height={150} />
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, unit, points, goal, empty, lowerIsBetter }: {
  title: string; unit: string; points: { date: string; value: number }[]; goal?: number; empty: string; lowerIsBetter?: boolean;
}) {
  if (points.length === 0) return <div className="card pad"><div className="label">{title}</div><p className="muted small">{empty}</p></div>;
  const first = points[0].value;
  const avg = movingAvg(points);
  const last = avg[avg.length - 1].value;
  const delta = points[points.length - 1].value - first;
  const good = lowerIsBetter ? delta < 0 : delta > 0;
  return (
    <div className="card pad">
      <div className="row between">
        <div className="label">{title}</div>
        <div className="num"><b className="big-num">{fmtNum(points[points.length - 1].value, 1)}</b> <span className="muted small">{unit}</span></div>
      </div>
      <div className="muted small mb">
        {fmtNum(first, 1)} → {fmtNum(points[points.length - 1].value, 1)} {unit}
        {points.length > 1 && <> · <span className={good ? 'good-text' : delta === 0 ? '' : 'bad-text'}>{delta > 0 ? '+' : ''}{fmtNum(delta, 1)} {unit}</span> · prom. 7d {fmtNum(last, 1)}</>}
        {goal !== undefined && <> · faltan {fmtNum(Math.abs(points[points.length - 1].value - goal), 1)}</>}
      </div>
      {points.length > 1 ? <LineChart points={points} avg={avg} goal={goal} format={(v) => fmtNum(v, 1)} /> : <p className="muted small">Con un segundo registro aparece la gráfica.</p>}
    </div>
  );
}

function CalendarView({ onPick }: { onPick: (d: ISODate) => void }) {
  const { data, now } = useStore();
  const arc = arcInfo(data, now);
  const months = useMemo(() => {
    const out: string[] = [];
    for (let m = monthKey(data.settings.startDate); m <= monthKey(arc.endDate);) {
      out.push(m);
      const [y, mo] = m.split('-').map(Number);
      m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
    }
    return out;
  }, [data.settings.startDate, arc.endDate]);
  const reviewWeeks = new Set(Object.keys(data.reviews));
  const dueDates = new Set(data.goals.filter((g) => g.dueDate && !g.archived).map((g) => g.dueDate));

  return (
    <div className="stack">
      <div className="legend">
        <span><i className="lg done" />cumplido</span><span><i className="lg partial" />flojo</span><span><i className="lg missed" />sin registro</span>
        <span><i className="lg-dot" />entreno</span><span><i className="lg-ring" />objetivo</span>
      </div>
      {months.map((m) => {
        const first = `${m}-01`;
        const lead = (parseISO(first).getDay() + 6) % 7;
        const [y, mo] = m.split('-').map(Number);
        const n = new Date(y, mo, 0).getDate();
        const cells: (ISODate | null)[] = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => addDays(first, i))];
        return (
          <div key={m} className="card pad">
            <div className="label mb cap">{fmtMonth(m)}</div>
            <div className="cal-grid">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const s = dayStatus(data, d, now);
                const sc = s === 'done' || s === 'partial' ? dayScore(data, d).score : null;
                const clickable = s !== 'outside' && s !== 'future' || (s === 'outside' && d <= now);
                return (
                  <button key={d} className={cx('cal-cell', s, d === now && 'today', dueDates.has(d) && 'due', reviewWeeks.has(weekStart(d)) && parseISO(d).getDay() === 0 && 'reviewed')}
                    disabled={!clickable} onClick={() => onPick(d)} aria-label={`${fmtLong(d)}${sc !== null ? `, score ${sc}` : ''}`}>
                    <span>{parseISO(d).getDate()}</span>
                    {workoutsOn(data, d).length > 0 && <i className="cal-dot" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="muted small center">Toca un día para abrir su registro. El domingo con borde indica revisión semanal guardada.</p>
    </div>
  );
}
