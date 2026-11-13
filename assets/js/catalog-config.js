/* =====================================================================
   Mentarosa · Configuración fija de la tienda
   ---------------------------------------------------------------------
   Lo que NO cambia desde el dashboard: colores, cuidados por categoría
   y lista de categorías. La comparten la tienda y el dashboard (/admin).
   Los productos viven en Postgres (Neon) y llegan en assets/js/catalog.js,
   que el Worker genera a partir de la última publicación.
   ===================================================================== */
window.MENTAROSA_CATEGORIES = ['Tops', 'Pantalones', 'Chaquetas', 'Zapatos'];

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
