/* =====================================================================
   Mentarosa · Estado de compra: Carrito y Wishlist
   ---------------------------------------------------------------------
   Fuente única de verdad para carrito y favoritos en todas las páginas.
   Se carga después de catalog.js y antes de site.js.

   Persistencia TEMPORAL en localStorage mediante un "adaptador". Para
   conectar un backend o Shopify más adelante, reemplaza el adaptador
   (load/save) sin tocar la interfaz pública:

     Mentarosa.Cart      lines() · count() · add() · setQty() · remove() · clear() · toPayload()
     Mentarosa.Wishlist  ids() · has() · toggle() · add() · remove() · count()

   Solo se guardan identificadores, variante y cantidad. Nombre, precio,
   imagen y stock se leen SIEMPRE del catálogo en el momento de mostrar.
   Los precios y la disponibilidad deben validarse en el servidor cuando
   exista uno: aquí son solo de referencia.

   Eventos (en window):  'mentarosa:cart'  'mentarosa:wishlist'
   detail = { action, source: 'local' | 'storage', ... }
   ===================================================================== */
(function () {
  var M = window.Mentarosa = window.Mentarosa || {};
  var CATALOG = window.MENTAROSA_CATALOG || [];
  var DETAILS = window.MENTAROSA_DETAILS || {};
  var MAX_QTY = 10;

  /* ---------- acceso seguro al almacenamiento ---------- */
  var mem = {}, canStore = (function () {
    try { var k = '__mr_test__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; }
  })();
  function readJSON(key, fallback) {
    try {
      var raw = canStore ? localStorage.getItem(key) : mem[key];
      if (raw == null) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }          // JSON corrupto → se ignora
  }
  function writeJSON(key, value) {
    var raw = JSON.stringify(value);
    try { if (canStore) localStorage.setItem(key, raw); else mem[key] = raw; }
    catch (e) { mem[key] = raw; }             // cuota llena o modo privado → memoria
  }
  /* adaptador por defecto (localStorage). Reemplazable: { load(), save(data) } */
  function localAdapter(key, version) {
    return {
      load: function () { var d = readJSON(key, null); return d && d.v === version ? d.items : null; },
      save: function (items) { writeJSON(key, { v: version, items: items, updated: Date.now() }); },
      key: key
    };
  }

  /* ---------- utilidades de catálogo ---------- */
  function product(id) { for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].id === id) return CATALOG[i]; return null; }
  function variantColors(p) { var d = DETAILS[p.id] || {}; return p.variantColors || d.variantColors || []; }
  // stock de referencia (el definitivo vendrá del servidor)
  function stockOf(p, color, size) {
    if (M.variantStock) return M.variantStock(p, color, size);
    return p.stock === false ? 0 : MAX_QTY;
  }
  function maxFor(p, color, size) { return Math.max(0, Math.min(MAX_QTY, stockOf(p, color, size))); }
  // identificador estable de variante (mapeable a un variant id de Shopify)
  function variantId(productId, color, size) { return productId + '::' + (color || '-') + '::' + (size || '-'); }
  M.variantId = variantId;

  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); }
    catch (e) { var ev = document.createEvent('CustomEvent'); ev.initCustomEvent(name, false, false, detail); window.dispatchEvent(ev); }
  }

  /* =====================================================================
     CARRITO — cada combinación producto + color + talla es una línea
     ===================================================================== */
  var cartAdapter = localAdapter('mentarosa.cart', 1), cart = [];

  function sanitizeCart(items) {
    if (!Array.isArray(items)) return [];
    var out = [], seen = {};
    items.forEach(function (it) {
      if (!it || typeof it.productId !== 'string') return;
      var p = product(it.productId); if (!p) return;                    // producto retirado del catálogo
      var size = typeof it.size === 'string' && (p.sizes || []).indexOf(it.size) > -1 ? it.size : null;
      if ((p.sizes || []).length && !size) return;                       // falta una talla válida
      var colors = variantColors(p);
      var color = typeof it.color === 'string' && colors.indexOf(it.color) > -1 ? it.color : null;
      if (colors.length && !color) color = colors[0];
      var qty = Math.floor(Number(it.qty));
      if (!(qty >= 1)) return;
      var id = variantId(p.id, color, size);
      if (seen[id]) { seen[id].qty = Math.min(MAX_QTY, seen[id].qty + qty); return; }
      var line = { id: id, productId: p.id, color: color, size: size, qty: Math.min(MAX_QTY, qty), added: Number(it.added) || Date.now() };
      seen[id] = line; out.push(line);
    });
    return out;
  }
  function loadCart() { cart = sanitizeCart(cartAdapter.load()); }
  function saveCart(detail) { cartAdapter.save(cart); emit('mentarosa:cart', detail); }

  M.Cart = {
    MAX_QTY: MAX_QTY,
    lines: function () { return cart.map(function (l) { return Object.assign({}, l); }); },
    count: function () { return cart.reduce(function (n, l) { return n + l.qty; }, 0); },
    find: function (lineId) { for (var i = 0; i < cart.length; i++) if (cart[i].id === lineId) return Object.assign({}, cart[i]); return null; },
    /* add({productId, color, size, qty}) → { ok, line, added, clamped, reason } */
    add: function (o) {
      var p = product(o && o.productId);
      if (!p) return { ok: false, reason: 'not-found' };
      var colors = variantColors(p), color = colors.length ? (colors.indexOf(o.color) > -1 ? o.color : null) : null;
      if (colors.length && !color) return { ok: false, reason: 'color' };
      var size = (p.sizes || []).length ? ((p.sizes || []).indexOf(o.size) > -1 ? o.size : null) : null;
      if ((p.sizes || []).length && !size) return { ok: false, reason: 'size' };
      var max = maxFor(p, color, size);
      if (max <= 0) return { ok: false, reason: 'out-of-stock' };
      var qty = Math.max(1, Math.floor(Number(o.qty) || 1));
      var id = variantId(p.id, color, size), line = null;
      for (var i = 0; i < cart.length; i++) if (cart[i].id === id) line = cart[i];
      var before = line ? line.qty : 0, target = Math.min(max, before + qty);
      if (target === before) return { ok: false, reason: 'max', line: Object.assign({}, line), max: max };
      if (line) line.qty = target;
      else { line = { id: id, productId: p.id, color: color, size: size, qty: target, added: Date.now() }; cart.unshift(line); }
      var res = { ok: true, line: Object.assign({}, line), added: target - before, clamped: target - before < qty, max: max };
      saveCart({ action: 'add', lineId: id, added: res.added, source: 'local' });
      return res;
    },
    setQty: function (lineId, qty) {
      for (var i = 0; i < cart.length; i++) if (cart[i].id === lineId) {
        var l = cart[i], p = product(l.productId);
        var max = Math.max(1, maxFor(p, l.color, l.size));
        qty = Math.floor(Number(qty));
        if (!(qty >= 1)) return M.Cart.remove(lineId);
        l.qty = Math.min(max, qty);
        saveCart({ action: 'qty', lineId: lineId, source: 'local' });
        return Object.assign({}, l);
      }
      return null;
    },
    remove: function (lineId) {
      var before = cart.length, removed = null;
      cart = cart.filter(function (l) { if (l.id === lineId) { removed = l; return false; } return true; });
      if (cart.length !== before) saveCart({ action: 'remove', lineId: lineId, removed: removed, source: 'local' });
      return removed;
    },
    restore: function (line) {                // para "Deshacer"
      if (!line) return;
      cart = sanitizeCart([line].concat(cart));
      saveCart({ action: 'restore', lineId: line.id, source: 'local' });
    },
    clear: function () { cart = []; saveCart({ action: 'clear', source: 'local' }); },
    /* líneas listas para enviar a un backend/Shopify (sin precios: los calcula el servidor) */
    toPayload: function () { return cart.map(function (l) { return { variantId: l.id, productId: l.productId, color: l.color, size: l.size, quantity: l.qty }; }); },
    stockOf: function (line) { var p = product(line.productId); return p ? stockOf(p, line.color, line.size) : 0; },
    maxFor: function (line) { var p = product(line.productId); return p ? maxFor(p, line.color, line.size) : 0; },
    useAdapter: function (adapter) { cartAdapter = adapter; loadCart(); emit('mentarosa:cart', { action: 'load', source: 'adapter' }); }
  };

  /* =====================================================================
     WISHLIST — ids de producto
     ===================================================================== */
  var wishAdapter = localAdapter('mentarosa.wishlist', 1), wish = [];
  function sanitizeWish(items) {
    if (!Array.isArray(items)) return [];
    var out = [];
    items.forEach(function (id) { if (typeof id === 'string' && product(id) && out.indexOf(id) < 0) out.push(id); });
    return out;
  }
  function loadWish() {
    var stored = wishAdapter.load();
    if (stored === null) {                    // migración desde la versión anterior ('mentarosa.favs')
      var legacy = readJSON('mentarosa.favs', null);
      if (legacy) { wish = sanitizeWish(legacy); wishAdapter.save(wish); try { localStorage.removeItem('mentarosa.favs'); } catch (e) {} return; }
    }
    wish = sanitizeWish(stored);
  }
  function saveWish(detail) { wishAdapter.save(wish); emit('mentarosa:wishlist', detail); }

  M.Wishlist = {
    ids: function () { return wish.slice(); },
    count: function () { return wish.length; },
    has: function (id) { return wish.indexOf(id) > -1; },
    add: function (id) { if (!product(id) || M.Wishlist.has(id)) return false; wish.unshift(id); saveWish({ action: 'add', id: id, source: 'local' }); return true; },
    remove: function (id) { if (!M.Wishlist.has(id)) return false; wish = wish.filter(function (x) { return x !== id; }); saveWish({ action: 'remove', id: id, source: 'local' }); return true; },
    toggle: function (id) { return M.Wishlist.has(id) ? (M.Wishlist.remove(id), false) : M.Wishlist.add(id); },
    useAdapter: function (adapter) { wishAdapter = adapter; loadWish(); emit('mentarosa:wishlist', { action: 'load', source: 'adapter' }); }
  };

  /* ---------- carga inicial + sincronización entre pestañas ---------- */
  loadCart(); loadWish();
  window.addEventListener('storage', function (e) {
    if (e.key === cartAdapter.key) { loadCart(); emit('mentarosa:cart', { action: 'sync', source: 'storage' }); }
    if (e.key === wishAdapter.key) { loadWish(); emit('mentarosa:wishlist', { action: 'sync', source: 'storage' }); }
  });
})();
