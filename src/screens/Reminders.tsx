import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import type { Reminder, ReminderKind } from '../lib/types';
import { uid } from '../lib/defaults';
import { DOW_LETTERS } from '../lib/dates';
import { pushState, enablePush, disablePush, testPush, isIOS, type PushState } from '../lib/push';
import { Field, Seg, Sheet, Toggle, useUi, cx, SectionTitle } from '../ui/kit';
import { IconPlus, IconTrash, IconShare } from '../ui/icons';

const KIND_LABEL: Record<ReminderKind, string> = {
  wake: 'Despertar', water: 'Tomar agua', workout: 'Entrenar', close: 'Cerrar el día', sleep: 'Hora de dormir', habit: 'Hábito', custom: 'Personalizado',
};
const KIND_HINT: Record<ReminderKind, string> = {
  wake: 'Te dice qué día del reto es y qué toca hoy.',
  water: 'Se repite en el horario que elijas. Deja de avisar cuando llegas a tu meta de agua.',
  workout: 'No avisa si ya registraste un entrenamiento ese día.',
  close: 'No avisa si ya cerraste el día. Te dice qué hábitos te faltan.',
  sleep: 'Te recuerda tu meta de sueño.',
  habit: 'No avisa si ese hábito ya está cumplido.',
  custom: 'Siempre avisa, con el texto que escribas (p. ej. “Tomar creatina”).',
};

function daysLabel(days: number[]) {
  if (!days.length || days.length === 7) return 'Todos los días';
  const s = [...days].sort();
  if (s.join() === '1,2,3,4,5') return 'Lunes a viernes';
  if (s.join() === '0,6') return 'Fines de semana';
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => DOW_LETTERS[d]).join(' ');
}

export function reminderName(r: Reminder, habitName?: string) {
  if (r.kind === 'custom') return r.title || 'Recordatorio';
  if (r.kind === 'habit') return r.title || habitName || 'Hábito';
  return KIND_LABEL[r.kind];
}

export default function Reminders() {
  const { data, update } = useStore();
  const { toast } = useUi();
  const [state, setState] = useState<PushState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { pushState().then(setState); }, []);

  const enable = async () => {
    setBusy(true);
    const r = await enablePush(data);
    setBusy(false);
    if (r.ok) {
      setState('on');
      const t = await testPush();
      toast(t ? 'Listo. Te enviamos una notificación de prueba.' : 'Activadas. La prueba no llegó; revisa tu conexión.');
    } else {
      setState(await pushState());
      toast(r.error || 'No se pudo activar');
    }
  };

  const setRem = (id: string, p: Partial<Reminder>) => update((d) => {
    const r = d.reminders.find((x) => x.id === id);
    if (r) Object.assign(r, p);
  });

  return (
    <div className="screen">
      <div className="card pad stack-s">
        <StatusBlock state={state} busy={busy} onEnable={enable}
          onTest={async () => toast((await testPush()) ? 'Notificación de prueba enviada' : 'No se pudo enviar la prueba')}
          onDisable={async () => { await disablePush(); setState('off'); toast('Notificaciones desactivadas en este teléfono'); }} />
      </div>

      <SectionTitle right={<button className="link-btn" onClick={() => { setEditing(null); setOpen(true); }}><IconPlus size={16} /> Nuevo</button>}>Recordatorios</SectionTitle>
      <div className="card list">
        {data.reminders.map((r) => {
          const habit = r.habitId ? data.habits.find((h) => h.id === r.habitId) : undefined;
          const when = r.kind === 'water' ? `${r.time}–${r.until ?? '20:00'} · cada ${((r.every ?? 120) / 60).toLocaleString('es-MX')} h` : r.time;
          return (
            <div key={r.id} className="row-item">
              <button className="row-main left" onClick={() => { setEditing(r); setOpen(true); }}>
                <span className="row-title">{reminderName(r, habit?.name)}</span>
                <span className="row-sub"><span className="num rem-time">{when}</span> · {daysLabel(r.days)}</span>
              </button>
              <button type="button" role="switch" aria-checked={r.enabled} aria-label={`Activar ${reminderName(r, habit?.name)}`}
                className="switch-btn" onClick={() => setRem(r.id, { enabled: !r.enabled })}>
                <span className={cx('toggle', r.enabled && 'on')}><span /></span>
              </button>
            </div>
          );
        })}
      </div>
      <p className="muted small">Los avisos llegan aunque la app esté cerrada, con hasta 5 minutos de diferencia. Los que dicen “no avisa si…” usan lo que registraste en la app.</p>

      <ReminderSheet open={open} onClose={() => setOpen(false)} editing={editing} />
    </div>
  );
}

function StatusBlock({ state, busy, onEnable, onTest, onDisable }: {
  state: PushState | 'loading'; busy: boolean; onEnable: () => void; onTest: () => void; onDisable: () => void;
}) {
  if (state === 'loading') return <p className="muted">Revisando…</p>;
  if (state === 'on') return (
    <>
      <div className="row between"><b>Notificaciones activas</b><span className="pill good">en este teléfono</span></div>
      <div className="row gap-s">
        <button className="btn btn-ghost grow" onClick={onTest}>Enviar prueba</button>
        <button className="btn btn-ghost grow" onClick={onDisable}>Desactivar</button>
      </div>
    </>
  );
  if (state === 'off') return (
    <>
      <b>Activa las notificaciones</b>
      <p className="muted small">Te llegarán los recordatorios de abajo aunque la app esté cerrada. Cada teléfono se activa por separado.</p>
      <button className="btn btn-primary btn-block" disabled={busy} onClick={onEnable}>{busy ? 'Activando…' : 'Activar notificaciones'}</button>
    </>
  );
  if (state === 'needs-install') return (
    <>
      <div className="row gap-s"><IconShare size={20} /><b>Primero instala la app</b></div>
      <p className="muted small">En iPhone, las notificaciones solo funcionan si abres Winter Arc desde el ícono de tu pantalla de inicio. En Safari: Compartir → “Agregar a pantalla de inicio”, y ábrela desde ahí.</p>
    </>
  );
  if (state === 'denied') return (
    <>
      <b>Notificaciones bloqueadas</b>
      <p className="muted small">{isIOS() ? 'Ve a Ajustes del iPhone → Notificaciones → Winter Arc y activa “Permitir notificaciones”. Luego vuelve aquí.' : 'Permite las notificaciones para este sitio en la configuración del navegador.'}</p>
    </>
  );
  if (state === 'no-server') return (
    <>
      <b>Disponible en la app instalada</b>
      <p className="muted small">Esta versión no tiene el servidor de notificaciones. Usa Winter Arc desde tu enlace de Netlify instalado en la pantalla de inicio.</p>
    </>
  );
  return <><b>Este navegador no soporta notificaciones</b><p className="muted small">En iPhone se necesita iOS 16.4 o más reciente y abrir la app desde la pantalla de inicio.</p></>;
}

function ReminderSheet({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Reminder | null }) {
  const { data, update } = useStore();
  const { toast } = useUi();
  const blank = (): Reminder => ({ id: uid(), kind: 'custom', enabled: true, time: '09:00', days: [], title: '' });
  const [r, setR] = useState<Reminder>(blank);
  useEffect(() => { if (open) setR(editing ? structuredClone(editing) : blank()); }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<Reminder>) => setR((x) => ({ ...x, ...p }));
  const fixed = editing && ['wake', 'water', 'workout', 'close', 'sleep'].includes(editing.kind);
  const valid = r.time && (r.kind !== 'custom' || (r.title ?? '').trim()) && (r.kind !== 'habit' || r.habitId);
  const days = r.days.length ? r.days : [0, 1, 2, 3, 4, 5, 6];

  const save = () => {
    if (!valid) return;
    update((d) => {
      const i = d.reminders.findIndex((x) => x.id === r.id);
      const clean = { ...r, days: r.days.length === 7 ? [] : r.days };
      if (i >= 0) d.reminders[i] = clean; else d.reminders.push(clean);
    });
    toast('Recordatorio guardado');
    onClose();
  };
  const remove = () => {
    update((d) => { d.reminders = d.reminders.filter((x) => x.id !== r.id); });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? reminderName(editing, data.habits.find((h) => h.id === editing.habitId)?.name) : 'Nuevo recordatorio'}
      footer={<div className="row gap-s">
        {editing && !fixed && <button className="btn btn-ghost icon-only" aria-label="Eliminar" onClick={remove}><IconTrash /></button>}
        <button className="btn btn-primary grow" disabled={!valid} onClick={save}>Guardar</button>
      </div>}>
      <div className="stack">
        {!editing && (
          <Field label="Tipo">
            <Seg value={r.kind === 'habit' ? 'habit' : 'custom'} onChange={(k) => set({ kind: k as ReminderKind })} size="s"
              options={[{ value: 'custom', label: 'Texto libre' }, { value: 'habit', label: 'De un hábito' }]} />
          </Field>
        )}
        <p className="muted small">{KIND_HINT[r.kind]}</p>
        {r.kind === 'custom' && (
          <>
            <Field label="Título" htmlFor="r-title"><input id="r-title" className="input" value={r.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="Ej. Tomar creatina" /></Field>
            <Field label="Mensaje (opcional)" htmlFor="r-body"><input id="r-body" className="input" value={r.body ?? ''} onChange={(e) => set({ body: e.target.value })} placeholder="Ej. 5 g con agua" /></Field>
          </>
        )}
        {r.kind === 'habit' && (
          <Field label="Hábito">
            <div className="chips">
              {data.habits.filter((h) => !h.archived && h.link !== 'workout').map((h) => (
                <button key={h.id} className={cx('chip', r.habitId === h.id && 'on')} onClick={() => set({ habitId: h.id, ...(h.time ? { time: h.time } : {}) })}>{h.name}</button>
              ))}
            </div>
          </Field>
        )}
        <div className="grid2">
          <Field label={r.kind === 'water' ? 'Desde' : 'Hora'} htmlFor="r-time"><input id="r-time" type="time" className="input" value={r.time} onChange={(e) => set({ time: e.target.value })} /></Field>
          {r.kind === 'water' && <Field label="Hasta" htmlFor="r-until"><input id="r-until" type="time" className="input" value={r.until ?? '20:00'} onChange={(e) => set({ until: e.target.value })} /></Field>}
        </div>
        {r.kind === 'water' && (
          <Field label="Cada">
            <Seg value={String(r.every ?? 120)} onChange={(v) => set({ every: Number(v) })} size="s"
              options={[{ value: '60', label: '1 h' }, { value: '90', label: '1.5 h' }, { value: '120', label: '2 h' }, { value: '180', label: '3 h' }]} />
          </Field>
        )}
        <Field label="Días">
          <div className="dow-pick">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button key={d} className={cx('dow-btn', days.includes(d) && 'on')} aria-pressed={days.includes(d)}
                onClick={() => { const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d]; if (next.length) set({ days: next }); }}>{DOW_LETTERS[d]}</button>
            ))}
          </div>
        </Field>
        <Toggle label="Activo" on={r.enabled} onChange={(b) => set({ enabled: b })} />
      </div>
    </Sheet>
  );
}
