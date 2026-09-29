import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { IconClose, IconMinus, IconPlus } from './icons';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

/* ---------- Formato ---------- */

export function fmtNum(v: number | undefined | null, digits = 1): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return r.toLocaleString('es-MX', { maximumFractionDigits: digits });
}

export function fmtMoney(v: number, currency = 'MXN'): string {
  return v.toLocaleString('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 });
}

export function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `${Math.round(v * 100)}%`;
}

/** Convierte texto del teclado (acepta coma decimal) a número o undefined. */
export function parseNum(s: string): number | undefined {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/* ---------- Bottom sheet ---------- */

export function Sheet({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll'); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-root" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><IconClose /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Toast + Confirm ---------- */

interface ConfirmOpts { title: string; body?: string; confirm: string; danger?: boolean }
interface UiCtx { toast: (msg: string) => void; confirm: (o: ConfirmOpts) => Promise<boolean> }
const Ui = createContext<UiCtx>({ toast: () => {}, confirm: async () => false });
export const useUi = () => useContext(Ui);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [conf, setConf] = useState<(ConfirmOpts & { resolve: (b: boolean) => void }) | null>(null);
  const t = useRef<number | undefined>(undefined);
  const toast = useCallback((m: string) => {
    setMsg(m);
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setConf({ ...o, resolve })), []);
  const close = (b: boolean) => { conf?.resolve(b); setConf(null); };
  return (
    <Ui.Provider value={{ toast, confirm }}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
      <Sheet open={!!conf} onClose={() => close(false)} title={conf?.title ?? ''}
        footer={<div className="row gap-s">
          <button className="btn btn-ghost grow" onClick={() => close(false)}>Cancelar</button>
          <button className={cx('btn grow', conf?.danger ? 'btn-danger' : 'btn-primary')} onClick={() => close(true)}>{conf?.confirm}</button>
        </div>}>
        {conf?.body && <p className="muted">{conf.body}</p>}
      </Sheet>
    </Ui.Provider>
  );
}

/* ---------- Controles ---------- */

export function Seg<T extends string>({ value, options, onChange, size }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; size?: 's';
}) {
  return (
    <div className={cx('seg', size === 's' && 'seg-s')} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value}
          className={cx('seg-btn', value === o.value && 'on')} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Chips<T extends string | number>({ value, options, onChange, multi }: {
  value: T | T[] | undefined; options: { value: T; label: string }[]; onChange: (v: T) => void; multi?: boolean;
}) {
  const isOn = (v: T) => (multi ? (value as T[] | undefined)?.includes(v) : value === v);
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={String(o.value)} type="button" className={cx('chip', isOn(o.value) && 'on')}
          aria-pressed={!!isOn(o.value)} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/** Escala 1–10 en una fila: un toque, sin teclado. Tocar el valor elegido lo borra. */
export function Scale({ value, onChange, max = 10, low, high }: {
  value?: number; onChange: (v: number | undefined) => void; max?: number; low?: string; high?: string;
}) {
  return (
    <div>
      <div className="scale" style={{ gridTemplateColumns: `repeat(${max}, 1fr)` }}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" className={cx('scale-btn', value === n && 'on', value !== undefined && n < value && 'fill')}
            aria-label={`${n}`} aria-pressed={value === n} onClick={() => onChange(value === n ? undefined : n)}>{n}</button>
        ))}
      </div>
      {(low || high) && <div className="scale-legend"><span>{low}</span><span>{high}</span></div>}
    </div>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, unit, id }: {
  value?: number; onChange: (v: number | undefined) => void; step?: number; min?: number; unit?: string; id?: string;
}) {
  const dec = (step.toString().split('.')[1] || '').length;
  const round = (n: number) => Math.round(n * 10 ** dec) / 10 ** dec;
  return (
    <div className="stepper">
      <button type="button" className="step-btn" aria-label="Menos" onClick={() => {
        const n = round((value ?? 0) - step);
        onChange(n <= min ? (value === undefined ? undefined : min) : n);
      }}><IconMinus size={20} /></button>
      <NumInput id={id} value={value} onChange={onChange} className="step-input" />
      {unit && <span className="step-unit">{unit}</span>}
      <button type="button" className="step-btn" aria-label="Más" onClick={() => onChange(round((value ?? 0) + step))}><IconPlus size={20} /></button>
    </div>
  );
}

/** Input numérico con teclado decimal de iOS; mantiene el texto mientras escribes. */
export function NumInput({ value, onChange, placeholder, className, id, integer }: {
  value?: number; onChange: (v: number | undefined) => void; placeholder?: string; className?: string; id?: string; integer?: boolean;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value === undefined ? '' : String(value));
  }, [value]);
  return (
    <input id={id} className={cx('input', className)} inputMode={integer ? 'numeric' : 'decimal'} enterKeyHint="done"
      placeholder={placeholder ?? '—'} value={text}
      onFocus={(e) => { focused.current = true; e.currentTarget.select(); }}
      onBlur={() => { focused.current = false; setText(value === undefined ? '' : String(value)); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
      onChange={(e) => { setText(e.target.value); const n = parseNum(e.target.value); if (n !== undefined || e.target.value.trim() === '') onChange(n); }} />
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Toggle({ on, onChange, label, id }: { on: boolean; onChange: (b: boolean) => void; label: string; id?: string }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={on} className="toggle-row" onClick={() => onChange(!on)}>
      <span>{label}</span>
      <span className={cx('toggle', on && 'on')}><span /></span>
    </button>
  );
}

export function Bar({ value, marker, tone }: { value: number; marker?: number | null; tone?: 'good' | 'warn' | 'bad' | 'accent' }) {
  return (
    <div className="bar">
      <div className={cx('bar-fill', tone && `tone-${tone}`)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
      {marker !== undefined && marker !== null && <div className="bar-marker" style={{ left: `${Math.max(0, Math.min(1, marker)) * 100}%` }} />}
    </div>
  );
}

export function toneFor(p: number | null | undefined): 'good' | 'warn' | 'bad' {
  if (p === null || p === undefined) return 'bad';
  return p >= 0.8 ? 'good' : p >= 0.5 ? 'warn' : 'bad';
}

/** Anillo de score. */
export function Ring({ value, size = 128, stroke = 10, label, sub }: {
  value: number | null; size?: number; stroke?: number; label?: string; sub?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray .5s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="ring-center">
        <div className="ring-num">{value === null ? '—' : value}</div>
        {label && <div className="ring-label">{label}</div>}
        {sub && <div className="ring-sub">{sub}</div>}
      </div>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {body && <p className="muted">{body}</p>}
      {action}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return <div className="section-title"><h3>{children}</h3>{right}</div>;
}
