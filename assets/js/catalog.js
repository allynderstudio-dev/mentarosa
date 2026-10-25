/* =====================================================================
   Mentarosa · Catálogo
   ---------------------------------------------------------------------
   Productos reales de Mentarosa. Para agregar uno nuevo:
   1. Guarda sus fotos en assets/productos/<slug>-1.jpg, -2.jpg, …
   2. Añade una línea en TENIS (o crea otra lista similar) más abajo.

   Campos de cada producto:
   id       identificador único y estable (favoritos y carrito)
   slug     URL de la ficha → /products/<slug>
   name     nombre visible
   cat      'Tops' | 'Pantalones' | 'Chaquetas' | 'Zapatos'
   price    { amount, cur }  → precio que se muestra ('pesos' o 'USD')
   usd      precio numérico para filtrar y ordenar (se toma de price si falta)
   tag      (opcional) 'new' | 'best'
   stock    false = agotado
   sizes    tallas disponibles
   colors   claves de MENTAROSA_COLORS (filtros y buscador)
   added    fecha de ingreso (ISO) → orden "Novedades"
   home     true = aparece en "Recién llegados" de la homepage
   images   galería (la primera es la foto principal; la segunda, la del hover)
   fit      'photo' (foto a sangre) | 'cutout' (producto recortado sobre pastel)
   bg       fondo pastel de la tarjeta (se ve mientras carga la foto)
   ===================================================================== */
window.MENTAROSA_COLORS = {
  rosa:     { name: 'Rosa',         hex: '#F07AA4' },
  vino:     { name: 'Vino',         hex: '#7B2337' },
  crema:    { name: 'Crema',        hex: '#F3E6D0' },
  blanco:   { name: 'Blanco',       hex: '#FFFFFF' },
  negro:    { name: 'Negro',        hex: '#2A2024' },
  dorado:   { name: 'Dorado',       hex: 'linear-gradient(135deg,#E9CF8E,#B98F3E 55%,#F3DFA6)' },
  plateado: { name: 'Plateado',     hex: 'linear-gradient(135deg,#F2F2F4,#A9ACB4 55%,#E4E5E9)' },
  azul:     { name: 'Azul oscuro',  hex: '#24386E' },
  denim:    { name: 'Azul medio',   hex: '#4F6E9E' },
  celeste:  { name: 'Azul claro',   hex: '#A9C1DD' },
  beige:    { name: 'Beige',        hex: '#D8CBB0' },
  rojo:     { name: 'Rojo',         hex: '#C0283A' },
  cacao:    { name: 'Café',         hex: '#6B4428' },
  caramelo: { name: 'Caramelo',     hex: '#B8742F' },
  menta:    { name: 'Menta',        hex: '#9FE3C3' },
  leopardo: { name: 'Leopardo',     hex: 'radial-gradient(circle at 30% 35%,#3D2A1E 18%,transparent 20%),radial-gradient(circle at 70% 65%,#3D2A1E 16%,transparent 18%),#D9AE6E' },
  animal:   { name: 'Animal print', hex: 'radial-gradient(circle at 30% 35%,#2A2024 20%,transparent 22%),radial-gradient(circle at 72% 62%,#2A2024 16%,transparent 18%),#FFFFFF' }
};

window.MENTAROSA_CARE = {
  Tops:       ['Lavar a mano o en ciclo delicado con agua fría.', 'No usar blanqueador.', 'Secar a la sombra, en horizontal.', 'Planchar a baja temperatura, del revés.'],
  Pantalones: ['Lavar del revés en agua fría con colores similares.', 'No usar secadora para conservar el calce.', 'Planchar a temperatura media.'],
  Chaquetas:  ['Lavar en ciclo delicado o en seco según la etiqueta.', 'Secar colgada en una percha ancha.', 'Guardar abotonada para mantener la forma.'],
  Zapatos:    ['Limpiar con un paño húmedo y jabón neutro.', 'Dejar secar al aire, lejos del calor directo.', 'Guardar con relleno de papel para mantener la forma.']
};

/* ---------------------------------------------------------------------
   Familias de productos. Cada fila:
   [id, slug, nombre, colores, nº de fotos, home, fondo, descripción, detalles]
   Las fotos van en assets/productos/<slug>-1.jpg, -2.jpg, …
   Dentro de cada familia, el orden define "Novedades" (primero = más reciente).
   "Recién llegados" muestra los home=true en el orden en que aparecen aquí.
   Todos los precios en pesos colombianos.
   --------------------------------------------------------------------- */
(function () {
  // sinónimos para el buscador según el color ("plata" encuentra el plateado, "vaca" el animal print…)
  var COLOR_WORDS = { dorado: 'oro metalizado brillante', plateado: 'plata metalizado brillante', animal: 'vaca cow print', cacao: 'marron cafe',
                      vino: 'burdeos guinda bordo', azul: 'azul marino navy oscuro', leopardo: 'animal print', menta: 'verde', caramelo: 'camel marron',
                      celeste: 'azul claro celeste', denim: 'azul medio denim', beige: 'beige caqui kaki arena', crema: 'marfil hueso' };
  var catalog = [];
  function add(fam, rows) {
    rows.forEach(function (t, i) {
      var images = [];
      for (var k = 1; k <= t[4]; k++) images.push('assets/productos/' + t[1] + '-' + k + '.jpg');
      catalog.push({
        id: t[0], slug: t[1], name: t[2], cat: fam.cat, colors: t[3],
        price: { amount: fam.price, cur: 'pesos' }, usd: fam.price, stock: true, sizes: fam.sizes,
        added: new Date(fam.date - i * 60000).toISOString(), home: t[5],
        images: images, img: images[0], img2: images[1], fit: 'photo',
        bg: 'linear-gradient(160deg,' + t[6] + ')',
        desc: t[7], details: t[8],
        keywords: fam.keywords + ' ' + t[3].map(function (k) { return COLOR_WORDS[k] || ''; }).join(' ')
        // material: pendiente de confirmar con Mentarosa
      });
    });
  }

  /* Chaquetas militares · 100.000 pesos · talla única (cargadas el 25 oct 2026) */
  add({ cat: 'Chaquetas', price: 100000, sizes: ['Única'], date: Date.UTC(2026, 9, 25, 12),
        keywords: 'chaqueta chaquetas militar blazer abrigo botones cuello alto' }, [
    ['c01', 'chaqueta-militar-vino',        'Chaqueta Militar Vino',        ['vino'],     1, true,  '#FDE6EE,#FBC9D9',
      'Chaqueta de estilo militar en vino con botones metálicos: elegante, femenina y con mucha personalidad.',
      ['Cuello alto', 'Cierre frontal', 'Botones metálicos decorativos', 'Hombreras estilo militar']],
    ['c02', 'chaqueta-militar-marfil',      'Chaqueta Militar Marfil',      ['crema'],    1, true,  '#FFF8EA,#FCEBC8',
      'En tono marfil con botones plateados, la tercera pieza perfecta para looks claros y delicados.',
      ['Cuello alto', 'Cierre frontal', 'Botones metálicos plateados', 'Bolsillos con solapa']],
    ['c03', 'chaqueta-militar-azul-marino', 'Chaqueta Militar Azul Marino', ['azul'],     1, false, '#F4D5EA,#FDE6EE',
      'Azul marino con botones dorados: un clásico que eleva cualquier outfit, de jeans a vestidos.',
      ['Cuello alto', 'Cierre frontal', 'Botones metálicos dorados', 'Hombreras estilo militar']],
    ['c04', 'chaqueta-militar-negra',       'Chaqueta Militar Negra',       ['negro'],    1, false, '#FDE6EE,#FCEBC8',
      'Negra con botones dorados: el básico de impacto que combina con todo.',
      ['Cuello alto', 'Cierre frontal', 'Botones metálicos dorados', 'Hombreras estilo militar']],
    ['c05', 'chaqueta-militar-blanca',      'Chaqueta Militar Blanca',      ['blanco'],   1, false, '#FFF4F7,#FDE6EE',
      'Blanca con botones dorados, fresca y sofisticada para looks de día o de noche.',
      ['Cuello alto', 'Cierre frontal', 'Botones metálicos dorados', 'Hombreras estilo militar']],
    ['c06', 'chaqueta-militar-camel',       'Chaqueta Militar Camel',       ['caramelo'], 1, false, '#FCEBC8,#FFD6C7',
      'Camel con botones metálicos: cálida, versátil y perfecta con jeans claros.',
      ['Cuello alto', 'Cierre frontal', 'Botones metálicos decorativos', 'Hombreras estilo militar']]
  ]);

  /* Jeans · 111.000 pesos · tallas 3 a 13 (cargados el 25 oct 2026) */
  add({ cat: 'Pantalones', price: 111000, sizes: ['3', '5', '7', '9', '11', '13'], date: Date.UTC(2026, 9, 25, 11),
        keywords: 'jean jeans pantalon pantalones denim mezclilla' }, [
    ['j01', 'jean-balloon-azul-medio',  'Jean Balloon Azul Medio',  ['denim'],   2, true,  '#FBC9D9,#F4D5EA',
      'Corte balloon de pierna curva y amplia en azul medio: cómodo, moderno y súper tendencia.',
      ['Corte balloon (pierna curva y amplia)', 'Tiro alto', 'Lavado azul medio']],
    ['j02', 'jean-flare-azul-oscuro',   'Jean Flare Azul Oscuro',   ['azul'],    2, true,  '#FDE6EE,#FFD6C7',
      'Flare de tiro alto en azul oscuro que estiliza la figura y alarga las piernas.',
      ['Bota acampanada', 'Tiro alto', 'Lavado azul oscuro']],
    ['j03', 'jean-balloon-beige',       'Jean Balloon Beige',       ['beige'],   1, true,  '#FCEBC8,#FFF8EA',
      'Balloon en beige para salir del azul de siempre: suave, luminoso y fácil de combinar.',
      ['Corte balloon (pierna curva y amplia)', 'Tiro alto', 'Tono beige']],
    ['j04', 'jean-balloon-negro',       'Jean Balloon Negro',       ['negro'],   2, false, '#FDE6EE,#FCEBC8',
      'Balloon en negro deslavado: el toque urbano que necesitas en tu clóset.',
      ['Corte balloon (pierna curva y amplia)', 'Tiro alto', 'Lavado negro']],
    ['j05', 'jean-balloon-azul-claro',  'Jean Balloon Azul Claro',  ['celeste'], 2, false, '#F4D5EA,#FBC9D9',
      'Balloon en azul claro, fresco y relajado para tus looks de día.',
      ['Corte balloon (pierna curva y amplia)', 'Tiro alto', 'Lavado azul claro']],
    ['j06', 'jean-barrel-azul-oscuro',  'Jean Barrel Azul Oscuro',  ['azul'],    2, false, '#FFD6C7,#FCEBC8',
      'Corte barrel en azul oscuro con ruedo doblado: relajado y con mucho estilo.',
      ['Corte barrel', 'Ruedo doblado', 'Lavado azul oscuro']],
    ['j07', 'jean-wide-leg-azul-medio', 'Jean Wide Leg Azul Medio', ['denim'],   2, false, '#FBC9D9,#FFD6C7',
      'Wide leg de pierna ancha y recta en azul medio: cómodo y favorecedor.',
      ['Pierna ancha y recta', 'Tiro alto', 'Lavado azul medio']],
    ['j08', 'jean-wide-leg-azul-claro', 'Jean Wide Leg Azul Claro', ['celeste'], 1, false, '#FFF4F7,#F4D5EA',
      'Wide leg en azul claro, ligero y perfecto para looks frescos.',
      ['Pierna ancha y recta', 'Tiro alto', 'Lavado azul claro']]
  ]);

  /* Tenis retro · 90.000 pesos · tallas 34 al 40 (cargados el 23 oct 2026) */
  add({ cat: 'Zapatos', price: 90000, sizes: ['34', '35', '36', '37', '38', '39', '40'], date: Date.UTC(2026, 9, 23),
        keywords: 'tenis retro sneakers zapatillas deportivos casuales sl72 sl-72' },
  [
    ['t01', 'tenis-retro-rosa-azul',    'Tenis Retro Rosa & Azul',  ['rosa', 'azul'],      2, true,  '#FBC9D9,#F4D5EA',
      'Azul marino con franjas y cordones rosa: el par más dulce de la colección, perfecto para darle color a tus jeans.',
      ['Franjas laterales en rosa', 'Cordones rosa', 'Suela color miel con detalle azul']],
    ['t02', 'tenis-retro-vino',         'Tenis Retro Vino',         ['vino', 'crema'],     5, true,  '#FDE6EE,#FFD6C7',
      'Vino profundo con franjas crema. Un clásico elegante que combina con todo, de jeans a looks más arreglados.',
      ['Franjas laterales en crema', 'Cordones crema', 'Suela color miel']],
    ['t03', 'tenis-retro-dorado',       'Tenis Retro Dorado',       ['dorado'],            1, true,  '#FCEBC8,#FFF8EA',
      'Dorado brillante para robarse todas las miradas. Ideal para elevar un look sencillo.',
      ['Acabado metalizado dorado', 'Franjas laterales en tono crema', 'Suela color miel']],
    ['t04', 'tenis-retro-animal-print', 'Tenis Retro Animal Print', ['animal', 'rosa'],    1, false,  '#F4D5EA,#FBC9D9',
      'Estampado animal print en blanco y negro con un guiño rosa en la suela. Atrevidos y divertidos.',
      ['Estampado animal print', 'Franjas laterales blancas', 'Suela con detalle rosa']],
    ['t05', 'tenis-retro-plateado',     'Tenis Retro Plateado',     ['plateado', 'azul'],  2, false,  '#FFF4F7,#F4D5EA',
      'Plateado metalizado con franjas azul marino: un par con brillo que se ve moderno y retro a la vez.',
      ['Acabado metalizado plateado', 'Franjas laterales azul marino', 'Suela color miel']],
    ['t06', 'tenis-retro-negro',        'Tenis Retro Negro',        ['negro', 'blanco'],   2, false,  '#FDE6EE,#FCEBC8',
      'Negro con franjas blancas y suela color miel: el básico que nunca falla y va con todo.',
      ['Franjas laterales blancas', 'Cordones negros', 'Suela color miel']],
    ['t07', 'tenis-retro-leopardo',     'Tenis Retro Leopardo',     ['leopardo', 'negro'], 2, false,  '#FFD6C7,#FCEBC8',
      'Negro con detalles leopardo para un toque salvaje y femenino.',
      ['Detalles en estampado leopardo', 'Base negra', 'Suela color miel']],
    ['t08', 'tenis-retro-negro-menta',  'Tenis Retro Negro Menta',  ['negro', 'menta'],    2, false,  '#FBC9D9,#FFF8EA',
      'Negro con franjas blancas y una suela en verde menta que les da un aire fresco y diferente.',
      ['Franjas laterales blancas', 'Suela con detalle verde menta', 'Cordones negros']],
    ['t09', 'tenis-retro-cafe',         'Tenis Retro Café',         ['cacao'],             1, false, '#FCEBC8,#FFD6C7',
      'Café en tonos tierra, cálido y fácil de combinar para el día a día.',
      ['Tonos café', 'Franjas laterales en tono café', 'Suela blanca']],
    ['t10', 'tenis-retro-blanco',       'Tenis Retro Blanco',       ['blanco', 'negro'],   1, false, '#FFF4F7,#FDE6EE',
      'Blanco con franjas negras: estilo que nunca pasa de moda.',
      ['Base blanca y gris claro', 'Franjas laterales negras', 'Suela color miel']],
    ['t11', 'tenis-retro-caramelo',     'Tenis Retro Caramelo',     ['caramelo', 'vino'],  1, false, '#FFD6C7,#FCEBC8',
      'Caramelo y vino con franjas amarillas y detalle azul en la suela. Un par lleno de color.',
      ['Combinación caramelo y vino', 'Franjas y cordones amarillos', 'Suela con detalle azul']],
    ['t12', 'tenis-retro-azul-rojo',    'Tenis Retro Azul & Rojo',  ['azul', 'rojo'],      1, false, '#F4D5EA,#FDE6EE',
      'Azul con franjas blancas y detalle rojo en la suela: deportivos y con mucho estilo.',
      ['Base azul', 'Franjas laterales blancas', 'Suela con detalle rojo']],
    ['t13', 'tenis-retro-crema',        'Tenis Retro Crema',        ['crema'],             1, false, '#FFF8EA,#FCEBC8',
      'Crema de pies a cabeza: suaves, delicados y perfectos para looks claros.',
      ['Tono crema monocromático', 'Cordones crema', 'Suela crema']]
  ]);

  window.MENTAROSA_CATALOG = catalog;
})();

/* Información extra por producto (opcional): se fusiona por id.
   Ejemplo de stock por talla: t02: { inventory: { '*|34': 0, '*|40': 2 } }  (0 = agotado · 1–2 = últimas unidades) */
window.MENTAROSA_DETAILS = {};
