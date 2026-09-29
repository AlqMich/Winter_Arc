// Servidor local: sirve dist/ y las funciones de Netlify con un store en memoria.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { setStore } from '../netlify/lib/store.mjs';

const mem = new Map();
setStore({
  get: async (k) => (mem.has(k) ? structuredClone(mem.get(k)) : null),
  setJSON: async (k, v) => { mem.set(k, structuredClone(v)); },
  delete: async (k) => { mem.delete(k); },
  list: async ({ prefix }) => ({ blobs: [...mem.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }),
});
const api = (await import('../netlify/functions/push-api.mjs')).default;
const root = join(process.cwd(), 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__store') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(Object.fromEntries(mem))); }
  if (url.pathname.startsWith('/api/push/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await api(new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }));
    res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
  }
  const p = url.pathname === '/' ? '/index.html' : url.pathname;
  try { const b = await readFile(join(root, p)); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('not found'); }
}).listen(Number(process.env.PORT || 4174), () => console.log('dev server ready'));
