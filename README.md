# Mentarosa Boutique · sitio web

Sitio de Mentarosa Boutique (San Cristóbal, Táchira) en HTML, CSS y JavaScript, sin frameworks ni build.

## Páginas (URLs limpias, sin .html)
- `/` → `index.html` — homepage
- `/shop` → `shop.html` — tienda con filtros (estado en la URL)
- `/products/<slug>` → `product.html` — plantilla única de ficha
- `/wishlist` → `wishlist.html` — favoritos
- `/cart` → `cart.html` — carrito y pedido por WhatsApp

## Datos y configuración
- `assets/js/catalog.js` — catálogo de productos, todo en pesos colombianos:
  - 6 chaquetas militares · 100.000 · talla única
  - 8 jeans · 111.000 · tallas 3 a 13
  - 13 tenis retro · 90.000 · tallas 34 a 40
- `assets/js/order.js` — número oficial de WhatsApp para pedidos
- Carrito y favoritos se guardan en el navegador (`localStorage`), sin backend ni pagos.

## Fotos
- Productos: `assets/productos/<slug>-1.jpg`, `-2.jpg`… (la primera es la principal).
- Categorías: `assets/categorias/<categoría>.jpg` (falta `tops.jpg`).
- Pendientes: las imágenes que faltan muestran un marco con la ruta esperada (`assets/categorias/tops.jpg` y `assets/campana/`).

## Probar en local
```bash
python3 serve.py
```
Abre http://localhost:8080 (imita las rutas de Vercel).

## Publicar
El repositorio está conectado a Vercel: cada `git push` a la rama `main` publica el sitio automáticamente.

```bash
git add -A && git commit -m "Describe el cambio" && git push
```

Alternativa manual (sin pasar por GitHub): `npx vercel --prod`
