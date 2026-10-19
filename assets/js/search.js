/* =====================================================================
   Mentarosa · Buscador del header
   - Se abre con el botón de búsqueda, Cmd/Ctrl + K o la tecla "/"
   - Resultados en vivo desde el catálogo (misma lógica que la tienda)
   - Enter abre el producto resaltado o la tienda con ?q=<búsqueda>
   Depende de: catalog.js, store.js, site.js
   ===================================================================== */
(function () {
  var M = window.Mentarosa, esc = M.esc;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MAX = 6;
  var QUICK = [['Tops', 'shop.html?cat=tops'], ['Pantalones', 'shop.html?cat=pantalones'], ['Chaquetas', 'shop.html?cat=chaquetas'],
               ['Zapatos', 'shop.html?cat=zapatos'], ['Novedades', 'shop.html?orden=novedades']];
  var SVG = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.8-3.8"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    img: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="9" width="36" height="30" rx="6"/><circle cx="17" cy="20" r="3.5"/><path d="m8 36 11-10 8 7 6-5 9 8"/></svg>'
  };

  var root, input, body, scrim, lastFocus = null, isOpen = false, active = -1, results = [];

  function build() {
    scrim = document.createElement('div'); scrim.className = 'srch-scrim'; scrim.setAttribute('aria-hidden', 'true');
    root = document.createElement('div');
    root.className = 'srch'; root.id = 'siteSearch';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Buscar productos');
    root.innerHTML =
        '<form class="srch-bar" role="search" action="shop.html" method="get">'
      +   '<span class="srch-ic">' + SVG.search + '</span>'
      +   '<input class="srch-input" id="srchInput" name="q" type="search" autocomplete="off" spellcheck="false" maxlength="60" '
      +     'placeholder="Busca tops, jeans, tenis, rosa…" aria-label="Buscar productos" role="combobox" aria-expanded="false" aria-controls="srchList" aria-autocomplete="list">'
      +   '<kbd class="srch-kbd" aria-hidden="true">Esc</kbd>'
      +   '<button class="srch-close" type="button" aria-label="Cerrar búsqueda">' + SVG.close + '</button>'
      + '</form>'
      + '<div class="srch-body" id="srchBody" aria-live="polite"></div>';
    document.body.appendChild(scrim); document.body.appendChild(root);
    input = root.querySelector('#srchInput'); body = root.querySelector('#srchBody');

    input.addEventListener('input', function () { active = -1; render(); });
    input.addEventListener('keydown', onKey);
    root.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      if (active > -1 && results[active]) return go(M.productUrl(results[active]));
      var q = input.value.trim();
      go(q ? 'shop.html?q=' + encodeURIComponent(q) : 'shop.html');
    });
    root.querySelector('.srch-close').addEventListener('click', close);
    scrim.addEventListener('click', close);
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') trap(e);
    });
    body.addEventListener('mousemove', function (e) {
      var o = e.target.closest('.srch-opt'); if (!o) return;
      var i = +o.dataset.i; if (i !== active) { active = i; paintActive(); }
    });
  }

  // resalta la parte del nombre que coincide (sin distinguir mayúsculas)
  function highlight(name, q) {
    var safe = esc(name), words = q.trim().split(/\s+/).filter(function (w) { return w.length > 1; });
    if (!words.length) return safe;
    var re = new RegExp('(' + words.map(function (w) { return esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi');
    return safe.replace(re, '<mark>$1</mark>');
  }
  function thumb(p) {
    var src = M.imagesOf(p)[0];
    return '<span class="srch-thumb" style="--g:' + p.bg + '"><span class="srch-ph">' + SVG.img + '</span>'
      + '<img class="' + (p.fit === 'cutout' ? 'cutout' : '') + '" src="' + esc(src) + '" alt="" loading="lazy" onerror="this.remove()"></span>';
  }
  function optionHTML(p, i, q) {
    var tag = p.stock === false ? '<span class="srch-tag out">Agotado</span>' : p.tag === 'new' ? '<span class="srch-tag">Nuevo</span>' : p.tag === 'best' ? '<span class="srch-tag best">Bestseller</span>' : '';
    return '<li><a class="srch-opt" id="srchOpt' + i + '" role="option" aria-selected="false" data-i="' + i + '" href="' + M.productUrl(p) + '">'
      + thumb(p)
      + '<span class="srch-info"><span class="srch-name">' + highlight(p.name, q) + '</span>'
      + '<span class="srch-meta">' + esc(p.cat) + ' · ' + M.money(p.price.amount, p.price.cur) + '</span></span>'
      + tag + '<span class="srch-go">' + SVG.arrow + '</span></a></li>';
  }
  function quickHTML(title) {
    return '<p class="srch-label">' + title + '</p><div class="srch-chips">'
      + QUICK.map(function (c) { return '<a class="srch-chip" href="' + c[1] + '">' + c[0] + '</a>'; }).join('') + '</div>';
  }

  function render() {
    var q = input.value.trim();
    if (!q) {
      results = M.catalog.filter(function (p) { return p.stock !== false; })
        .sort(function (a, b) { return (b.added || '').localeCompare(a.added || ''); }).slice(0, 4);
      body.innerHTML = quickHTML('Explora por categoría')
        + '<p class="srch-label">Recién llegados</p><ul class="srch-list" id="srchList" role="listbox" aria-label="Recién llegados">'
        + results.map(function (p, i) { return optionHTML(p, i, ''); }).join('') + '</ul>';
    } else {
      var all = M.searchProducts(q);
      results = all.slice(0, MAX);
      if (!all.length) {
        body.innerHTML = '<div class="srch-empty"><p class="srch-empty-t">No encontramos nada para <b>“' + esc(q) + '”</b></p>'
          + '<p class="srch-empty-s">Revisa la ortografía o prueba con otra palabra, como “jean”, “rosa” o “tenis”.</p></div>'
          + quickHTML('O explora por categoría');
      } else {
        body.innerHTML = '<p class="srch-label">' + all.length + (all.length === 1 ? ' producto' : ' productos') + '</p>'
          + '<ul class="srch-list" id="srchList" role="listbox" aria-label="Resultados">' + results.map(function (p, i) { return optionHTML(p, i, q); }).join('') + '</ul>'
          + '<a class="srch-all" href="shop.html?q=' + encodeURIComponent(q) + '">Ver ' + (all.length > MAX ? 'los ' + all.length + ' resultados' : 'resultados') + ' en la tienda' + SVG.arrow + '</a>';
      }
    }
    input.setAttribute('aria-expanded', results.length > 0);
    paintActive();
  }
  function paintActive() {
    body.querySelectorAll('.srch-opt').forEach(function (o) { o.setAttribute('aria-selected', +o.dataset.i === active); });
    var el = active > -1 && body.querySelector('#srchOpt' + active);
    if (el) { input.setAttribute('aria-activedescendant', el.id); el.scrollIntoView({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  }
  function onKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!results.length) return;
      e.preventDefault();
      var n = results.length;
      active = e.key === 'ArrowDown' ? (active + 1) % n : (active <= 0 ? n - 1 : active - 1);
      paintActive();
    }
  }
  function go(url) { location.href = url; }

  function focusables() {
    return [].filter.call(root.querySelectorAll('input,button,a[href]'), function (el) { return el.offsetParent !== null; });
  }
  function trap(e) {
    var f = focusables(); if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
  function setExpanded(v) { document.querySelectorAll('.srch-btn').forEach(function (b) { b.setAttribute('aria-expanded', v); }); }

  function open(prefill) {
    if (!root) build();
    if (M.CartUI && M.CartUI.isOpen()) M.CartUI.close();
    var header = document.querySelector('.header'); if (header) header.classList.remove('open');   // cierra el menú móvil
    if (typeof prefill === 'string') input.value = prefill;
    active = -1; render();
    if (isOpen) { input.focus(); return; }
    isOpen = true; lastFocus = document.activeElement;
    if (!lastFocus || lastFocus === document.body) lastFocus = document.querySelector('.srch-btn');
    root.classList.add('open'); scrim.classList.add('show');
    document.documentElement.classList.add('no-scroll'); setExpanded(true);
    setTimeout(function () { input.focus(); input.select(); }, reduce ? 0 : 30);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    root.classList.remove('open'); scrim.classList.remove('show');
    document.documentElement.classList.remove('no-scroll'); setExpanded(false);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  M.Search = { open: open, close: close };

  /* botón del header */
  document.querySelectorAll('.srch-btn').forEach(function (b) {
    b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-controls', 'siteSearch'); b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', function (e) { e.preventDefault(); open(); });
  });
  /* atajos: Cmd/Ctrl + K o "/" (si no estás escribiendo en otro campo) */
  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName) || (document.activeElement || {}).isContentEditable;
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); isOpen ? close() : open(); }
    else if (e.key === '/' && !typing && !isOpen) { e.preventDefault(); open(); }
  });
  /* en la tienda, el buscador se abre con la búsqueda actual */
  var current = new URLSearchParams(location.search).get('q');
  if (current) document.querySelectorAll('.srch-btn').forEach(function (b) { b.addEventListener('click', function () { if (input && !input.value) { input.value = current; render(); } }, { once: true }); });
})();
