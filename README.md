# Mentarosa Boutique · sitio web

Sitio de Mentarosa Boutique (San Cristóbal, Táchira) en HTML, CSS y JavaScript, sin frameworks. Los productos se administran desde un dashboard propio (/admin).

## Páginas (URLs limpias, sin .html)
- `/` → `index.html` — homepage
- `/shop` → `shop.html` — tienda con filtros (estado en la URL)
- `/products/<slug>` → `product.html` — plantilla única de ficha
- `/wishlist` → `wishlist.html` — favoritos
- `/cart` → `cart.html` — carrito y pedido por WhatsApp

## Datos y configuración
- **Productos**: se editan en el dashboard `/admin` (Postgres en Neon + fotos en R2). Ver [DASHBOARD.md](DASHBOARD.md).
- `assets/js/catalog-config.js` — colores, cuidados y categorías (fijos, los comparten tienda y dashboard).
- `assets/js/catalog.js` — respaldo estático del catálogo. En producción el Worker sirve en esa ruta el catálogo publicado desde el dashboard.
- `assets/js/order.js` — número oficial de WhatsApp para pedidos
- Carrito y favoritos se guardan en el navegador (`localStorage`), sin backend ni pagos.

## Fotos
- Productos: se suben desde el dashboard y quedan en R2 (`/media/products/<id>/…`). `assets/productos/` conserva las originales para el respaldo estático y la portada.
- Categorías: `assets/categorias/<categoría>.jpg` (falta `tops.jpg`).
- Pendientes: las imágenes que faltan muestran un marco con la ruta esperada (`assets/categorias/tops.jpg` y `assets/campana/`).

## Probar en local
```bash
npm install
npm run dev:local:seed
```
Tienda en http://localhost:8787 y dashboard en http://localhost:8787/admin/ (sin cuentas: Postgres embebido y R2 simulado).

Solo la tienda, sin dashboard: `python3 serve.py` → http://localhost:8080 (usa el catálogo estático).

## Publicar
Cloudflare Workers (`npm run deploy`). Pasos de la primera puesta en producción y de cómo replicarlo en otro cliente en [DASHBOARD.md](DASHBOARD.md).
