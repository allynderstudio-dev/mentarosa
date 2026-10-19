/* =====================================================================
   Mentarosa · Catálogo
   ---------------------------------------------------------------------
   DATOS DE EJEMPLO. Sustituye este arreglo por el catálogo real (o por un
   fetch a tu API) manteniendo la misma forma de cada producto:

   id      identificador único (se usa para favoritos y carrito)
   name    nombre visible
   cat     'Tops' | 'Pantalones' | 'Chaquetas' | 'Zapatos'
   price   { amount, cur }  → precio que se muestra ('USD' o 'pesos')
   usd     precio numérico usado para filtrar y ordenar
   old     (opcional) precio anterior, misma moneda que price
   tag     (opcional) 'new' | 'best'
   stock   false = agotado
   sizes   tallas disponibles ('XS'…'XL' o numéricas para calzado)
   colors  claves de MENTAROSA_COLORS
   added   fecha de ingreso (ISO) → orden "Novedades"
   home    true = aparece en "Recién llegados" de la homepage
   img     foto principal · img2 (opcional) foto del hover
   fit     'cutout' (producto recortado sobre pastel) | 'photo' (foto a sangre)
   bg      fondo pastel de la tarjeta
   ===================================================================== */
window.MENTAROSA_COLORS = {
  rosa:     { name: 'Rosa',     hex: '#F07AA4' },
  crema:    { name: 'Crema',    hex: '#F3E6D0' },
  cacao:    { name: 'Cacao',    hex: '#7A5546' },
  dorado:   { name: 'Dorado',   hex: '#D9B26A' },
  blanco:   { name: 'Blanco',   hex: '#FFFFFF' },
  negro:    { name: 'Negro',    hex: '#2A2024' },
  azul:     { name: 'Azul jean',hex: '#6382AE' },
  leopardo: { name: 'Leopardo', hex: 'radial-gradient(circle at 30% 35%,#3D2A1E 18%,transparent 20%),radial-gradient(circle at 70% 65%,#3D2A1E 16%,transparent 18%),#D9AE6E' }
};

window.MENTAROSA_CATALOG = [
  // --- los 8 primeros aparecen en "Recién llegados" (home:true), en este orden ---
  { id:'p1',  name:'Tenis cacao & crema',  cat:'Zapatos',    price:{amount:38,cur:'USD'}, usd:38, tag:'new',  stock:true,
    sizes:['35','36','37','38','39','40'], colors:['cacao','crema'], added:'2026-10-14', home:true,
    img:'assets/zapatos-nike.png', fit:'cutout', bg:'linear-gradient(160deg,#FBC9D9,#FFD6C7)' },
  { id:'p2',  name:'Samba leopardo',       cat:'Zapatos',    price:{amount:75000,cur:'pesos'}, usd:19 /* equivalente aproximado de ejemplo */, tag:'best', stock:true,
    sizes:['35','36','37','38','39'], colors:['crema','leopardo'], added:'2026-10-02', home:true,
    img:'assets/tenis-samba.png', fit:'cutout', bg:'linear-gradient(160deg,#FCEBC8,#FDE6EE)' },
  { id:'p3',  name:'Slingback rosa',       cat:'Zapatos',    price:{amount:42,cur:'USD'}, usd:42, tag:'new',  stock:true,
    sizes:['35','36','37','38','39'], colors:['rosa','dorado'], added:'2026-10-12', home:true,
    img:'assets/tacon-rosa.png', fit:'cutout', bg:'linear-gradient(160deg,#F4D5EA,#FBC9D9)' },
  { id:'p4',  name:'Top satinado crema',   cat:'Tops',       price:{amount:18,cur:'USD'}, usd:18, tag:'new',  stock:true,
    sizes:['XS','S','M','L'], colors:['crema'], added:'2026-10-13', home:true,
    img:'assets/productos/top-satinado.jpg', img2:'assets/productos/top-satinado-2.jpg', fit:'photo', bg:'linear-gradient(160deg,#FFF8EA,#FCEBC8)' },
  { id:'p5',  name:'Jean wide leg',        cat:'Pantalones', price:{amount:32,cur:'USD'}, usd:32, old:40, tag:'best', stock:true,
    sizes:['XS','S','M','L','XL'], colors:['azul'], added:'2026-09-20', home:true,
    img:'assets/productos/jean-wide-leg.jpg', img2:'assets/productos/jean-wide-leg-2.jpg', fit:'photo', bg:'linear-gradient(160deg,#FBC9D9,#F4D5EA)' },
  { id:'p6',  name:'Bomber rosa suave',    cat:'Chaquetas',  price:{amount:46,cur:'USD'}, usd:46, tag:'new',  stock:true,
    sizes:['S','M','L'], colors:['rosa'], added:'2026-10-11', home:true,
    img:'assets/productos/bomber-rosa.jpg', img2:'assets/productos/bomber-rosa-2.jpg', fit:'photo', bg:'linear-gradient(160deg,#FDE6EE,#FFD6C7)' },
  { id:'p7',  name:'Blusa romántica',      cat:'Tops',       price:{amount:20,cur:'USD'}, usd:20, stock:true,
    sizes:['XS','S','M'], colors:['blanco','rosa'], added:'2026-09-28', home:true,
    img:'assets/productos/blusa-romantica.jpg', img2:'assets/productos/blusa-romantica-2.jpg', fit:'photo', bg:'linear-gradient(160deg,#FFD6C7,#FCEBC8)' },
  { id:'p8',  name:'Pantalón cargo beige', cat:'Pantalones', price:{amount:29,cur:'USD'}, usd:29, tag:'new',  stock:true,
    sizes:['S','M','L','XL'], colors:['crema'], added:'2026-10-09', home:true,
    img:'assets/productos/cargo-beige.jpg', img2:'assets/productos/cargo-beige-2.jpg', fit:'photo', bg:'linear-gradient(160deg,#FCEBC8,#FBC9D9)' },

  // --- resto del catálogo de ejemplo (solo en la tienda) ---
  { id:'p9',  name:'Crop top acanalado',   cat:'Tops',       price:{amount:15,cur:'USD'}, usd:15, stock:true,
    sizes:['XS','S','M'], colors:['rosa','negro'], added:'2026-09-15',
    img:'assets/productos/crop-acanalado.jpg', img2:'assets/productos/crop-acanalado-2.jpg', fit:'photo', bg:'linear-gradient(160deg,#F4D5EA,#FDE6EE)' },
  { id:'p10', name:'Body de encaje',       cat:'Tops',       price:{amount:22,cur:'USD'}, usd:22, stock:false,
    sizes:['S','M'], colors:['negro'], added:'2026-09-05',
    img:'assets/productos/body-encaje.jpg', img2:'assets/productos/body-encaje-2.jpg', fit:'photo', bg:'linear-gradient(160deg,#FDE6EE,#F4D5EA)' },
  { id:'p11', name:'Camisa oversize a rayas', cat:'Tops',    price:{amount:26,cur:'USD'}, usd:26, stock:true,
    sizes:['S','M','L'], colors:['blanco','azul'], added:'2026-08-30',
    img:'assets/productos/camisa-rayas.jpg', img2:'assets/productos/camisa-rayas-2.jpg', fit:'photo', bg:'linear-gradient(160deg,#FFF8EA,#FDE6EE)' },
  { id:'p12', name:'Jean mom fit',         cat:'Pantalones', price:{amount:30,cur:'USD'}, usd:30, tag:'best', stock:true,
    sizes:['S','M','L'], colors:['azul'], added:'2026-08-22',
    img:'assets/productos/jean-mom.jpg', img2:'assets/productos/jean-mom-2.jpg', fit:'photo', bg:'linear-gradient(160deg,#FBC9D9,#FFD6C7)' },
  { id:'p13', name:'Palazzo satinado',     cat:'Pantalones', price:{amount:34,cur:'USD'}, usd:34, stock:true,
    sizes:['XS','S','M','L'], colors:['rosa','dorado'], added:'2026-09-25',
    img:'assets/productos/palazzo-satinado.jpg', img2:'assets/productos/palazzo-satinado-2.jpg', fit:'photo', bg:'linear-gradient(160deg,#FCEBC8,#F4D5EA)' },
  { id:'p14', name:'Chaqueta denim cropped', cat:'Chaquetas', price:{amount:38,cur:'USD'}, usd:38, tag:'best', stock:true,
    sizes:['XS','S','M','L'], colors:['azul'], added:'2026-09-10',
    img:'assets/productos/denim-cropped.jpg', img2:'assets/productos/denim-cropped-2.jpg', fit:'photo', bg:'linear-gradient(160deg,#FDE6EE,#FCEBC8)' },
  { id:'p15', name:'Blazer rosa estructurado', cat:'Chaquetas', price:{amount:52,cur:'USD'}, usd:52, stock:false,
    sizes:['S','M','L'], colors:['rosa'], added:'2026-09-18',
    img:'assets/productos/blazer-rosa.jpg', img2:'assets/productos/blazer-rosa-2.jpg', fit:'photo', bg:'linear-gradient(160deg,#FBC9D9,#FDE6EE)' },
  { id:'p16', name:'Botín cacao',          cat:'Zapatos',    price:{amount:48,cur:'USD'}, usd:48, tag:'new',  stock:true,
    sizes:['36','37','38','39','40'], colors:['cacao'], added:'2026-10-07',
    img:'assets/productos/botin-cacao.jpg', img2:'assets/productos/botin-cacao-2.jpg', fit:'photo', bg:'linear-gradient(160deg,#FFD6C7,#FCEBC8)' }
];

/* =====================================================================
   Información de ficha de producto (PDP) — DATOS DE EJEMPLO
   ---------------------------------------------------------------------
   Se fusiona con cada producto del catálogo por su id (ver site.js).
   keywords      (opcional) palabras extra para el buscador (ej. 'tenis sneakers')
   slug          URL de la ficha → /products/<slug>
   desc          descripción breve
   details       lista de detalles
   material      composición
   care          (opcional) cuidados; si falta se usan los de su categoría
   variantColors (opcional) colores elegibles en la ficha; si falta, el
                 producto tiene un solo color y no se muestra selector
   inventory     (opcional) stock por variante 'color|talla'. Usa '*' como
                 comodín. Lo que no aparezca se considera disponible.
                 0 = agotado · 1–2 = últimas unidades
   images        (opcional) galería; si falta se usan img e img2
   colorImages   (opcional) galería por color { rosa:[...], negro:[...] }
   ===================================================================== */
window.MENTAROSA_CARE = {
  Tops:       ['Lavar a mano o en ciclo delicado con agua fría.', 'No usar blanqueador.', 'Secar a la sombra, en horizontal.', 'Planchar a baja temperatura, del revés.'],
  Pantalones: ['Lavar del revés en agua fría con colores similares.', 'No usar secadora para conservar el calce.', 'Planchar a temperatura media.'],
  Chaquetas:  ['Lavar en ciclo delicado o en seco según la etiqueta.', 'Secar colgada en una percha ancha.', 'Guardar abotonada para mantener la forma.'],
  Zapatos:    ['Limpiar con un paño húmedo y jabón neutro.', 'Dejar secar al aire, lejos del calor directo.', 'Guardar con relleno de papel para mantener la forma.']
};

window.MENTAROSA_DETAILS = {
  p1:  { keywords:'tenis sneakers zapatillas deportivos', slug:'tenis-cacao-crema', desc:'Tenis de corte bajo en cacao y crema, el par que combina con todo: jeans, faldas y vestidos.',
         details:['Corte bajo con cordones', 'Suela de goma antideslizante', 'Plantilla acolchada'], material:'Exterior sintético efecto cuero · suela de goma',
         inventory:{ '*|35':0, '*|40':2 } },
  p2:  { keywords:'tenis sneakers zapatillas deportivos', slug:'samba-leopardo', desc:'Clásicos con un giro: base crema, franjas animal print y suela cacao para un look urbano y coqueto.',
         details:['Franjas laterales animal print', 'Puntera de gamuza', 'Suela de goma cacao'], material:'Exterior sintético y gamuza · suela de goma',
         inventory:{ '*|39':1 } },
  p3:  { keywords:'tacon tacones zapatos de tacon', slug:'slingback-rosa', desc:'Slingback de punta fina en rosa charol con detalle dorado en el tacón. Para brillar de día y de noche.',
         details:['Tacón de aguja de 9 cm', 'Tira trasera con hebilla dorada', 'Punta fina'], material:'Exterior efecto charol · plantilla sintética' },
  p4:  { slug:'top-satinado-crema', desc:'Top de tirantes con caída satinada en tono crema. Delicado, fresco y fácil de combinar.',
         details:['Tirantes finos ajustables', 'Escote recto', 'Largo a la cintura'], material:'100% poliéster satinado',
         inventory:{ '*|L':0, '*|XS':1 } },
  p5:  { keywords:'jean jeans', slug:'jean-wide-leg', desc:'Jean de tiro alto y pierna amplia que estiliza la figura. Tu básico favorito, ahora más cómodo.',
         details:['Tiro alto', 'Pierna amplia hasta el tobillo', 'Cinco bolsillos'], material:'98% algodón · 2% elastano' },
  p6:  { slug:'bomber-rosa-suave', desc:'Bomber ligera en rosa suave con puños elásticos: el toque dulce para tus looks deportivos.',
         details:['Cierre frontal', 'Puños y cintura elásticos', 'Bolsillos laterales'], material:'Exterior poliéster · forro ligero' },
  p7:  { slug:'blusa-romantica', desc:'Blusa de mangas abullonadas y escote suave. Romántica sin ser recargada.',
         details:['Mangas abullonadas', 'Escote cuadrado', 'Fruncido en el busto'], material:'Viscosa ligera',
         variantColors:['blanco','rosa'], inventory:{ 'rosa|XS':0, 'blanco|M':2 } },
  p8:  { slug:'pantalon-cargo-beige', desc:'Cargo en beige con bolsillos utilitarios y cintura ajustable: comodidad con mucha actitud.',
         details:['Bolsillos tipo cargo', 'Cintura con cordón', 'Bota recta'], material:'100% algodón' },
  p9:  { slug:'crop-top-acanalado', desc:'Crop top acanalado de cuello redondo. El básico que eleva cualquier look.',
         details:['Tejido acanalado elástico', 'Cuello redondo', 'Largo crop'], material:'95% algodón · 5% elastano',
         variantColors:['rosa','negro'], inventory:{ 'negro|*':0 } },
  p10: { slug:'body-de-encaje', desc:'Body con detalles de encaje y escote delicado. Ideal con jeans o falda.',
         details:['Encaje en escote y mangas', 'Cierre de broches', 'Ajuste ceñido'], material:'Poliamida y elastano' },
  p11: { slug:'camisa-oversize-rayas', desc:'Camisa oversize a rayas, fresca y relajada. Úsala abierta, anudada o por dentro.',
         details:['Corte oversize', 'Botones frontales', 'Puños con botón'], material:'100% algodón' },
  p12: { keywords:'jean jeans', slug:'jean-mom-fit', desc:'Mom fit de tiro alto con calce relajado y bota tobillera. Un clásico que nunca falla.',
         details:['Tiro alto', 'Calce relajado en cadera', 'Bota tobillera'], material:'100% algodón' },
  p13: { keywords:'pantalon ancho', slug:'palazzo-satinado', desc:'Palazzo de caída fluida con brillo satinado. Elegante, cómodo y muy favorecedor.',
         details:['Cintura elástica', 'Pierna amplia y fluida', 'Largo hasta el piso'], material:'100% poliéster satinado',
         variantColors:['rosa','dorado'], inventory:{ 'dorado|XS':0, 'dorado|S':0 } },
  p14: { keywords:'jean denim', slug:'chaqueta-denim-cropped', desc:'Chaqueta denim corta para lucir tu cintura. La tercera pieza perfecta.',
         details:['Largo cropped', 'Botones metálicos', 'Bolsillos de parche'], material:'100% algodón denim' },
  p15: { slug:'blazer-rosa-estructurado', desc:'Blazer rosa de hombros estructurados. Poder y dulzura en una sola prenda.',
         details:['Hombros estructurados', 'Cierre de un botón', 'Forro interior'], material:'Poliéster y viscosa' },
  p16: { keywords:'botin botines botas tacon', slug:'botin-cacao', desc:'Botín cacao de tacón medio, cómodo para todo el día y lindo con todo.',
         details:['Tacón cuadrado de 5 cm', 'Cierre lateral', 'Puntera redonda'], material:'Exterior sintético efecto cuero',
         inventory:{ '*|36':0 } }
};
