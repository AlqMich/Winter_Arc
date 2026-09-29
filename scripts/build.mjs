// Build sin dependencias pesadas: esbuild (bundle + minify) y plantilla HTML.
//   node scripts/build.mjs            → dist/ (PWA desplegable: index.html, app.js, app.css, sw.js, manifest, íconos)
//   node scripts/build.mjs --single   → dist-single/winter-arc.html (un solo archivo, sin service worker)
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const single = process.argv.includes('--single');
const FONTS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600;700&display=swap';

const result = await build({
  entryPoints: [join(root, 'src/main.tsx')],
  bundle: true, minify: true, write: false, format: 'iife', target: ['safari15', 'chrome100'],
  jsx: 'automatic', outdir: join(root, 'out'), loader: { '.css': 'css' },
  define: { __PWA__: single ? 'false' : 'true', 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none', logLevel: 'warning',
});
const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text;
const css = (await build({ entryPoints: [join(root, 'src/styles.css')], bundle: true, minify: true, write: false, loader: { '.css': 'css' } })).outputFiles[0].text;

if (single) {
  const out = join(root, 'dist-single');
  mkdirSync(out, { recursive: true });
  // Sin <html>/<head>/<body>: el host de artefactos agrega el esqueleto.
  const html = `<title>Winter Arc</title>
<meta name="theme-color" content="#f1f3f5">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Winter Arc">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${css}</style>
<div id="root"></div>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script>
`;
  writeFileSync(join(out, 'winter-arc.html'), html);
  console.log(`single: ${(html.length / 1024).toFixed(0)} KB`);
} else {
  const out = join(root, 'dist');
  if (existsSync(out)) rmSync(out, { recursive: true });
  mkdirSync(out, { recursive: true });
  const hash = createHash('sha1').update(js + css).digest('hex').slice(0, 8);
  writeFileSync(join(out, `app.${hash}.js`), js);
  writeFileSync(join(out, `app.${hash}.css`), css);
  for (const f of readdirSync(join(root, 'public'))) copyFileSync(join(root, 'public', f), join(out, f));
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Winter Arc</title>
<meta name="description" content="Centro de control personal para tu reto de 90 días.">
<meta name="theme-color" content="#f1f3f5">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Winter Arc">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="app.${hash}.css">
</head>
<body>
<div id="root"></div>
<noscript>Winter Arc necesita JavaScript.</noscript>
<script src="app.${hash}.js"></script>
</body>
</html>
`;
  writeFileSync(join(out, 'index.html'), html);
  const sw = readFileSync(join(root, 'src/sw.js'), 'utf8')
    .replace('__VERSION__', hash)
    .replace('__ASSETS__', JSON.stringify(['./', './index.html', `./app.${hash}.js`, `./app.${hash}.css`, './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png']));
  writeFileSync(join(out, 'sw.js'), sw);
  console.log(`dist: app.${hash}.js ${(js.length / 1024).toFixed(0)} KB, css ${(css.length / 1024).toFixed(0)} KB`);
}
