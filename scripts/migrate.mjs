/* Migración inicial a producción: crea las tablas en Neon, carga los productos del
   catálogo estático, sube sus fotos a R2 y publica el catálogo.

   Requisitos:
   - DATABASE_URL de Neon (rol dueño, cadena directa) en .dev.vars o como variable de entorno
   - Sesión de Wrangler iniciada (npx wrangler login) y el bucket de wrangler.jsonc creado

     npm run migrate

   Es idempotente: si se corta, se puede volver a correr; los productos ya cargados se omiten. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { seed } from './seed-lib.mjs';
import { publish } from '../worker/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readDevVars() {
  try {
    const txt = await fs.readFile(path.join(ROOT, '.dev.vars'), 'utf8');
    return Object.fromEntries(txt.split(/\r?\n/).map((l) => /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"(.*)"$/, '$1')]));
  } catch { return {}; }
}

const vars = await readDevVars();
const DATABASE_URL = process.env.DATABASE_URL || vars.DATABASE_URL;
if (!DATABASE_URL || DATABASE_URL.includes('usuario:clave')) {
  console.error('Falta DATABASE_URL (pon la cadena de Neon en .dev.vars o como variable de entorno).');
  process.exit(1);
}
const cfg = await fs.readFile(path.join(ROOT, 'wrangler.jsonc'), 'utf8');
const BUCKET = /"bucket_name"\s*:\s*"([^"]+)"/.exec(cfg)?.[1];
const PREFIX = /"MEDIA_PREFIX"\s*:\s*"([^"]+)"/.exec(cfg)?.[1];
const CATEGORIES = /"CATEGORIES"\s*:\s*"([^"]+)"/.exec(cfg)?.[1];
if (!BUCKET || !PREFIX) { console.error('No encontré bucket_name o MEDIA_PREFIX en wrangler.jsonc'); process.exit(1); }

const sql = neon(DATABASE_URL);
const db = {
  query: (t, p = []) => sql.query(t, p),
  tx: (list) => sql.transaction(list.map(([t, p]) => sql.query(t, p || [])))
};

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'r2-'));
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
async function r2put(key, buf, type) {
  const file = path.join(tmp, 'obj');
  await fs.writeFile(file, buf);
  const args = ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`, '--file', file, '--content-type', type, process.env.R2_LOCAL ? '--local' : '--remote'];
  if (type.startsWith('image/')) args.push('--cache-control', 'public, max-age=31536000, immutable');
  // en Windows npx es un .cmd y necesita shell: hay que citar los argumentos con espacios
  const win = process.platform === 'win32';
  const r = spawnSync(npx, win ? args.map((a) => (/[\s,]/.test(a) ? `"${a}"` : a)) : args, { cwd: ROOT, encoding: 'utf8', shell: win });
  if (r.status !== 0) throw new Error(`Falló la subida de ${key}:\n${r.stderr || r.stdout}`);
}

console.log(`Neon: ${new URL(DATABASE_URL).host}\nR2: ${BUCKET}/${PREFIX}/\n`);
const created = await seed({ root: ROOT, db, prefix: PREFIX, putImage: r2put, log: console.log });

const env = {
  __db: db, MEDIA_PREFIX: PREFIX, CATEGORIES,
  MEDIA: { put: (key, body, opts) => r2put(key, Buffer.from(body), opts?.httpMetadata?.contentType || 'application/json') }
};
const published = await publish(env);
await fs.rm(tmp, { recursive: true, force: true });
console.log(`\nListo: ${created} productos nuevos · catálogo publicado con ${published} productos.`);
