# Winter Arc

App web personal (PWA, mobile-first) para seguir un reto de 90 días: hábitos, score de consistencia, entrenamiento, medidas, objetivos, finanzas, notas, calendario y revisión semanal.

## Instalar en iPhone (versión PWA con modo sin conexión)
1. Sube la carpeta `dist/` a cualquier hosting estático con HTTPS. Lo más rápido: arrastra `dist/` a https://app.netlify.com/drop (gratis, 30 s). También sirve Vercel, Cloudflare Pages o GitHub Pages.
2. Abre la URL en **Safari** del iPhone → Compartir → **Agregar a pantalla de inicio**.
3. Se abre a pantalla completa, funciona sin conexión y guarda los datos en el teléfono.

> Los datos viven en el navegador del dispositivo. En iPhone, la app instalada tiene su propio almacenamiento (distinto de Safari). Haz un respaldo JSON semanal en Más → Datos y respaldo.

## Desarrollo
```
npm install
npm run build          # dist/ (PWA)
npm run build:single   # dist-single/winter-arc.html (un archivo, sin service worker)
npm test               # pruebas de lógica (score, rachas, fechas, objetivos, finanzas)
npm run preview & npm run test:e2e   # flujo completo en viewport de iPhone
```

## Arquitectura
- `src/lib/types.ts` — modelo de datos único (`AppData`), versionado.
- `src/lib/storage.ts` — adaptador de almacenamiento (hoy localStorage). Para migrar a Supabase/Firebase/API, implementa `StorageAdapter` y cambia `storage`.
- `src/lib/score.ts` — toda la lógica de negocio pura (score, consistencia, rachas, semana, objetivos, finanzas). Sin React: se prueba aparte.
- `src/screens/*` — Hoy, Semana, Progreso, Objetivos, Más (Entrenamientos, Finanzas, Notas, Hábitos, Ajustes, Datos).

## Reglas del score
- **Score del día** = puntos obtenidos / puntos posibles de los hábitos programados ese día. Metas numéricas dan crédito parcial.
- **Hábitos semanales** (Entrenar 4×/semana) suman el día que se hacen y no restan en días de descanso; se evalúan por semana.
- **Consistencia** (métrica principal) = días cumplidos (score ≥ umbral, 70 por defecto) / días transcurridos.
- **Racha**: un día flojo (con registro, bajo el umbral) la pausa; dos seguidos o un día sin registro la reinician. Hoy nunca rompe la racha.
