/* Servidor local SIN cuentas: ejecuta el mismo Worker (worker/index.js) en Node,
   con Postgres embebido (PGlite) y un R2 simulado en carpetas.
   Sirve para trabajar el dashboard y la tienda sin Neon ni Cloudflare.

     npm run dev:local            → http://localhost:8787
     npm run dev:local -- --seed  → además carga los 27 productos del catálogo estático

   Los datos quedan en .dev-data/ (ignorado por git). Bórralo para empezar de cero. */
import http from 'node:http';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import worker, { publish } from '../worker/index.js';
import { seed } from '../scripts/seed-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, '.dev-data');
const PORT = Number(process.env.PORT || 8787);

/* ---------- Postgres embebido con la interfaz de worker/db.js ---------- */
await fs.mkdir(DATA, { recursive: true });
const pg = new PGlite(path.join(DATA, 'pg'));
await pg.exec(await fs.readFile(path.join(ROOT, 'db/schema.sql'), 'utf8'));
const db = {
  query: async (text, params = []) => (await pg.query(text, params)).rows,
  tx: (list) => pg.transaction(async (t) => { const out = []; for (const [q, p] of list) out.push((await t.query(q, p || [])).rows); return out; })
};

/* ---------- R2 simulado en .dev-data/r2 ---------- */
const R2DIR = path.join(DATA, 'r2');
const safe = (key) => { const p = path.resolve(R2DIR, key); if (!p.startsWith(R2DIR)) throw new Error('key'); return p; };
const MEDIA = {
  async put(key, value, opts = {}) {
    const file = safe(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const buf = typeof value === 'string' ? Buffer.from(value) : Buffer.from(value instanceof ArrayBuffer ? new Uint8Array(value) : value);
    await fs.writeFile(file, buf);
    await fs.writeFile(file + '.meta.json', JSON.stringify(opts.httpMetadata || {}));
  },
  async get(key) {
    const file = safe(key);
    let buf; try { buf = await fs.readFile(file); } catch { return null; }
    const meta = JSON.parse(await fs.readFile(file + '.meta.json', 'utf8').catch(() => '{}'));
    return {
      body: buf, httpEtag: `"${buf.length}-${(await fs.stat(file)).mtimeMs | 0}"`,
      writeHttpMetadata: (h) => { if (meta.contentType) h.set('Content-Type', meta.contentType); },
      json: async () => JSON.parse(buf.toString('utf8')), text: async () => buf.toString('utf8')
    };
  },
  async delete(keys) {
    for (const k of [].concat(keys)) { await fs.rm(safe(k), { force: true }); await fs.rm(safe(k) + '.meta.json', { force: true }); }
  }
};

/* ---------- Assets estáticos (imita html_handling: auto-trailing-slash) ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
const ASSETS = {
  async fetch(req) {
    const url = new URL(req.url);
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('.html')) {
      const clean = p === '/index.html' ? '/' : p.endsWith('/index.html') ? p.slice(0, -10) : p.slice(0, -5);
      return new Response(null, { status: 307, headers: { Location: clean + url.search } });
    }
    const candidates = p.endsWith('/') ? [p + 'index.html'] : [p, p + '.html'];
    if (!p.endsWith('/') && fss.existsSync(path.join(ROOT, p, 'index.html'))) {
      return new Response(null, { status: 307, headers: { Location: p + '/' + url.search } });
    }
    for (const c of candidates) {
      const file = path.join(ROOT, c);
      // misma lista permitida que scripts/build.mjs: páginas .html de la raíz, assets/ y admin/
      if (!file.startsWith(ROOT) || !/^\/([^/]+\.html|(assets|admin)\/.+)$/.test(c)) continue;
      try {
        const st = await fs.stat(file);
        if (st.isFile()) return new Response(await fs.readFile(file), { headers: { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' } });
      } catch {}
    }
    return new Response('404', { status: 404 });
  }
};

const env = {
  __db: db, MEDIA, ASSETS,
  MEDIA_PREFIX: 'mentarosa',
  CATEGORIES: 'Tops,Pantalones,Chaquetas,Zapatos',
  SUPERADMIN_EMAILS: 'dev@localhost.test',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || ''
};

// usuario de prueba SOLO para este servidor local (Postgres embebido en .dev-data/)
const DEV_USER = { email: 'dev@localhost.test', password: 'mentarosa-dev-2026' };
if (!(await db.query('select 1 from admin_users limit 1')).length) {
  const { hashPassword } = await import('../worker/auth.js');
  await db.query("insert into admin_users (email, name, role, password_hash, accepted_at) values ($1, 'Dev local', 'owner', $2, now())", [DEV_USER.email, await hashPassword(DEV_USER.password)]);
}

if (process.argv.includes('--seed')) {
  const n = await seed({ root: ROOT, db, putImage: (key, buf, type) => MEDIA.put(key, buf, { httpMetadata: { contentType: type } }), prefix: env.MEDIA_PREFIX, log: console.log });
  console.log(`Semilla lista: ${n} productos nuevos · catálogo publicado con ${await publish(env)}`);
}

http.createServer(async (req, res) => {
  try {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
    const pending = [];
    const response = await worker.fetch(request, env, { waitUntil: (p) => pending.push(p) });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    console.error(e); res.writeHead(500); res.end('error');
  }
}).listen(PORT, () => console.log(`Tienda: http://localhost:${PORT}   Dashboard: http://localhost:${PORT}/admin/  (entra con ${DEV_USER.email} / ${DEV_USER.password})`));
