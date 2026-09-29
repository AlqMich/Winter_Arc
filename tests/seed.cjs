// Datos de ejemplo SOLO para probar gráficas (no se incluyen en la app).
const { chromium, devices } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(process.argv[2]);
  await p.evaluate(() => {
    const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const day = n => { const d = new Date(); d.setDate(d.getDate()-n); return iso(d); };
    const logs = {}, workouts = []; let w = 81.2;
    for (let n = 30; n >= 1; n--) {
      const d = day(n); const r = (n*7919)%10;
      if (r === 3) continue;
      w -= 0.08 + ((n*31)%5-2)*0.12;
      logs[d] = { date: d, habits: { alimentacion: r>2?1:undefined, lectura: r>4?20:10, reflexion: r%2?1:undefined, orden: r>1?1:undefined, finanzas: r>5?1:undefined },
        metrics: { sleep: 6.5 + (r%4)*0.5, water: 1.5 + (r%3)*0.5, steps: 6000 + r*500, distraction: 40 + r*8, mainGoal: r>2?1:undefined, deepWork: r>3?2:1, weight: n%2?Math.round(w*10)/10:undefined, waist: n%7===0? 92 - (30-n)*0.1 : undefined } };
      if (n%2===0) workouts.push({ id: 'w'+n, date: d, type: n%4===0?'gym':'running', duration: 30+r, distance: n%4===0?undefined:4+(30-n)*0.08, rpe: 6, createdAt: n });
    }
    const data = { version:1, settings:{ startDate: day(30), durationDays:90, dayThreshold:70, theme:'system', reminderTime:'21:00', monthlySavingsTarget:10000, currency:'MXN', weightUnit:'kg', onboarded:true },
      categories:[{id:'cuerpo',name:'Cuerpo'},{id:'mente',name:'Mente'},{id:'trabajo',name:'Trabajo'},{id:'vida',name:'Vida'}], logs, workouts,
      goals:[{id:'g1',name:'Peso',category:'fisico',unit:'kg',start:81.5,current:81.5,target:76,source:'weight',createdAt:0},{id:'g2',name:'Cotizaciones',category:'profesional',unit:'cotizaciones',start:0,current:4,target:10,source:'manual',createdAt:0}],
      money:[], notes:[], reviews:{} };
    localStorage.setItem('winter-arc:data:v1', JSON.stringify(data));
  });
  // hábitos por defecto: dejar que normalize los ponga si faltan
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('winter-arc:data:v1')); delete d.habits; localStorage.setItem('winter-arc:data:v1', JSON.stringify(d)); });
  await p.reload();
  await p.locator('.tabbar').getByRole('button', { name: 'Progreso' }).click();
  await p.screenshot({ path: 'shots/20-seed-progreso.png', fullPage: true });
  await p.getByRole('tab', { name: 'Cuerpo' }).click();
  await p.screenshot({ path: 'shots/21-seed-cuerpo.png', fullPage: true });
  await p.getByRole('tab', { name: 'Calendario' }).click();
  await p.screenshot({ path: 'shots/22-seed-cal.png', fullPage: true });
  console.log(errs.length ? errs : 'seed ok'); await b.close();
})();
