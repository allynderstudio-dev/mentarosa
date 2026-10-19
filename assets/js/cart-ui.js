/* =====================================================================
   Mentarosa · Interfaz del carrito
   - Cart Drawer (se inyecta en cualquier página que cargue este script)
   - Selector rápido de talla para "Agregar" desde las tarjetas
   - Render de líneas reutilizado por la página /cart
   Depende de: catalog.js, store.js, site.js
   ===================================================================== */
(function () {
  var M = window.Mentarosa, esc = M.esc, Cart = M.Cart, COLORS = M.colors;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SVG = {
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12"/></svg>',
    img: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="9" width="36" height="30" rx="6"/><circle cx="17" cy="20" r="3.5"/><path d="m8 36 11-10 8 7 6-5 9 8"/></svg>'
  };

  /* ---------- utilidades ---------- */
  function variantText(line) {
    var bits = [];
    if (line.size) bits.push('Talla ' + line.size);
    if (line.color && COLORS[line.color]) bits.push(COLORS[line.color].name);
    return bits.join(' · ');
  }
  // subtotal agrupado por moneda (el catálogo de ejemplo mezcla USD y pesos)
  function totals(lines) {
    var by = {}, order = [];
    lines.forEach(function (l) {
      var p = M.byId(l.productId); if (!p) return;
      var cur = p.price.cur; if (!(cur in by)) { by[cur] = 0; order.push(cur); }
      by[cur] += p.price.amount * l.qty;
    });
    return order.map(function (c) { return M.money(by[c], c); });
  }
  M.cartTotals = totals;

  /* una línea del carrito (drawer y página /cart) */
  function lineHTML(l) {
    var p = M.byId(l.productId); if (!p) return '';
    var stock = Cart.stockOf(l), max = Cart.maxFor(l);
    var src = M.imagesOf(p, l.color)[0];
    var warn = stock === 0 ? '<p class="cl-warn out">Agotado: elimínalo para continuar</p>'
      : (stock <= 2 ? '<p class="cl-warn">' + (stock === 1 ? '¡Última unidad!' : '¡Últimas ' + stock + ' unidades!') + '</p>' : '');
    var url = M.productUrl(p) + (l.color || l.size ? '?' + [l.color ? 'color=' + l.color : '', l.size ? 'talla=' + encodeURIComponent(l.size) : ''].filter(Boolean).join('&') : '');
    return '<li class="cl" data-line="' + esc(l.id) + '">'
      + '<a class="cl-img" href="' + url + '" style="--g:' + p.bg + '" tabindex="-1" aria-hidden="true">'
      + '<span class="cl-ph">' + SVG.img + '</span>'
      + '<img class="' + (p.fit === 'cutout' ? 'cutout' : '') + '" src="' + esc(src) + '" alt="" loading="lazy" onerror="this.remove()"></a>'
      + '<div class="cl-info">'
      + '<a class="cl-name" href="' + url + '">' + esc(p.name) + '</a>'
      + (variantText(l) ? '<p class="cl-var">' + esc(variantText(l)) + '</p>' : '')
      + '<p class="cl-price">' + M.money(p.price.amount, p.price.cur) + (l.qty > 1 ? ' <span>· ' + M.money(p.price.amount * l.qty, p.price.cur) + '</span>' : '') + '</p>'
      + warn
      + '<div class="cl-row">'
      + '<div class="cl-qty" role="group" aria-label="Cantidad de ' + esc(p.name) + '">'
      + '<button type="button" data-act="dec" aria-label="Quitar una unidad">−</button>'
      + '<output aria-live="polite">' + l.qty + '</output>'
      + '<button type="button" data-act="inc" aria-label="Agregar una unidad"' + (l.qty >= max ? ' disabled' : '') + '>+</button></div>'
      + '<button type="button" class="cl-del" data-act="del" aria-label="Eliminar ' + esc(p.name) + ' del carrito">' + SVG.trash + '<span>Eliminar</span></button>'
      + '</div></div></li>';
  }
  M.cartLineHTML = lineHTML;

  /* acciones de las líneas (delegación) — reutilizable en /cart */
  M.bindCartLines = function (root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var li = b.closest('.cl'), id = li && li.dataset.line, l = id && Cart.find(id); if (!l) return;
      if (b.dataset.act === 'inc') Cart.setQty(id, l.qty + 1);
      if (b.dataset.act === 'dec') { if (l.qty > 1) Cart.setQty(id, l.qty - 1); else removeLine(li, id); }
      if (b.dataset.act === 'del') removeLine(li, id);
      // devolver el foco a un control equivalente tras el re-render
      var sel = '[data-line="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"] [data-act="' + b.dataset.act + '"]';
      requestAnimationFrame(function () { var n = root.querySelector(sel); if (n && !n.disabled) n.focus(); });
    });
  };
  function removeLine(li, id) {
    var p = M.byId(Cart.find(id).productId);
    var go = function () {
      var removed = Cart.remove(id);
      M.say('Eliminado del carrito: ' + p.name, { label: 'Deshacer', fn: function () { Cart.restore(removed); } });
    };
    if (reduce || !li) return go();
    li.classList.add('leaving'); setTimeout(go, 260);
  }

  /* =====================================================================
     DRAWER
     ===================================================================== */
  var drawer, scrim, list, empty, foot, lastFocus = null, isOpen = false;
  function build() {
    scrim = document.createElement('div'); scrim.className = 'cd-scrim'; scrim.setAttribute('aria-hidden', 'true');
    drawer = document.createElement('aside');
    drawer.className = 'cd'; drawer.id = 'cartDrawer';
    drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); drawer.setAttribute('aria-labelledby', 'cdTitle');
    drawer.setAttribute('aria-hidden', 'true'); drawer.tabIndex = -1;
    drawer.innerHTML =
        '<header class="cd-head"><h2 id="cdTitle">Tu <em>carrito</em> <span class="cd-n" id="cdN"></span></h2>'
      + '<button class="cd-close" type="button" aria-label="Cerrar carrito">' + SVG.close + '</button></header>'
      + '<div class="cd-body"><ul class="cd-lines" id="cdLines"></ul>'
      + '<div class="cd-empty" id="cdEmpty" hidden>'
      +   '<svg viewBox="0 0 140 130" fill="none" aria-hidden="true"><ellipse cx="70" cy="118" rx="44" ry="7" fill="#B82A58" opacity=".12"/>'
      +   '<path d="M28 44h84l-7 64a8 8 0 0 1-8 7H43a8 8 0 0 1-8-7l-7-64Z" fill="#FFFFFF" stroke="#EF4479" stroke-width="5" stroke-linejoin="round"/>'
      +   '<path d="M50 44V36a20 20 0 0 1 40 0v8" stroke="#EF4479" stroke-width="5" stroke-linecap="round"/>'
      +   '<path d="M70 96c-11-8-15-13-15-18 0-5 4-8 8-8 3 0 6 2 7 5 1-3 4-5 7-5 4 0 8 3 8 8 0 5-4 10-15 18Z" fill="#FBC9D9"/>'
      +   '<path d="M118 14c1 7 4 10 11 11-7 1-10 4-11 11-1-7-4-10-11-11 7-1 10-4 11-11Z" fill="#F7D08A"/>'
      +   '<path d="M20 22c1 5 3 7 8 8-5 1-7 3-8 8-1-5-3-7-8-8 5-1 7-3 8-8Z" fill="#EF4479"/></svg>'
      +   '<h3>Tu carrito está esperando <em>algo lindo</em></h3>'
      +   '<p>Aún no agregaste productos. Date una vuelta por la tienda y llévate tus favoritos.</p>'
      +   '<a class="btn btn-primary" href="shop.html">Explorar la tienda</a>'
      +   '<a class="cd-wl" id="cdWl" href="wishlist" hidden>Ver mis favoritos</a>'
      + '</div></div>'
      + '<footer class="cd-foot" id="cdFoot">'
      +   '<div class="cd-sum"><span>Subtotal <small id="cdItems"></small></span><b id="cdSub"></b></div>'
      +   '<p class="cd-note">Precios de referencia. Confirmaremos precio, disponibilidad y envío al procesar tu pedido.</p>'
      +   '<div class="cd-cta"><a class="btn btn-primary" href="cart">Ver carrito</a>'
      +   '<button class="btn btn-secondary cd-continue" type="button">Continuar comprando</button></div>'
      + '</footer>';
    document.body.appendChild(scrim); document.body.appendChild(drawer);
    list = drawer.querySelector('#cdLines'); empty = drawer.querySelector('#cdEmpty'); foot = drawer.querySelector('#cdFoot');
    drawer.querySelector('.cd-close').addEventListener('click', close);
    drawer.querySelector('.cd-continue').addEventListener('click', close);
    scrim.addEventListener('click', close);
    M.bindCartLines(list);
    drawer.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') trap(e);
    });
  }
  function focusables() {
    return [].filter.call(drawer.querySelectorAll('a[href],button:not([disabled]),input,[tabindex="0"]'), function (el) { return el.offsetParent !== null && !el.closest('[hidden]'); });
  }
  function trap(e) {
    var f = focusables(); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function render(highlightId) {
    var lines = Cart.lines(), n = Cart.count();
    list.innerHTML = lines.map(lineHTML).join('');
    empty.hidden = !!lines.length; foot.hidden = !lines.length; list.hidden = !lines.length;
    drawer.querySelector('#cdWl').hidden = !M.Wishlist.count();
    drawer.querySelector('#cdN').textContent = n ? '(' + n + ')' : '';
    drawer.querySelector('#cdItems').textContent = n ? '· ' + n + (n === 1 ? ' artículo' : ' artículos') : '';
    drawer.querySelector('#cdSub').innerHTML = totals(lines).map(esc).join('<br>');
    if (highlightId) {
      var li = list.querySelector('[data-line="' + (window.CSS && CSS.escape ? CSS.escape(highlightId) : highlightId) + '"]');
      if (li) { li.classList.add('is-added'); list.parentNode.scrollTop = 0; }   // 'new' choca con la sección .new de la homepage
    }
  }
  function setExpanded(v) { document.querySelectorAll('.icon-btn.cart').forEach(function (b) { b.setAttribute('aria-expanded', v); }); }
  function open(highlightId) {
    if (!drawer) build();
    render(highlightId);
    if (isOpen) return;
    isOpen = true; lastFocus = document.activeElement;
    if (!lastFocus || lastFocus === document.body) lastFocus = document.querySelector('.icon-btn.cart');
    drawer.setAttribute('aria-hidden', 'false'); drawer.classList.add('open'); scrim.classList.add('show');
    document.documentElement.classList.add('no-scroll'); setExpanded(true);
    setTimeout(function () { drawer.querySelector('.cd-close').focus({ preventScroll: true }); }, reduce ? 0 : 60);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    drawer.setAttribute('aria-hidden', 'true'); drawer.classList.remove('open'); scrim.classList.remove('show');
    document.documentElement.classList.remove('no-scroll'); setExpanded(false);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  M.CartUI = { open: open, close: close, isOpen: function () { return isOpen; } };

  window.addEventListener('mentarosa:cart', function (e) {
    if (!drawer) return;
    var d = e.detail || {};
    if (isOpen || d.source === 'storage') render(d.action === 'add' ? d.lineId : null);
  });
  window.addEventListener('mentarosa:wishlist', function () { if (drawer && isOpen) render(); });

  /* el icono del carrito del header abre el drawer */
  document.querySelectorAll('.icon-btn.cart').forEach(function (b) {
    b.setAttribute('aria-controls', 'cartDrawer'); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-haspopup', 'dialog');
    b.addEventListener('click', function (e) { e.preventDefault(); open(); });
  });

  /* tras agregar desde cualquier parte: abrir el drawer y resaltar la línea */
  M.addToCart = function (o, opts) {
    var r = Cart.add(o);
    if (r.ok) {
      document.querySelectorAll('.icon-btn.cart').forEach(function (b) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); });
      if (!opts || opts.open !== false) open(r.line.id);
    }
    return r;
  };

  /* =====================================================================
     SELECTOR RÁPIDO DE TALLA (tarjetas de producto)
     ===================================================================== */
  var openQuick = null;
  function closeQuick(restoreFocus) {
    if (!openQuick) return;
    var q = openQuick; openQuick = null;
    q.panel.classList.add('out');
    setTimeout(function () { if (q.panel.parentNode) q.panel.remove(); }, reduce ? 0 : 200);
    if (restoreFocus && q.trigger) q.trigger.focus();
  }
  M.quickAdd = function (p, host, trigger) {
    var sizes = p.sizes || [];
    var colors = (p.variantColors || []);
    var color = colors.filter(function (c) { return sizes.some(function (z) { return M.variantStock(p, c, z) > 0; }); })[0] || colors[0] || null;
    // sin variantes que elegir → se agrega directamente
    if (!sizes.length) { M.addToCart({ productId: p.id, color: color, qty: 1 }); return; }
    if (openQuick && openQuick.host === host) { closeQuick(true); return; }
    closeQuick(false);
    var panel = document.createElement('div');
    panel.className = 'quick-add'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Elige tu talla de ' + p.name);
    panel.innerHTML = '<div class="qa-head"><span>Elige tu talla' + (color && colors.length > 1 ? ' · ' + esc(COLORS[color].name) : '') + '</span>'
      + '<button type="button" class="qa-x" aria-label="Cerrar">' + SVG.close + '</button></div>'
      + '<div class="qa-sizes">' + sizes.map(function (z) {
          var st = M.variantStock(p, color, z);
          return '<button type="button" class="qa-s' + (st === 0 ? ' na' : '') + '" data-s="' + esc(z) + '"' + (st === 0 ? ' disabled aria-label="Talla ' + esc(z) + ' agotada"' : '') + '>' + esc(z) + '</button>';
        }).join('') + '</div>'
      + (colors.length > 1 ? '<a class="qa-more" href="' + M.productUrl(p) + '">Ver más colores</a>' : '');
    host.appendChild(panel);
    openQuick = { panel: panel, host: host, trigger: trigger };
    var first = panel.querySelector('.qa-s:not([disabled])'); if (first) first.focus({ preventScroll: true });
    panel.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (e.target.closest('.qa-more')) { location.href = e.target.closest('.qa-more').href; return; }
      if (e.target.closest('.qa-x')) return closeQuick(true);
      var b = e.target.closest('.qa-s'); if (!b || b.disabled) return;
      b.classList.add('picked');
      var r = M.addToCart({ productId: p.id, color: color, size: b.dataset.s, qty: 1 });
      if (!r.ok && r.reason === 'max') M.say('Ya tienes el máximo disponible de ' + p.name + ' en talla ' + b.dataset.s + '.');
      closeQuick(false);
    });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeQuick(true); } });
  };
  document.addEventListener('click', function (e) { if (openQuick && !openQuick.panel.contains(e.target) && e.target !== openQuick.trigger && !openQuick.trigger.contains(e.target)) closeQuick(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openQuick) closeQuick(true); });
})();
