// Lógica pura de recordatorios: qué toca enviar y con qué texto. Sin I/O, se prueba aparte.

/** Fecha/hora de pared en una zona horaria. */
export function localParts(d, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz || 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(d).map((p) => [p.type, p.value]));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, min: Number(parts.hour) * 60 + Number(parts.minute), dow };
}

export const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fmtMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function dowOf(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}
function diffDays(a, b) {
  const p = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(b) - p(a)) / 86400000);
}

/** Minutos del día en que dispara un recordatorio. El de agua se repite cada `every` min hasta `until`. */
export function occurrences(rem) {
  const start = toMin(rem.time);
  if (rem.kind !== 'water') return [start];
  const end = toMin(rem.until || '20:00');
  const every = Math.max(30, Number(rem.every) || 120);
  const out = [];
  for (let m = start; m <= end && out.length < 24; m += every) out.push(m);
  return out;
}

/**
 * Recordatorios cuyo horario cae en la ventana (from, to]. Maneja el cruce de medianoche.
 * @returns {{rem, date, min, key}[]}
 */
export function dueReminders(record, fromUtc, toUtc) {
  const tz = record.tz;
  const a = localParts(fromUtc, tz);
  const b = localParts(toUtc, tz);
  const dates = a.date === b.date ? [b.date] : [a.date, b.date];
  const out = [];
  for (const rem of record.reminders || []) {
    if (!rem.enabled) continue;
    for (const date of dates) {
      const days = Array.isArray(rem.days) && rem.days.length ? rem.days : [0, 1, 2, 3, 4, 5, 6];
      if (!days.includes(dowOf(date))) continue;
      for (const min of occurrences(rem)) {
        const t = `${date}T${fmtMin(min)}`;
        const lo = `${a.date}T${fmtMin(a.min)}`;
        const hi = `${b.date}T${fmtMin(b.min)}`;
        if (t > lo && t <= hi) out.push({ rem, date, min, key: `${rem.id}@${t}` });
      }
    }
  }
  return out;
}

const fmtNum = (v) => (Math.round(v * 100) / 100).toLocaleString('es-MX');

/** Estado del día tal como lo mandó la app; si es de otro día, se considera todo pendiente. */
function statusFor(record, date) {
  const s = record.status;
  return s && s.date === date ? s : { date, closed: false, workoutDone: false, habits: {} };
}

/**
 * Texto de la notificación, o null si ya no hace falta (recordatorio inteligente).
 */
export function compose(record, rem, date) {
  const st = statusFor(record, date);
  const arc = record.arc || {};
  const day = arc.startDate ? diffDays(arc.startDate, date) + 1 : null;
  const inArc = day !== null && day >= 1 && day <= (arc.durationDays || 90);
  const dayLabel = inArc ? `Día ${day} de ${arc.durationDays || 90}` : 'Winter Arc';
  const base = { tag: rem.id, url: './' };

  switch (rem.kind) {
    case 'wake': {
      const plan = (record.plan && record.plan[dowOf(date)]) || [];
      return { ...base, title: `Buenos días · ${dayLabel}`, body: plan.length ? `Hoy toca: ${plan.slice(0, 5).join(', ')}${plan.length > 5 ? '…' : ''}` : 'Abre la app y revisa qué toca hoy.' };
    }
    case 'sleep': {
      const target = st.sleepTarget || record.sleepTarget;
      const pending = st.closed ? '' : ' Cierra el día antes de dormir.';
      return { ...base, title: 'Hora de dormir', body: `${target ? `Meta: ${fmtNum(target)} h de sueño.` : 'Desconéctate y a la cama.'}${pending}` };
    }
    case 'water': {
      const w = st.water || { value: 0, target: record.waterTarget || 0, unit: 'L' };
      if (w.target && w.value >= w.target) return null;
      const body = w.target ? `Llevas ${fmtNum(w.value || 0)} de ${fmtNum(w.target)} ${w.unit || 'L'}. Toma un vaso ahora.` : 'Toma un vaso de agua.';
      return { ...base, tag: 'water', title: 'Agua', body };
    }
    case 'workout': {
      if (st.workoutDone) return null;
      return { ...base, title: 'Hora de entrenar', body: rem.body || 'Tu entrenamiento de hoy te espera. Regístralo al terminar.' };
    }
    case 'close': {
      if (st.closed) return null;
      const pend = Object.values(st.habits || {}).filter((h) => h.scheduled !== false && !h.done).map((h) => h.name);
      const body = pend.length ? `Te falta: ${pend.slice(0, 4).join(', ')}${pend.length > 4 ? '…' : ''}. Toma 1 minuto para registrar.` : 'Toma 1 minuto para cerrar tu día.';
      return { ...base, title: 'Cierra tu día', body };
    }
    case 'habit': {
      const h = (st.habits || {})[rem.habitId];
      if (h && h.done) return null;
      const name = rem.title || h?.name || 'Hábito';
      const extra = h && h.target && h.value !== undefined ? ` Llevas ${fmtNum(h.value)} de ${fmtNum(h.target)} ${h.unit || ''}.` : '';
      return { ...base, title: name, body: (rem.body || `Recordatorio: ${name}.`) + extra };
    }
    case 'custom':
    default:
      return { ...base, title: rem.title || 'Recordatorio', body: rem.body || '' };
  }
}

/** Todo el cálculo de una corrida para una suscripción: payloads a enviar y llaves nuevas de "enviado". */
export function plan(record, fromUtc, toUtc) {
  const sent = new Set(record.sent || []);
  const out = [];
  for (const d of dueReminders(record, fromUtc, toUtc)) {
    if (sent.has(d.key)) continue;
    const payload = compose(record, d.rem, d.date);
    out.push({ key: d.key, payload });
  }
  return out;
}
