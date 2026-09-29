import React, { useEffect, useMemo, useState } from 'react';
import type { Food, FoodUnit, ISODate, Meal, MealItem, MealQuality } from '../lib/types';
import { useStore } from '../store';
import { uid } from '../lib/defaults';
import {
  allFoods, buildItem, defaultUnit, itemsFromText, mealsOn, recentItems, searchFoods, suggestSlot, syncDayMetrics,
  totals, unitLabel, SLOTS, QUALITY_LABEL,
} from '../lib/foods';
import { Chips, Field, NumInput, Seg, Sheet, cx, fmtNum, useUi } from './kit';
import { IconPlus, IconTrash, IconSearch, IconClose } from './icons';

const QUALITY: { value: MealQuality; label: string }[] = [
  { value: 3, label: 'Bien' }, { value: 2, label: 'Regular' }, { value: 1, label: 'Mal' },
];

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function mealSummary(m: Meal): string {
  return m.items.map((i) => (i.unit === 'g' || i.unit === 'ml' ? `${i.name} ${fmtNum(i.qty, 0)} ${i.unit}` : `${fmtNum(i.qty, 2)} ${i.name.toLowerCase()}`)).join(', ');
}

export function MealSheet({ open, onClose, date, editing }: { open: boolean; onClose: () => void; date: ISODate; editing: Meal | null }) {
  const { data, update, now } = useStore();
  const { toast, confirm } = useUi();
  const foods = useMemo(() => allFoods(data), [data]);
  const [meal, setMeal] = useState<Meal>(() => blank());
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState<string | null>(null); // id del item desconocido a reemplazar
  const [newFood, setNewFood] = useState<{ name: string; forItem?: string } | null>(null);

  function blank(): Meal {
    const time = date === now ? nowHHMM() : '';
    return { id: uid(), date, slot: suggestSlot(time || '14:00', mealsOn(data, date)), time: time || undefined, items: [], createdAt: Date.now() };
  }
  useEffect(() => {
    if (open) { setMeal(editing ? structuredClone(editing) : blank()); setText(''); setQuery(''); setPicking(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, date]);

  const set = (p: Partial<Meal>) => setMeal((m) => ({ ...m, ...p }));
  const addItems = (items: MealItem[]) => setMeal((m) => ({ ...m, items: [...m.items, ...items] }));
  const replaceItem = (id: string, item: MealItem) => setMeal((m) => ({ ...m, items: m.items.map((i) => (i.id === id ? item : i)) }));
  const removeItem = (id: string) => setMeal((m) => ({ ...m, items: m.items.filter((i) => i.id !== id) }));
  const foodOf = (i: MealItem) => (i.foodId ? foods.find((f) => f.id === i.foodId) ?? null : null);

  const parse = () => {
    if (!text.trim()) return;
    const items = itemsFromText(text, foods, uid);
    if (!items.length) { toast('Escribe cantidad y alimento, p. ej. “2 huevos”.'); return; }
    addItems(items);
    setText('');
    const unknown = items.filter((i) => i.unknown).length;
    if (unknown) toast(`${unknown} alimento${unknown > 1 ? 's' : ''} sin identificar: elige uno o pon sus kcal.`);
  };

  const pickFood = (food: Food) => {
    if (picking) {
      const old = meal.items.find((i) => i.id === picking);
      const unit = old && (old.unit === 'g' || old.unit === 'ml' || food.units?.[old.unit]) ? old.unit : defaultUnit(food);
      replaceItem(picking, buildItem(picking, food, old && unit === old.unit ? old.qty : 1, unit));
      setPicking(null);
    } else {
      const unit = defaultUnit(food);
      addItems([buildItem(uid(), food, unit === 'g' ? 100 : 1, unit)]);
    }
    setQuery('');
  };

  const t = totals([meal]);
  const recents = useMemo(() => recentItems(data).filter((r) => !meal.items.some((i) => i.name === r.name)).slice(0, 6), [data, meal.items]);
  const results = query.trim() ? searchFoods(query, foods) : [];

  const save = () => {
    if (!meal.items.length && !meal.notes) { toast('Agrega al menos un alimento.'); return; }
    update((d) => {
      const i = d.meals.findIndex((m) => m.id === meal.id);
      if (i >= 0) d.meals[i] = meal; else d.meals.push(meal);
      syncDayMetrics(d, meal.date);
      if (editing && editing.date !== meal.date) syncDayMetrics(d, editing.date);
    });
    toast(`${meal.slot} guardado · ${t.kcal} kcal`);
    onClose();
  };
  const remove = async () => {
    if (!editing) return;
    if (await confirm({ title: `Eliminar ${editing.slot.toLowerCase()}`, confirm: 'Eliminar', danger: true })) {
      update((d) => { d.meals = d.meals.filter((m) => m.id !== editing.id); syncDayMetrics(d, editing.date); });
      onClose();
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? `Editar ${meal.slot.toLowerCase()}` : 'Registrar comida'}
      footer={<div className="stack-s">
        <div className="meal-totals num"><b>{t.kcal}</b> kcal<span>P {t.p} g</span><span>C {t.c} g</span><span>G {t.f} g</span></div>
        <div className="row gap-s">
          {editing && <button className="btn btn-ghost icon-only" aria-label="Eliminar" onClick={remove}><IconTrash /></button>}
          <button className="btn btn-primary grow" onClick={save}>Guardar</button>
        </div>
      </div>}>
      <div className="stack">
        <div className="row gap-s meal-head">
          <div className="grow scroll-x"><Chips value={meal.slot} options={SLOTS.map((s) => ({ value: s, label: s }))} onChange={(v) => set({ slot: v })} /></div>
          <input type="time" className="input time-in" aria-label="Hora" value={meal.time ?? ''} onChange={(e) => set({ time: e.target.value || undefined })} />
        </div>

        <Field label="¿Qué comiste?" htmlFor="meal-text" hint="Escríbelo como un mensaje. Separa con comas: “100 g de fruta, 1 manzana, 1 taza de yogurt”.">
          <div className="meal-input">
            <textarea id="meal-text" className="input textarea" rows={2} value={text} placeholder="Ej. 2 huevos, 1 tortilla, café"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); parse(); } }} />
            <button className="btn btn-primary" onClick={parse} disabled={!text.trim()}>Agregar</button>
          </div>
        </Field>

        {recents.length > 0 && !picking && (
          <div className="stack-s">
            <div className="label">Frecuentes</div>
            <div className="chips">
              {recents.map((r) => (
                <button key={r.id} className="chip" onClick={() => addItems([{ ...r, id: uid() }])}>
                  + {r.unit === 'g' || r.unit === 'ml' ? `${fmtNum(r.qty, 0)} ${r.unit}` : fmtNum(r.qty, 2)} {r.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="search">
          <IconSearch size={18} />
          <input className="input" placeholder={picking ? 'Busca el alimento correcto' : 'O busca un alimento'} value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label="Buscar alimento" autoFocus={!!picking} />
        </div>
        {picking && <div className="row between small"><span className="muted">Elige el alimento para “{meal.items.find((i) => i.id === picking)?.name}”</span><button className="link-btn" onClick={() => setPicking(null)}>Cancelar</button></div>}
        {query.trim() && (
          <div className="card list">
            {results.map((f) => (
              <button key={f.id} className="row-item compact" onClick={() => pickFood(f)}>
                <span className="row-main"><span className="row-title">{f.name}</span><span className="row-sub">{f.kcal} kcal · P {f.p} g por 100 g{f.custom ? ' · tuyo' : ''}</span></span>
                <IconPlus size={18} />
              </button>
            ))}
            <button className="row-item compact" onClick={() => setNewFood({ name: query.trim(), forItem: picking ?? undefined })}>
              <span className="row-main"><span className="row-title">Crear “{query.trim()}”</span><span className="row-sub">Guarda un alimento propio con sus calorías</span></span>
            </button>
          </div>
        )}

        {meal.items.length > 0 && (
          <div className="card list">
            {meal.items.map((i) => (
              <ItemRow key={i.id} item={i} food={foodOf(i)}
                onChange={(it) => replaceItem(i.id, it)}
                onRemove={() => removeItem(i.id)}
                onPick={() => { setPicking(i.id); setQuery(i.name); }}
                onCreate={() => setNewFood({ name: i.name, forItem: i.id })} />
            ))}
          </div>
        )}

        <Field label="¿Comiste bien?">
          <Chips value={meal.quality} options={QUALITY} onChange={(q) => set({ quality: meal.quality === q ? undefined : q })} />
        </Field>
        <Field label="Notas" htmlFor="meal-notes">
          <input id="meal-notes" className="input" value={meal.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} placeholder="Opcional" />
        </Field>
        <p className="muted small">Calorías y macros son aproximados, según tablas estándar de alimentos. Sirven para ver tendencias, no para exactitud al gramo.</p>
      </div>

      <FoodSheet open={!!newFood} initialName={newFood?.name ?? ''} onClose={() => setNewFood(null)}
        onCreated={(food) => {
          const target = newFood?.forItem;
          if (target) {
            const old = meal.items.find((i) => i.id === target);
            const unit: FoodUnit = old && (old.unit === 'g' || food.units?.[old.unit]) ? old.unit : defaultUnit(food);
            replaceItem(target, buildItem(target, food, old && unit === old.unit ? old.qty : 1, unit));
            setPicking(null);
          } else addItems([buildItem(uid(), food, defaultUnit(food) === 'g' ? 100 : 1, defaultUnit(food))]);
          setQuery('');
          setNewFood(null);
        }} />
    </Sheet>
  );
}

function ItemRow({ item, food, onChange, onRemove, onPick, onCreate }: {
  item: MealItem; food: Food | null; onChange: (i: MealItem) => void; onRemove: () => void; onPick: () => void; onCreate: () => void;
}) {
  const units: FoodUnit[] = Array.from(new Set<FoodUnit>(['g', ...(Object.keys(food?.units ?? {}) as FoodUnit[]), item.unit]));
  const setQty = (q: number | undefined) => {
    const qty = q ?? 0;
    if (item.unknown) onChange({ ...item, qty, kcal: item.qty ? Math.round((item.kcal / item.qty) * qty) : item.kcal });
    else onChange(buildItem(item.id, food, qty, item.unit));
  };
  const setUnit = (u: FoodUnit) => {
    if (item.unknown) return onChange({ ...item, unit: u });
    const qty = u === 'g' ? item.grams : item.unit === 'g' ? 1 : item.qty;
    onChange(buildItem(item.id, food, qty, u));
  };
  return (
    <div className={cx('meal-item', item.unknown && 'unknown')}>
      <div className="row between">
        <span className="meal-item-name">{item.name}{item.approx && <span className="muted small"> · medida aprox.</span>}</span>
        <button className="icon-btn sm" aria-label={`Quitar ${item.name}`} onClick={onRemove}><IconClose size={16} /></button>
      </div>
      <div className="meal-item-controls">
        <NumInput value={item.qty} onChange={setQty} className="qty-in" />
        <select className="input unit-in" value={item.unit} onChange={(e) => setUnit(e.target.value as FoodUnit)} aria-label="Medida">
          {units.map((u) => <option key={u} value={u}>{unitLabel(u, item.qty)}</option>)}
        </select>
        {item.unknown
          ? <NumInput value={item.kcal || undefined} onChange={(v) => onChange({ ...item, kcal: Math.round(v ?? 0) })} placeholder="kcal" className="kcal-in" />
          : <span className="meal-item-kcal num">{item.kcal}<small> kcal</small></span>}
      </div>
      {item.unknown ? (
        <div className="row gap-s small">
          <span className="warn-text">No lo encontré.</span>
          <button className="link-btn" onClick={onPick}>Elegir de la lista</button>
          <button className="link-btn" onClick={onCreate}>Crear alimento</button>
        </div>
      ) : (
        <div className="muted small num">{item.grams} g · P {fmtNum(item.p, 1)} · C {fmtNum(item.c, 1)} · G {fmtNum(item.f, 1)}</div>
      )}
    </div>
  );
}

/** Alimento propio: por 100 g o por pieza/porción. */
export function FoodSheet({ open, onClose, onCreated, initialName }: { open: boolean; onClose: () => void; onCreated: (f: Food) => void; initialName: string }) {
  const { update } = useStore();
  const { toast } = useUi();
  const [name, setName] = useState('');
  const [basis, setBasis] = useState<'100g' | 'pieza'>('pieza');
  const [grams, setGrams] = useState<number | undefined>();
  const [kcal, setKcal] = useState<number | undefined>();
  const [p, setP] = useState<number | undefined>();
  const [c, setC] = useState<number | undefined>();
  const [f, setF] = useState<number | undefined>();
  useEffect(() => { if (open) { setName(initialName.charAt(0).toUpperCase() + initialName.slice(1)); setBasis('pieza'); setGrams(undefined); setKcal(undefined); setP(undefined); setC(undefined); setF(undefined); } }, [open, initialName]);
  const valid = name.trim() && kcal !== undefined && (basis === '100g' || (grams ?? 0) > 0);

  const save = () => {
    if (!valid) return;
    const k = basis === '100g' ? 1 : 100 / (grams as number);
    const food: Food = {
      id: uid(), name: name.trim(), custom: true,
      kcal: Math.round((kcal ?? 0) * k), p: Math.round((p ?? 0) * k * 10) / 10, c: Math.round((c ?? 0) * k * 10) / 10, f: Math.round((f ?? 0) * k * 10) / 10,
      ...(basis === 'pieza' ? { units: { pieza: grams as number } } : {}),
    };
    update((d) => { d.foods.push(food); });
    toast(`${food.name} guardado en tus alimentos`);
    onCreated(food);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Nuevo alimento" footer={<button className="btn btn-primary btn-block" disabled={!valid} onClick={save}>Guardar alimento</button>}>
      <div className="stack">
        <Field label="Nombre" htmlFor="fd-name"><input id="fd-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Los valores son">
          <Seg value={basis} onChange={setBasis} size="s" options={[{ value: 'pieza', label: 'Por pieza / porción' }, { value: '100g', label: 'Por 100 g' }]} />
        </Field>
        {basis === 'pieza' && <Field label="¿Cuántos gramos pesa una pieza?" htmlFor="fd-g" hint="Viene en la etiqueta como “porción”."><NumInput id="fd-g" value={grams} onChange={setGrams} /></Field>}
        <div className="grid2">
          <Field label="Calorías (kcal)" htmlFor="fd-k"><NumInput id="fd-k" value={kcal} onChange={setKcal} /></Field>
          <Field label="Proteína (g)" htmlFor="fd-p"><NumInput id="fd-p" value={p} onChange={setP} /></Field>
          <Field label="Carbohidratos (g)" htmlFor="fd-c"><NumInput id="fd-c" value={c} onChange={setC} /></Field>
          <Field label="Grasa (g)" htmlFor="fd-f"><NumInput id="fd-f" value={f} onChange={setF} /></Field>
        </div>
        <p className="muted small">Los datos están en la tabla nutrimental del empaque. Solo las calorías son obligatorias.</p>
      </div>
    </Sheet>
  );
}

export { QUALITY_LABEL };
