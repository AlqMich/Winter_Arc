import React from 'react';
import type { ISODate } from '../lib/types';
import { diffDays, fmtShort } from '../lib/dates';

const W = 340;

interface LP { date: ISODate; value: number }

function niceTicks(min: number, max: number, count = 3): number[] {
  if (min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

/** Línea con puntos diarios, promedio móvil y meta. Pensada para 340px de ancho. */
export function LineChart({ points, avg, goal, format = (v) => v.toFixed(1), height = 170 }: {
  points: LP[]; avg?: LP[]; goal?: number; format?: (v: number) => string; height?: number;
}) {
  if (points.length === 0) return null;
  const padL = 38, padR = 14, padT = 16, padB = 24;
  const x0 = points[0].date;
  const span = Math.max(1, diffDays(x0, points[points.length - 1].date));
  const vals = points.map((p) => p.value).concat(goal !== undefined ? [goal] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12;
  lo -= pad; hi += pad;
  const X = (d: ISODate) => padL + (diffDays(x0, d) / span) * (W - padL - padR);
  const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (height - padT - padB);
  const line = (ps: LP[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(p.value).toFixed(1)}`).join('');
  const series = avg && avg.length > 1 ? avg : points;
  const area = `${line(series)}L${X(series[series.length - 1].date).toFixed(1)},${height - padB}L${X(series[0].date).toFixed(1)},${height - padB}Z`;
  const last = points[points.length - 1];
  const ticks = niceTicks(lo + pad, hi - pad);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="chart" role="img" aria-label="Gráfica">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={Y(t)} y2={Y(t)} className="grid" />
          <text x={padL - 6} y={Y(t) + 3.5} className="axis" textAnchor="end">{format(t)}</text>
        </g>
      ))}
      <path d={area} className="area" />
      {goal !== undefined && (
        <g>
          <line x1={padL} x2={W - padR} y1={Y(goal)} y2={Y(goal)} className="goal-line" />
          <text x={W - padR} y={Y(goal) - 5} className="axis goal-text" textAnchor="end">Meta {format(goal)}</text>
        </g>
      )}
      {points.length > 1 && <path d={line(points)} className={avg && avg.length > 1 ? 'line-raw' : 'line'} />}
      {avg && avg.length > 1 && <path d={line(avg)} className="line" />}
      {points.length <= 45 && points.map((p) => <circle key={p.date} cx={X(p.date)} cy={Y(p.value)} r={2.2} className="dot" />)}
      <circle cx={X(last.date)} cy={Y(last.value)} r={4.5} className="dot-last" />
      <text x={padL} y={height - 6} className="axis">{fmtShort(x0)}</text>
      <text x={W - padR} y={height - 6} className="axis" textAnchor="end">{fmtShort(last.date)}</text>
    </svg>
  );
}

/** Barras verticales con etiqueta; `threshold` dibuja la línea de "día cumplido". */
export function Bars({ data, max, threshold, format = (v) => String(Math.round(v)), height = 150, onPick }: {
  data: { key: string; label: string; value: number | null; tone?: 'good' | 'warn' | 'bad' | 'muted' | 'accent' }[];
  max?: number; threshold?: number; format?: (v: number) => string; height?: number; onPick?: (key: string) => void;
}) {
  const padT = 18, padB = 22, padX = 4;
  const m = max ?? Math.max(1, ...data.map((d) => d.value ?? 0));
  const n = Math.max(1, data.length);
  const slot = (W - padX * 2) / n;
  const bw = Math.min(28, slot * 0.62);
  const H = height - padT - padB;
  const Y = (v: number) => padT + H - (Math.min(v, m) / m) * H;
  const showLabels = n <= 16;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="chart" role="img" aria-label="Gráfica de barras">
      <line x1={0} x2={W} y1={padT + H} y2={padT + H} className="grid" />
      {threshold !== undefined && (
        <g>
          <line x1={0} x2={W} y1={Y(threshold)} y2={Y(threshold)} className="goal-line" />
          <text x={2} y={Y(threshold) - 4} className="axis goal-text" textAnchor="start">{format(threshold)}</text>
        </g>
      )}
      {data.map((d, i) => {
        const cxp = padX + slot * i + slot / 2;
        const v = d.value ?? 0;
        const h = Math.max(d.value === null ? 0 : 2, padT + H - Y(v));
        return (
          <g key={d.key} onClick={onPick ? () => onPick(d.key) : undefined} style={onPick ? { cursor: 'pointer' } : undefined}>
            <rect x={cxp - slot / 2} y={0} width={slot} height={height} fill="transparent" />
            <rect x={cxp - bw / 2} y={padT + H - h} width={bw} height={h} rx={3} className={`barv tone-${d.tone ?? 'accent'}`} />
            {d.value !== null && showLabels && v > 0 && <text x={cxp} y={padT + H - h - 5} className="axis val" textAnchor="middle">{format(v)}</text>}
            {showLabels && <text x={cxp} y={height - 6} className="axis" textAnchor="middle">{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}
