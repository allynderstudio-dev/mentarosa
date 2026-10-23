# Mentarosa Boutique · sitio web

Sitio de Mentarosa Boutique (San Cristóbal, Táchira) en HTML, CSS y JavaScript, sin frameworks ni build.

## Páginas
- `index.html` — homepage
- `shop.html` — tienda con filtros (estado en la URL)
- `product.html` — plantilla única de ficha: `/products/<slug>`
- `wishlist.html` — favoritos: `/wishlist`
- `cart.html` — carrito y pedido por WhatsApp: `/cart`

## Datos y configuración
- `assets/js/catalog.js` — catálogo de productos (13 tenis retro a 90.000 pesos, tallas 34–40)
- `assets/js/order.js` — número oficial de WhatsApp para pedidos
- Carrito y favoritos se guardan en el navegador (`localStorage`), sin backend ni pagos.

## Fotos
- Productos: `assets/productos/<slug>-1.jpg`, `-2.jpg`… (la primera es la principal).
- Pendientes: las imágenes que faltan muestran un marco con la ruta esperada, en `assets/categorias/` y `assets/campana/`.

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
