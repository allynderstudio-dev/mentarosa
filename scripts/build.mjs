/* Copia a dist/ SOLO los archivos públicos (lista permitida). Wrangler publica dist/.
   Así nunca se sube por error .dev.vars, node_modules, el código del Worker, etc.
   Se ejecuta solo antes de `wrangler deploy` y `wrangler dev` (campo "build" de wrangler.jsonc). */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
export const PUBLIC_DIRS = ['assets', 'admin'];

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });
let n = 0;
for (const f of await fs.readdir(ROOT)) {
  if (f.endsWith('.html')) { await fs.copyFile(path.join(ROOT, f), path.join(OUT, f)); n++; }
}
for (const d of PUBLIC_DIRS) {
  await fs.cp(path.join(ROOT, d), path.join(OUT, d), { recursive: true, filter: (src) => !/(^|[\/])\.gitkeep$/.test(src) });
}
const count = async (dir) => (await fs.readdir(dir, { recursive: true, withFileTypes: true })).filter((e) => e.isFile()).length;
console.log(`dist/ listo: ${await count(OUT)} archivos públicos`);
