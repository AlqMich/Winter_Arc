import React, { useState } from 'react';
import { useStore } from '../store';
import { useNav } from '../nav';
import type { MoneyEntry, MoneyType } from '../lib/types';
import { fmtMonth, fmtShort, monthKey, today } from '../lib/dates';
import { monthMoney } from '../lib/score';
import { uid } from '../lib/defaults';
import { Bar, Field, NumInput, Seg, Sheet, useUi, fmtMoney, fmtPct, cx, Empty } from '../ui/kit';
import { IconLeft, IconRight, IconPlus, IconTrash } from '../ui/icons';

const TYPES: { value: MoneyType; label: string }[] = [
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'gasto', label: 'Gasto' },
  { value: 'ahorro', label: 'Ahorro' },
  { value: 'inversion', label: 'Inversión' },
];

function shiftMonth(key: string, n: number) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Finance() {
  const { data, update } = useStore();
  const { go } = useNav();
  const { toast, confirm } = useUi();
  const [month, setMonth] = useState(monthKey(today()));
  const [open, setOpen] = useState(false);
  const [e, setE] = useState<MoneyEntry>({ id: '', date: today(), type: 'gasto', amount: 0 });
  const [isEdit, setIsEdit] = useState(false);
  const cur = data.settings.currency;
  const mm = monthMoney(data, month);
  const target = data.settings.monthlySavingsTarget;
  const saved = mm.ahorro + mm.inversion;
  const list = data.money.filter((x) => monthKey(x.date) === month).sort((a, b) => (a.date < b.date ? 1 : -1));
  const isCurrent = month === monthKey(today());

  const openNew = (type: MoneyType = 'gasto') => { setIsEdit(false); setE({ id: uid(), date: today(), type, amount: 0 }); setOpen(true); };
  const save = () => {
    if (!(e.amount > 0)) return;
    update((d) => {
      const i = d.money.findIndex((x) => x.id === e.id);
      if (i >= 0) d.money[i] = e; else d.money.push(e);
    });
    toast(`${TYPES.find((t) => t.value === e.type)?.label} de ${fmtMoney(e.amount, cur)} guardado`);
    setOpen(false);
  };
  const remove = async () => {
    if (await confirm({ title: 'Eliminar movimiento', confirm: 'Eliminar', danger: true })) {
      update((d) => { d.money = d.money.filter((x) => x.id !== e.id); });
      setOpen(false);
    }
  };

  return (
    <div className="screen">
      <header className="day-nav">
        <button className="icon-btn" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(month, -1))}><IconLeft /></button>
        <div className="day-nav-title static"><span className="eyebrow">Finanzas</span><span className="cap">{fmtMonth(month)}</span></div>
        <button className="icon-btn" aria-label="Mes siguiente" disabled={isCurrent} onClick={() => setMonth(shiftMonth(month, 1))}><IconRight /></button>
      </header>

      <div className="money-grid">
        <div className="tile"><div className="tile-label">Ingreso</div><div className="tile-num money">{fmtMoney(mm.ingreso, cur)}</div></div>
        <div className="tile"><div className="tile-label">Gasto</div><div className="tile-num money">{fmtMoney(mm.gasto, cur)}</div></div>
        <div className="tile"><div className="tile-label">Ahorro + inversión</div><div className="tile-num money">{fmtMoney(saved, cur)}</div></div>
        <div className="tile"><div className="tile-label">% de ahorro</div><div className="tile-num money">{fmtPct(mm.savingsRate)}</div></div>
      </div>

      <div className="card pad stack-s">
        <div className="row between"><span className="label">Meta de ahorro mensual</span>
          <button className="link-btn" onClick={() => go('mas', 'ajustes')}>{target ? fmtMoney(target, cur) : 'Definir'}</button></div>
        {target > 0 && <><Bar value={saved / target} tone={saved >= target ? 'good' : 'accent'} /><div className="muted small">{saved >= target ? 'Meta del mes cumplida' : `Faltan ${fmtMoney(target - saved, cur)}`}</div></>}
        <div className="muted small">Balance del mes (ingreso − gasto): <b className={cx('num', mm.ingreso - mm.gasto >= 0 ? 'good-text' : 'bad-text')}>{fmtMoney(mm.ingreso - mm.gasto, cur)}</b></div>
      </div>

      <div className="quick-money">
        {TYPES.map((t) => <button key={t.value} className="btn btn-ghost" onClick={() => openNew(t.value)}><IconPlus size={16} /> {t.label}</button>)}
      </div>

      {list.length === 0 ? <Empty title="Sin movimientos este mes" body="Registra ingresos, gastos, ahorro e inversión. Los objetivos de ahorro se actualizan solos." /> : (
        <div className="card list">
          {list.map((x) => (
            <button key={x.id} className="row-item" onClick={() => { setIsEdit(true); setE({ ...x }); setOpen(true); }}>
              <span className="row-main"><span className="row-title">{x.concept || TYPES.find((t) => t.value === x.type)?.label}</span><span className="row-sub">{TYPES.find((t) => t.value === x.type)?.label} · {fmtShort(x.date)}</span></span>
              <span className={cx('num money-amt', x.type === 'gasto' ? 'bad-text' : x.type === 'ingreso' ? '' : 'good-text')}>{x.type === 'gasto' ? '−' : '+'}{fmtMoney(x.amount, cur)}</span>
            </button>
          ))}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}
        footer={<div className="row gap-s">
          {isEdit && <button className="btn btn-ghost icon-only" aria-label="Eliminar" onClick={remove}><IconTrash /></button>}
          <button className="btn btn-primary grow" disabled={!(e.amount > 0)} onClick={save}>Guardar</button>
        </div>}>
        <div className="stack">
          <Seg value={e.type} onChange={(t) => setE({ ...e, type: t })} options={TYPES} size="s" />
          <Field label={`Monto (${cur})`} htmlFor="f-amt"><NumInput id="f-amt" className="input-xl" value={e.amount || undefined} onChange={(v) => setE({ ...e, amount: v ?? 0 })} /></Field>
          <Field label="Concepto" htmlFor="f-concept"><input id="f-concept" className="input" value={e.concept ?? ''} onChange={(ev) => setE({ ...e, concept: ev.target.value })} placeholder="Opcional" /></Field>
          <Field label="Fecha" htmlFor="f-date"><input id="f-date" type="date" className="input" value={e.date} onChange={(ev) => ev.target.value && setE({ ...e, date: ev.target.value })} /></Field>
        </div>
      </Sheet>
    </div>
  );
}
