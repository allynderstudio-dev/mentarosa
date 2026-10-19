# Mentarosa Boutique · sitio web

Sitio de Mentarosa Boutique (San Cristóbal, Táchira) en HTML, CSS y JavaScript, sin frameworks ni build.

## Páginas
- `index.html` — homepage
- `shop.html` — tienda con filtros (estado en la URL)
- `product.html` — plantilla única de ficha: `/products/<slug>`
- `wishlist.html` — favoritos: `/wishlist`
- `cart.html` — carrito y pedido por WhatsApp: `/cart`

## Datos y configuración
- `assets/js/catalog.js` — catálogo (**datos de ejemplo**: reemplazar por los productos reales)
- `assets/js/order.js` — número oficial de WhatsApp para pedidos
- Carrito y favoritos se guardan en el navegador (`localStorage`), sin backend ni pagos.

## Fotos pendientes
Las imágenes que faltan muestran un marco con la ruta esperada. Guarda cada foto con ese nombre en:
`assets/productos/`, `assets/categorias/` y `assets/campana/`.

## Probar en local
```bash
python3 serve.py
```
Abre http://localhost:8080 (imita las rutas de Vercel).

## Publicar
```bash
npx vercel --prod
```
