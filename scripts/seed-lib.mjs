/* Carga el catálogo estático (assets/js/catalog.js) en Postgres y sube sus fotos.
   Lo usan dev/server.mjs (local) y scripts/migrate.mjs (Neon + R2 reales).
   Idempotente: los productos que ya existen (mismo id) no se tocan. */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

export async function readStaticCatalog(root) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const f of ['assets/js/catalog-config.js', 'assets/js/catalog.js']) {
    vm.runInContext(await fs.readFile(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.window.MENTAROSA_CATALOG;
}

/** Ejecuta db/schema.sql sentencia por sentencia (el driver HTTP de Neon no acepta varias juntas). */
export async function applySchema(root, db) {
  const stmts = (await fs.readFile(path.join(root, 'db/schema.sql'), 'utf8'))
    .split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')
    .split(';').map((s) => s.trim()).filter(Boolean);
  for (const s of stmts) await db.query(s, []);
}

/**
 * @param {{root:string, db:{query:Function}, prefix:string, putImage:(key:string, buf:Buffer, type:string)=>Promise<void>, log?:Function}} o
 * @returns número de productos nuevos
 */
export async function seed({ root, db, prefix, putImage, log = () => {} }) {
  await applySchema(root, db);
  const catalog = await readStaticCatalog(root);
  let created = 0;
  for (const p of catalog) {
    const rows = await db.query(
      `insert into products (id, slug, name, category, description, details, material, price, old_price, currency,
         sizes, colors, inventory, in_stock, tag, show_home, published, keywords, bg, fit, added_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true,$17,$18,$19,$20)
       on conflict (id) do nothing returning id`,
      [p.id, p.slug, p.name, p.cat, p.desc || '', p.details || [], p.material || null, p.price.amount, p.old ?? null,
       p.price.cur, p.sizes || [], p.colors || [], JSON.stringify(p.inventory || {}), p.stock !== false, p.tag || null,
       !!p.home, (p.keywords || '').trim().replace(/\s+/g, ' '), p.bg || null, p.fit || 'photo', p.added]);
    if (!rows.length) { log(`= ${p.id} ya existe, se omite`); continue; }
    created++;
    const images = p.images || [p.img, p.img2].filter(Boolean);
    for (let i = 0; i < images.length; i++) {
      const rel = images[i].replace(/^\//, '');
      const buf = await fs.readFile(path.join(root, rel));
      const name = path.basename(rel);
      const key = `${prefix}/products/${p.id}/${name}`;
      await putImage(key, buf, name.endsWith('.png') ? 'image/png' : 'image/jpeg');
      await db.query(
        'insert into product_images (product_id, r2_key, position, bytes) values ($1,$2,$3,$4) on conflict (r2_key) do nothing',
        [p.id, key, i, buf.length]);
    }
    log(`+ ${p.id} ${p.name} (${images.length} foto${images.length === 1 ? '' : 's'})`);
  }
  return created;
}
