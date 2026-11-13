/* =====================================================================
   Worker de la tienda + dashboard (plantilla de la agencia)
   ---------------------------------------------------------------------
   Rutas que pasan por aquí (ver run_worker_first en wrangler.jsonc):
     /products/<slug>        → plantilla product.html
     /assets/js/catalog.js   → catálogo publicado (R2) o, si no hay, el respaldo estático
     /media/<ruta>           → fotos desde R2, con caché larga
     /admin, /api/admin/*    → dashboard (login propio: worker/auth.js)
     /api/auth/*             → login con contraseña o Google, logout
   Todo lo demás lo sirven los assets estáticos directamente, sin gastar el Worker.

   La tienda NUNCA consulta Neon: cada cambio del dashboard regenera
   <MEDIA_PREFIX>/catalog.json en R2 y la tienda lee ese archivo.
   ===================================================================== */
import { getDb } from './db.js';
import { getAdmin, authApi, hashPassword, passwordProblem, verifyPassword, normEmail, validEmail, isSuper, superName, createInvite } from './auth.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/avif': 'avif' };
const BG_RE = /^linear-gradient\(160deg,#[0-9a-fA-F]{6},#[0-9a-fA-F]{6}\)$/;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const fail = (status, error) => json({ error }, status);

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (msg) => { throw new HttpError(400, msg); };

const prefix = (env) => (env.MEDIA_PREFIX || 'site').replace(/[^a-z0-9-]/gi, '');
const categories = (env) => (env.CATEGORIES || '').split(',').map((s) => s.trim()).filter(Boolean);
export const slugify = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

/* ---------------------------------------------------------------------
   Validación de un producto que llega del dashboard
   --------------------------------------------------------------------- */
function str(v, max, field, required = false) {
  if (v == null || v === '') { if (required) bad(`Falta ${field}`); return null; }
  if (typeof v !== 'string') bad(`${field} debe ser texto`);
  v = v.trim();
  if (required && !v) bad(`Falta ${field}`);
  if (v.length > max) bad(`${field} supera ${max} caracteres`);
  return v || null;
}
function strList(v, maxItems, maxLen, field) {
  if (v == null) return [];
  if (!Array.isArray(v)) bad(`${field} debe ser una lista`);
  const out = [];
  for (const x of v) {
    const s = str(x, maxLen, field);
    if (s && !out.includes(s)) out.push(s);
  }
  if (out.length > maxItems) bad(`${field}: máximo ${maxItems}`);
  return out;
}
function money(v, field, required) {
  if (v == null || v === '') { if (required) bad(`Falta ${field}`); return null; }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1e10) bad(`${field} no es válido`);
  return Math.round(n * 100) / 100;
}

export function cleanProduct(b, env) {
  if (!b || typeof b !== 'object') bad('Cuerpo inválido');
  const name = str(b.name, 120, 'el nombre', true);
  const slug = slugify(b.slug || name);
  if (!slug) bad('El slug quedó vacío');
  const category = str(b.category, 40, 'la categoría', true);
  const cats = categories(env);
  if (cats.length && !cats.includes(category)) bad(`Categoría no válida: ${category}`);
  const currency = b.currency === 'USD' ? 'USD' : 'pesos';
  const colors = strList(b.colors, 12, 30, 'colores');
  if (colors.some((c) => !/^[a-z0-9-]+$/.test(c))) bad('Clave de color no válida');
  const inventory = {};
  if (b.inventory != null) {
    if (typeof b.inventory !== 'object' || Array.isArray(b.inventory)) bad('Inventario inválido');
    for (const [k, v] of Object.entries(b.inventory)) {
      if (!/^[^|]{1,30}\|[^|]{1,30}$/.test(k)) bad(`Clave de inventario inválida: ${k}`);
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 9999) bad(`Cantidad inválida en ${k}`);
      inventory[k] = n;
    }
  }
  const tag = b.tag === 'new' || b.tag === 'best' ? b.tag : null;
  const bg = typeof b.bg === 'string' && BG_RE.test(b.bg) ? b.bg : null;
  return {
    slug, name, category, currency, colors, inventory, tag, bg,
    description: str(b.description, 3000, 'la descripción') || '',
    details: strList(b.details, 20, 200, 'detalles'),
    material: str(b.material, 300, 'el material'),
    price: money(b.price, 'el precio', true),
    old_price: money(b.old_price, 'el precio anterior', false),
    sizes: strList(b.sizes, 40, 16, 'tallas'),
    in_stock: b.in_stock !== false,
    show_home: b.show_home === true,
    published: b.published !== false,
    keywords: str(b.keywords, 600, 'las palabras clave') || '',
    fit: b.fit === 'cutout' ? 'cutout' : 'photo'
  };
}

/* ---------------------------------------------------------------------
   Lectura de productos (dashboard y snapshot)
   --------------------------------------------------------------------- */
const PRODUCT_SQL = `
  select p.*, coalesce(
    (select json_agg(json_build_object('id', i.id, 'key', i.r2_key, 'position', i.position,
                                       'width', i.width, 'height', i.height, 'bytes', i.bytes)
                     order by i.position, i.created_at)
       from product_images i where i.product_id = p.id), '[]'::json) as images
  from products p`;

const mediaUrl = (env, key) => '/media/' + key.slice(prefix(env).length + 1);

function rowToAdmin(r, env) {
  const images = (typeof r.images === 'string' ? JSON.parse(r.images) : r.images) || [];
  return {
    id: r.id, slug: r.slug, name: r.name, category: r.category, description: r.description,
    details: r.details || [], material: r.material, price: Number(r.price),
    old_price: r.old_price == null ? null : Number(r.old_price), currency: r.currency,
    sizes: r.sizes || [], colors: r.colors || [], inventory: r.inventory || {}, in_stock: r.in_stock,
    tag: r.tag, show_home: r.show_home, published: r.published, keywords: r.keywords, bg: r.bg, fit: r.fit,
    added_at: new Date(r.added_at).toISOString(), updated_at: new Date(r.updated_at).toISOString(),
    images: images.map((i) => ({ ...i, url: mediaUrl(env, i.key) }))
  };
}

/* misma forma que usaban los objetos de assets/js/catalog.js */
function toStorefront(p) {
  const images = p.images.map((i) => i.url);
  const out = {
    id: p.id, slug: p.slug, name: p.name, cat: p.category, colors: p.colors,
    price: { amount: p.price, cur: p.currency }, usd: p.price, stock: p.in_stock, sizes: p.sizes,
    added: p.added_at, home: p.show_home, images, img: images[0], img2: images[1],
    fit: p.fit, desc: p.description, details: p.details, keywords: p.keywords
  };
  if (p.bg) out.bg = p.bg;
  if (p.tag) out.tag = p.tag;
  if (p.old_price != null) out.old = p.old_price;
  if (p.material) out.material = p.material;
  if (Object.keys(p.inventory).length) out.inventory = p.inventory;
  return out;
}

async function listProducts(env) {
  const rows = await getDb(env).query(PRODUCT_SQL + ' order by p.added_at desc, p.id');
  return rows.map((r) => rowToAdmin(r, env));
}
async function getProduct(env, id) {
  const rows = await getDb(env).query(PRODUCT_SQL + ' where p.id = $1', [id]);
  if (!rows.length) throw new HttpError(404, 'Producto no encontrado');
  return rowToAdmin(rows[0], env);
}

/** Regenera el catálogo público en R2. Se llama después de cada cambio. */
export async function publish(env) {
  const all = await listProducts(env);
  const items = all.filter((p) => p.published).map(toStorefront);
  const body = JSON.stringify({ published_at: new Date().toISOString(), products: items });
  await env.MEDIA.put(`${prefix(env)}/catalog.json`, body, { httpMetadata: { contentType: 'application/json' } });
  return items.length;
}

/* ---------------------------------------------------------------------
   API del dashboard
   --------------------------------------------------------------------- */
async function readJson(request) {
  try { return await request.json(); } catch { bad('JSON inválido'); }
}

function sniffImage(bytes) {
  const b = new Uint8Array(bytes.slice(0, 16));
  const ascii = (o, n) => String.fromCharCode(...b.slice(o, o + n));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(1, 3) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (ascii(4, 4) === 'ftyp' && /avi[fs]/.test(ascii(8, 4))) return 'image/avif';
  return null;
}

async function adminApi(request, env, url, admin) {
  const db = getDb(env);
  const method = request.method;
  const parts = url.pathname.replace(/^\/api\/admin\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);

  if (method !== 'GET') {
    // Protección CSRF: un formulario de otro sitio no puede poner esta cabecera ni este Origin
    const origin = request.headers.get('Origin');
    if (request.headers.get('X-Admin') !== '1' || (origin && origin !== url.origin)) return fail(403, 'Origen no permitido');
  }

  // GET /api/admin/me
  if (parts[0] === 'me' && parts.length === 1 && method === 'GET') {
    return json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, has_password: admin.has_password,
      categories: categories(env), prefix: prefix(env) });
  }

  // PUT /api/admin/me/password  { current?, password }
  if (parts[0] === 'me' && parts[1] === 'password' && method === 'PUT') {
    const b = await readJson(request);
    const problem = passwordProblem(b.password); if (problem) bad(problem);
    if (admin.has_password) {
      const rows = await db.query('select password_hash from admin_users where id = $1', [admin.id]);
      if (typeof b.current !== 'string' || !(await verifyPassword(b.current, rows[0].password_hash))) bad('La contraseña actual no es correcta');
    }
    await db.query('update admin_users set password_hash = $2 where id = $1', [admin.id, await hashPassword(b.password)]);
    return json({ ok: true });
  }

  // Usuarios del dashboard: Agencia y Administradores. Solo por invitación.
  if (parts[0] === 'users') {
    if (admin.role !== 'superadmin' && admin.role !== 'owner') return fail(403, 'Solo un administrador puede gestionar usuarios');
    const uid = parts[1];
    const LIST_SQL = `
      select u.id, u.email, u.name, u.role, u.active, u.accepted_at, u.last_login_at, u.created_at,
             u.password_hash is not null as has_password, inv.email as invited_by_email,
             (select max(i.expires_at) from admin_invites i where i.user_id = u.id and i.used_at is null) as invite_expires_at
        from admin_users u left join admin_users inv on inv.id = u.invited_by`;
    const shape = (u) => { const sup = isSuper(env, u.email); return { ...u, id: String(u.id), is_super: sup, name: sup ? superName(env) : u.name, role: sup ? 'superadmin' : u.role }; };
    const inviteUrl = (token) => `${url.origin}/admin/invite#${token}`;
    async function target(id) {
      const rows = await db.query('select id, email, accepted_at from admin_users where id = $1', [id]);
      if (!rows.length) throw new HttpError(404, 'Usuario no encontrado');
      if (isSuper(env, rows[0].email)) throw new HttpError(403, 'La cuenta de la agencia tiene acceso permanente y no se puede modificar');
      return rows[0];
    }

    // GET /api/admin/users
    if (!uid && method === 'GET') {
      const rows = await db.query(LIST_SQL + ' order by u.created_at');
      return json({ users: rows.map(shape) });
    }
    // POST /api/admin/users { email, name?, role } → invitación
    if (!uid && method === 'POST') {
      const b = await readJson(request);
      const email = normEmail(b.email); if (!validEmail(email)) bad('Correo no válido');
      if (isSuper(env, email)) bad('Esa cuenta es de la agencia y ya tiene acceso permanente');
      const role = b.role === 'owner' ? 'owner' : 'editor';
      let rows;
      try {
        rows = await db.query('insert into admin_users (email, name, role, invited_by) values ($1, $2, $3, $4) returning id',
          [email, str(b.name, 120, 'el nombre'), role, admin.id]);
      } catch (e) { if (/unique|duplicate/i.test(String(e.message))) bad('Ese correo ya tiene acceso o una invitación pendiente'); throw e; }
      const token = await createInvite(db, rows[0].id);
      const user = (await db.query(LIST_SQL + ' where u.id = $1', [rows[0].id]))[0];
      return json({ user: shape(user), invite_url: inviteUrl(token) }, 201);
    }
    // POST /api/admin/users/:id/invite → enlace nuevo (invalida el anterior)
    if (uid && parts[2] === 'invite' && method === 'POST') {
      const t = await target(uid);
      if (t.accepted_at) bad('Esta persona ya aceptó su invitación');
      return json({ invite_url: inviteUrl(await createInvite(db, uid)) });
    }
    // PUT /api/admin/users/:id { role?, active? }
    if (uid && !parts[2] && method === 'PUT') {
      const b = await readJson(request);
      if (uid === admin.id) bad('No puedes cambiar tu propio rol ni desactivarte');
      await target(uid);
      const sets = [], vals = [uid];
      if (b.role === 'owner' || b.role === 'editor') { vals.push(b.role); sets.push(`role = $${vals.length}::text`); }
      if (typeof b.active === 'boolean') { vals.push(b.active); sets.push(`active = $${vals.length}::boolean`); }
      if (!sets.length) bad('Nada que cambiar');
      await db.query(`update admin_users set ${sets.join(', ')} where id = $1`, vals);
      if (b.active === false) await db.query('delete from admin_sessions where user_id = $1', [uid]);
      const user = (await db.query(LIST_SQL + ' where u.id = $1', [uid]))[0];
      return json({ user: shape(user) });
    }
    // DELETE /api/admin/users/:id
    if (uid && !parts[2] && method === 'DELETE') {
      if (uid === admin.id) bad('No puedes eliminarte a ti mismo');
      await target(uid);
      await db.query('delete from admin_users where id = $1', [uid]);
      return json({ ok: true });
    }
  }

  if (parts[0] === 'products') {
    const id = parts[1];

    // GET /api/admin/products · POST /api/admin/products
    if (!id) {
      if (method === 'GET') return json({ products: await listProducts(env) });
      if (method === 'POST') {
        const p = cleanProduct(await readJson(request), env);
        const newId = 'p-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
        try {
          await db.query(
            `insert into products (id, slug, name, category, description, details, material, price, old_price, currency,
               sizes, colors, inventory, in_stock, tag, show_home, published, keywords, bg, fit)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
            [newId, p.slug, p.name, p.category, p.description, p.details, p.material, p.price, p.old_price, p.currency,
             p.sizes, p.colors, JSON.stringify(p.inventory), p.in_stock, p.tag, p.show_home, p.published, p.keywords, p.bg, p.fit]);
        } catch (e) { if (/unique|duplicate/i.test(String(e.message))) bad(`Ya existe un producto con el slug "${p.slug}"`); throw e; }
        await publish(env);
        return json({ product: await getProduct(env, newId) }, 201);
      }
    }

    // PUT/DELETE/GET /api/admin/products/:id
    if (id && parts.length === 2) {
      if (method === 'GET') return json({ product: await getProduct(env, id) });
      if (method === 'PUT') {
        const p = cleanProduct(await readJson(request), env);
        let rows;
        try {
          rows = await db.query(
            `update products set slug=$2, name=$3, category=$4, description=$5, details=$6, material=$7, price=$8,
               old_price=$9, currency=$10, sizes=$11, colors=$12, inventory=$13, in_stock=$14, tag=$15, show_home=$16,
               published=$17, keywords=$18, bg=$19, fit=$20, updated_at=now()
             where id=$1 returning id`,
            [id, p.slug, p.name, p.category, p.description, p.details, p.material, p.price, p.old_price, p.currency,
             p.sizes, p.colors, JSON.stringify(p.inventory), p.in_stock, p.tag, p.show_home, p.published, p.keywords, p.bg, p.fit]);
        } catch (e) { if (/unique|duplicate/i.test(String(e.message))) bad(`Ya existe un producto con el slug "${p.slug}"`); throw e; }
        if (!rows.length) return fail(404, 'Producto no encontrado');
        await publish(env);
        return json({ product: await getProduct(env, id) });
      }
      if (method === 'DELETE') {
        const imgs = await db.query('select r2_key from product_images where product_id = $1', [id]);
        const rows = await db.query('delete from products where id = $1 returning id', [id]);
        if (!rows.length) return fail(404, 'Producto no encontrado');
        if (imgs.length) await env.MEDIA.delete(imgs.map((r) => r.r2_key));
        await publish(env);
        return json({ ok: true });
      }
    }

    // POST /api/admin/products/:id/images  (cuerpo = bytes de la imagen)
    if (id && parts[2] === 'images' && parts.length === 3 && method === 'POST') {
      const exists = await db.query('select id from products where id = $1', [id]);
      if (!exists.length) return fail(404, 'Producto no encontrado');
      const len = Number(request.headers.get('Content-Length') || 0);
      if (len > MAX_IMAGE_BYTES) bad('La imagen supera 8 MB');
      const bytes = await request.arrayBuffer();
      if (!bytes.byteLength) bad('Imagen vacía');
      if (bytes.byteLength > MAX_IMAGE_BYTES) bad('La imagen supera 8 MB');
      const type = sniffImage(bytes);
      if (!type) bad('Formato no permitido (usa JPG, PNG, WebP o AVIF)');
      const dim = (h) => { const n = parseInt(request.headers.get(h) || '', 10); return n > 0 && n < 20000 ? n : null; };
      const key = `${prefix(env)}/products/${slugify(id)}/${crypto.randomUUID()}.${IMAGE_TYPES[type]}`;
      await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
      try {
        await db.query(
          `insert into product_images (product_id, r2_key, position, width, height, bytes)
           values ($1, $2, (select coalesce(max(position) + 1, 0) from product_images where product_id = $1), $3, $4, $5)`,
          [id, key, dim('X-Width'), dim('X-Height'), bytes.byteLength]);
      } catch (e) { await env.MEDIA.delete(key); throw e; }   // no dejar huérfanos en R2
      await publish(env);
      return json({ product: await getProduct(env, id) }, 201);
    }

    // PUT /api/admin/products/:id/images  { order: [imageId, …] }
    if (id && parts[2] === 'images' && parts.length === 3 && method === 'PUT') {
      const { order } = await readJson(request);
      if (!Array.isArray(order) || order.some((x) => typeof x !== 'string')) bad('Orden inválido');
      const current = (await db.query('select id from product_images where product_id = $1', [id])).map((r) => String(r.id));
      if (order.length !== current.length || order.some((x) => !current.includes(x))) bad('El orden no coincide con las fotos del producto');
      await db.tx(order.map((imgId, i) => ['update product_images set position = $1 where id = $2 and product_id = $3', [i, imgId, id]]));
      await publish(env);
      return json({ product: await getProduct(env, id) });
    }

    // DELETE /api/admin/products/:id/images/:imageId
    if (id && parts[2] === 'images' && parts[3] && parts.length === 4 && method === 'DELETE') {
      const rows = await db.query('delete from product_images where id = $1 and product_id = $2 returning r2_key', [parts[3], id]);
      if (!rows.length) return fail(404, 'Foto no encontrada');
      await env.MEDIA.delete(rows[0].r2_key);
      // reenumerar para que la primera siga siendo la principal
      await db.query(
        `update product_images i set position = s.n - 1
           from (select id, row_number() over (order by position, created_at) as n from product_images where product_id = $1) s
          where i.id = s.id`, [id]);
      await publish(env);
      return json({ product: await getProduct(env, id) });
    }
  }

  // POST /api/admin/publish  (regenerar a mano, p. ej. tras tocar la base directamente)
  if (parts[0] === 'publish' && method === 'POST') return json({ ok: true, products: await publish(env) });

  return fail(404, 'Ruta no encontrada');
}

/* ---------------------------------------------------------------------
   Rutas públicas
   --------------------------------------------------------------------- */
async function cached(request, ctx, ttl, make) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { const hit = await cache.match(request); if (hit) return hit; }
  const res = await make();
  if (cache && res.ok && ttl > 0) ctx.waitUntil(cache.put(request, res.clone()));
  return res;
}

async function serveCatalog(request, env, ctx) {
  return cached(request, ctx, 60, async () => {
    const obj = await env.MEDIA.get(`${prefix(env)}/catalog.json`);
    if (!obj) return env.ASSETS.fetch(request);           // aún no hay publicación: respaldo estático
    const { products, published_at } = await obj.json();
    const js = `/* Catálogo publicado ${published_at} · generado por el dashboard, no editar */\n` +
      `window.MENTAROSA_CATALOG = ${JSON.stringify(products).replace(/</g, '\\u003c')};\n` +
      `window.MENTAROSA_DETAILS = window.MENTAROSA_DETAILS || {};\n`;
    return new Response(js, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
  });
}

async function serveMedia(request, env, ctx, url) {
  const rest = decodeURIComponent(url.pathname.slice('/media/'.length));
  if (!rest || rest.includes('..') || rest.startsWith('/') || rest === 'catalog.json') return new Response('No encontrado', { status: 404 });
  return cached(request, ctx, 31536000, async () => {
    const obj = await env.MEDIA.get(`${prefix(env)}/${rest}`);
    if (!obj) return new Response('No encontrado', { status: 404 });
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('ETag', obj.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(obj.body, { headers });
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/assets/js/catalog.js') return await serveCatalog(request, env, ctx);
      if (path.startsWith('/media/')) return await serveMedia(request, env, ctx, url);
      if (/^\/products\/[^/]+\/?$/.test(path)) {
        return env.ASSETS.fetch(new Request(new URL('/product', url), request));
      }
      if (path.startsWith('/api/auth/')) return await authApi(request, env, url);
      // pantalla de login: pública (no muestra datos)
      if (PUBLIC_ADMIN.includes(path)) return adminAsset(request, env);
      if (path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin')) {
        const admin = await getAdmin(request, env);
        if (!admin) {
          if (path.startsWith('/api/')) return fail(401, 'No autorizado');
          const next = path === '/admin' ? '/admin/' : path;
          return new Response(null, { status: 302, headers: { Location: '/admin/login?next=' + encodeURIComponent(next), 'Cache-Control': 'no-store' } });
        }
        if (path.startsWith('/api/admin')) return await adminApi(request, env, url, admin);
        return adminAsset(request, env);
      }
      return env.ASSETS.fetch(request);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      console.error(e);
      return fail(500, 'Error interno');
    }
  }
};

const PUBLIC_ADMIN = ['/admin/login', '/admin/login.html', '/admin/login.js', '/admin/invite', '/admin/invite.html', '/admin/invite.js', '/admin/admin.css'];
// páginas del dashboard: sin caché, sin iframes y fuera de buscadores
async function adminAsset(request, env) {
  const res = await env.ASSETS.fetch(request);
  const h = new Headers(res.headers);
  h.set('Cache-Control', 'no-store');
  h.set('X-Frame-Options', 'DENY');
  h.set('X-Robots-Tag', 'noindex');
  return new Response(res.body, { status: res.status, headers: h });
}
