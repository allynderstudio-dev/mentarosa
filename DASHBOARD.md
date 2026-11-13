# Dashboard de productos · Cloudflare + Neon + R2

Plantilla de la agencia para tiendas estáticas con catálogo editable. Mentarosa es el primer cliente.

## Estado en producción (13-11-2026)

- Tienda: https://mentarosaboutique.com (y www) servida por el Worker `mentarosa`. Vercel ya no recibe tráfico.
- Dashboard: https://mentarosaboutique.com/admin/ · login propio (correo + contraseña o Google). Usuarios en la tabla `admin_users`; se administran en el dashboard → menú → Usuarios. Dueño inicial: `allynder.studio@gmail.com`.
- Google: proyecto de Google Cloud "Allynder Dashboards", cliente OAuth "Dashboards web" (uno para toda la agencia). Está en modo *Prueba*: solo entran con Google los correos agregados como "usuarios de prueba" en Google Auth Platform → Público. Para quitar ese límite hay que completar la marca (página de inicio y política de privacidad) y publicar la app.
- Neon: proyecto `mentarosa` (AWS US East 1), base `neondb`.
- R2: bucket `allynder-media`, carpeta `mentarosa/`.
- Para dar acceso a otra persona: dashboard → Usuarios → Dar acceso (con contraseña, o sin ella para que entre con Google). Si es con Google y la app sigue en modo Prueba, agrega también su correo como usuario de prueba en Google.
- Cloudflare Access ya no se usa (se borró la aplicación). La suscripción Zero Trust Free ($0) sigue activa y se puede cancelar en Billing.
- Volver a Vercel en caso de emergencia: quitar `routes` del Worker y crear en DNS los CNAME de `@` y `www` a `7618d2d3819d2187.vercel-dns-017.com` (sin proxy).

## Cómo funciona

```
Navegador ──► Cloudflare (Worker "mentarosa")
               ├─ páginas, CSS, JS ............ assets estáticos (dist/), no gastan el Worker
               ├─ /assets/js/catalog.js ....... catálogo publicado (R2) ─ respaldo: archivo estático
               ├─ /media/... .................. fotos desde R2 (caché de 1 año)
               ├─ /products/<slug> ............ plantilla product.html
               ├─ /admin/login, /api/auth/* ... login propio (contraseña o Google)
               └─ /admin, /api/admin/* ........ dashboard ─► Neon (Postgres) + R2
```

- **Neon** guarda los productos (`db/schema.sql`). Solo lo consulta el dashboard.
- **R2** (bucket de la agencia `allynder-media`) guarda las fotos en `mentarosa/products/<id>/…` y el catálogo publicado en `mentarosa/catalog.json`.
- Cada vez que se guarda algo en el dashboard, el Worker regenera `catalog.json`. La tienda lo lee de ahí, así que **las visitas nunca despiertan a Neon** y el consumo de la base queda en casi cero. Los cambios se ven en la tienda en ~1 minuto (caché).
- Las fotos se comprimen en el navegador antes de subir (WebP, máx. 1600 px, ~100–250 KB).

| Pieza | Costo |
|---|---|
| Worker + assets | Incluido en el plan Workers Paid que ya tiene la cuenta (lo pagó acicalao) |
| R2 | Gratis hasta 10 GB y sin costo por descarga |
| Neon | Plan gratis, como acicalao (se apaga solo cuando nadie usa el dashboard) |
| Login (contraseña y Google) | Gratis, dentro del mismo Worker |

## Trabajar en local (sin cuentas)

```bash
npm install
npm run dev:local:seed     # primera vez: carga los 27 productos de assets/js/catalog.js
npm run dev:local          # siguientes veces
```

Tienda en http://localhost:8787 y dashboard en http://localhost:8787/admin/. Usa Postgres embebido (PGlite) y un R2 simulado en `.dev-data/` (bórralo para empezar de cero). Ejecuta el mismo `worker/index.js` que producción.

## Puesta en producción (una sola vez)

1. **Neon**: crea el proyecto `mentarosa` (región AWS US East 1, como acicalao). En *Connect* copia la cadena **directa** (sin `-pooler`) y pégala en `.dev.vars` como `DATABASE_URL=...` (copia `.dev.vars.example`; ese archivo nunca se sube).
2. **Cloudflare**:
   ```bash
   npx wrangler login
   npx wrangler r2 bucket create allynder-media
   ```
3. **Migrar** tablas, productos, fotos y catálogo (se puede repetir sin duplicar):
   ```bash
   npm run migrate
   ```
4. **Secreto y despliegue**:
   ```bash
   npx wrangler secret put DATABASE_URL
   npm run deploy
   ```
   Queda en `https://mentarosa.<tu-subdominio>.workers.dev` para probar antes de mover el dominio.
5. **Primer usuario dueño** (entra con Google):
   ```bash
   npm run user -- add correo@dominio.com --owner
   ```
   Para que además tenga contraseña: `npm run user -- password correo@dominio.com`.
6. **Google**: en el cliente OAuth de la agencia (Google Cloud → Allynder Dashboards → Clientes → Dashboards web) agrega `https://<dominio>/api/auth/google/callback`. Guarda el secreto con `npx wrangler secret put GOOGLE_CLIENT_SECRET` y pon el Client ID en `GOOGLE_CLIENT_ID` de `wrangler.jsonc`.
7. **Mover el dominio desde Vercel**: en Cloudflare → DNS de `mentarosaboutique.com`, borra los registros que apuntan a Vercel (`64.29.17.1`, `216.198.79.1` y el `www`). Descomenta `routes` en `wrangler.jsonc` y corre `npm run deploy`. Cloudflare crea los registros y el certificado solo (minutos).
8. **Cerrar Vercel**: fusiona esta rama en `main` y desconecta el proyecto de Vercel (si no, seguirá construyendo en cada push). Para despliegue automático en cada push, conecta el repo en Workers → mentarosa → Settings → Builds (comando de despliegue: `npm run deploy`).

## Replicar en otro cliente

1. Copia `worker/`, `admin/`, `db/`, `scripts/`, `dev/`, `wrangler.jsonc`, `package.json` y `assets/js/catalog-config.js`.
2. En `wrangler.jsonc`: `name`, `MEDIA_PREFIX` (carpeta del cliente en el bucket), `CATEGORIES` y `routes`.
3. En `assets/js/catalog-config.js`: colores, cuidados y categorías del cliente.
4. En `admin/admin.css` (`:root`) y `admin/index.html`: color de acento, logo y nombre.
5. La tienda del cliente debe cargar `assets/js/catalog-config.js` y `assets/js/catalog.js` y leer `window.MENTAROSA_CATALOG` (o renombra la variable en `worker/index.js`).
6. Proyecto nuevo en Neon y repetir los pasos de producción.

## Archivos

| Ruta | Qué es |
|---|---|
| `worker/index.js` | Rutas, API del dashboard, validación, publicación del catálogo |
| `worker/auth.js` | Login: contraseñas, Google, sesiones, límite de intentos |
| `scripts/user.mjs` | Usuarios del dashboard desde la terminal |
| `worker/db.js` | Conexión a Neon por HTTP |
| `admin/` | Interfaz del dashboard (HTML/CSS/JS sin dependencias) |
| `db/schema.sql` | Tablas `products` y `product_images` |
| `scripts/build.mjs` | Copia a `dist/` solo los archivos públicos (lista permitida) |
| `scripts/migrate.mjs` | Migración inicial a Neon + R2 |
| `dev/server.mjs` | Servidor local sin cuentas |
