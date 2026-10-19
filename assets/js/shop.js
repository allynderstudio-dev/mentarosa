/* =====================================================================
   Mentarosa · Shop Page
   Filtros combinables + ordenamiento sobre el catálogo compartido,
   estado sincronizado con la URL y drawer de filtros en mobile.

   Parámetros de URL (todos opcionales, se pueden combinar):
     ?cat=tops,zapatos  &talla=M,38  &color=rosa,crema
     &min=20&max=45     &disp=1      &orden=precio-asc|precio-desc|nombre|novedades
   ===================================================================== */
(function () {
  var M = window.Mentarosa, esc = M.esc;
  var CATALOG = M.catalog, COLORS = M.colors;
  var CATS = [['tops', 'Tops'], ['pantalones', 'Pantalones'], ['chaquetas', 'Chaquetas'], ['zapatos', 'Zapatos']];
  var CAT_NAME = {}; CATS.forEach(function (c) { CAT_NAME[c[0]] = c[1]; });
  var SORTS = ['novedades', 'precio-asc', 'precio-desc', 'nombre'];
  var LETTERS = ['XS', 'S', 'M', 'L', 'XL'];

  var slug = function (s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  CATALOG.forEach(function (p) { p.catSlug = slug(p.cat); });

  /* ---------- valores disponibles (derivados del catálogo) ---------- */
  var allSizes = [], allColors = [];
  CATALOG.forEach(function (p) {
    (p.sizes || []).forEach(function (s) { if (allSizes.indexOf(s) < 0) allSizes.push(s); });
    (p.colors || []).forEach(function (c) { if (allColors.indexOf(c) < 0) allColors.push(c); });
  });
  var letterSizes = LETTERS.filter(function (s) { return allSizes.indexOf(s) > -1; });
  var numSizes = allSizes.filter(function (s) { return LETTERS.indexOf(s) < 0; }).sort(function (a, b) { return a - b; });
  allColors = Object.keys(COLORS).filter(function (c) { return allColors.indexOf(c) > -1; });
  var PMIN = Math.floor(Math.min.apply(null, CATALOG.map(function (p) { return p.usd; })));
  var PMAX = Math.ceil(Math.max.apply(null, CATALOG.map(function (p) { return p.usd; })));

  function defaults(orden) { return { cat: [], talla: [], color: [], min: PMIN, max: PMAX, disp: false, orden: orden || 'novedades' }; }
  function clone(s) { return { cat: s.cat.slice(), talla: s.talla.slice(), color: s.color.slice(), min: s.min, max: s.max, disp: s.disp, orden: s.orden }; }

  /* ---------- URL <-> estado ---------- */
  function fromURL() {
    var q = new URLSearchParams(location.search), s = defaults();
    var list = function (k, valid) { return (q.get(k) || '').split(',').map(function (v) { return v.trim(); }).filter(function (v) { return valid.indexOf(v) > -1; }); };
    s.cat = list('cat', CATS.map(function (c) { return c[0]; }));
    s.talla = list('talla', allSizes);
    s.color = list('color', allColors);
    var mn = parseFloat(q.get('min')), mx = parseFloat(q.get('max'));
    if (!isNaN(mn)) s.min = Math.min(Math.max(mn, PMIN), PMAX);
    if (!isNaN(mx)) s.max = Math.max(Math.min(mx, PMAX), PMIN);
    if (s.min > s.max) { var t = s.min; s.min = s.max; s.max = t; }
    s.disp = q.get('disp') === '1';
    if (SORTS.indexOf(q.get('orden')) > -1) s.orden = q.get('orden');
    return s;
  }
  function toURL(s) {
    var q = new URLSearchParams();
    if (s.cat.length) q.set('cat', s.cat.join(','));
    if (s.talla.length) q.set('talla', s.talla.join(','));
    if (s.color.length) q.set('color', s.color.join(','));
    if (s.min > PMIN) q.set('min', s.min);
    if (s.max < PMAX) q.set('max', s.max);
    if (s.disp) q.set('disp', '1');
    if (s.orden !== 'novedades') q.set('orden', s.orden);
    var qs = q.toString().replace(/%2C/g, ',');
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  /* ---------- filtrado y orden ---------- */
  function match(p, s, ignore) {
    if (ignore !== 'cat' && s.cat.length && s.cat.indexOf(p.catSlug) < 0) return false;
    if (s.talla.length && !(p.sizes || []).some(function (z) { return s.talla.indexOf(z) > -1; })) return false;
    if (s.color.length && !(p.colors || []).some(function (c) { return s.color.indexOf(c) > -1; })) return false;
    if (p.usd < s.min || p.usd > s.max) return false;
    if (s.disp && p.stock === false) return false;
    return true;
  }
  var collator = new Intl.Collator('es', { sensitivity: 'base' });
  function results(s) {
    var list = CATALOG.filter(function (p) { return match(p, s); });
    var by = {
      'novedades': function (a, b) { return (b.added || '').localeCompare(a.added || ''); },
      'precio-asc': function (a, b) { return a.usd - b.usd; },
      'precio-desc': function (a, b) { return b.usd - a.usd; },
      'nombre': function (a, b) { return collator.compare(a.name, b.name); }
    }[s.orden];
    return list.sort(by);
  }
  function activeCount(s) {
    return s.cat.length + s.talla.length + s.color.length + ((s.min > PMIN || s.max < PMAX) ? 1 : 0) + (s.disp ? 1 : 0);
  }
  var plural = function (n) { return n === 1 ? 'producto' : 'productos'; };
  var usd = function (n) { return '$' + n; };

  /* ---------- construir controles ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var fCat = $('fCat'), fSize = $('fSize'), fColor = $('fColor'), pMin = $('pMin'), pMax = $('pMax'), fRange = $('fRange'), fStock = $('fStock');

  fCat.innerHTML = CATS.map(function (c) {
    return '<label class="f-check"><input type="checkbox" name="cat" value="' + c[0] + '"><span class="t">' + c[1] + '</span><span class="n" data-n="' + c[0] + '">0</span></label>';
  }).join('');
  var pill = function (k, v, label, extra) {
    return '<button type="button" class="f-pill' + (extra || '') + '" data-k="' + k + '" data-v="' + esc(v) + '" aria-pressed="false">' + label + '</button>';
  };
  fSize.innerHTML =
    (letterSizes.length ? '<p class="f-sub">Ropa</p><div class="f-pills">' + letterSizes.map(function (s) { return pill('talla', s, s); }).join('') + '</div>' : '') +
    (numSizes.length ? '<p class="f-sub">Calzado</p><div class="f-pills">' + numSizes.map(function (s) { return pill('talla', s, s); }).join('') + '</div>' : '');
  fColor.innerHTML = allColors.map(function (c) {
    return pill('color', c, '<i style="--c:' + COLORS[c].hex + '"></i>' + esc(COLORS[c].name), ' f-color');
  }).join('');
  [pMin, pMax].forEach(function (r) { r.min = PMIN; r.max = PMAX; r.step = 1; });

  /* ---------- leer / escribir la UI ---------- */
  var applied = fromURL(), draft = null, drawerOpen = false;

  function readUI() {
    var s = defaults(applied.orden);
    fCat.querySelectorAll('input:checked').forEach(function (i) { s.cat.push(i.value); });
    document.querySelectorAll('#fControls .f-pill[aria-pressed="true"]').forEach(function (b) { s[b.dataset.k].push(b.dataset.v); });
    s.min = Math.min(+pMin.value, +pMax.value); s.max = Math.max(+pMin.value, +pMax.value);
    s.disp = fStock.checked;
    return s;
  }
  function writeUI(s) {
    fCat.querySelectorAll('input').forEach(function (i) { i.checked = s.cat.indexOf(i.value) > -1; });
    document.querySelectorAll('#fControls .f-pill').forEach(function (b) { b.setAttribute('aria-pressed', s[b.dataset.k].indexOf(b.dataset.v) > -1); });
    pMin.value = s.min; pMax.value = s.max; paintRange();
    fStock.checked = s.disp;
    $('sort').value = s.orden;
  }
  function paintRange() {
    var a = Math.min(+pMin.value, +pMax.value), b = Math.max(+pMin.value, +pMax.value), span = PMAX - PMIN || 1;
    fRange.style.setProperty('--a', ((a - PMIN) / span * 100) + '%');
    fRange.style.setProperty('--b', ((b - PMIN) / span * 100) + '%');
    $('pMinV').textContent = usd(a); $('pMaxV').textContent = usd(b);
  }
  // número de productos por categoría con el resto de filtros aplicados
  function paintCounts(s) {
    CATS.forEach(function (c) {
      var n = CATALOG.filter(function (p) { return p.catSlug === c[0] && match(p, s, 'cat'); }).length;
      var el = fCat.querySelector('[data-n="' + c[0] + '"]'); el.textContent = n;
      el.closest('.f-check').classList.toggle('zero', n === 0);
    });
  }

  /* ---------- pintar resultados ---------- */
  var grid = $('shopGrid'), empty = $('empty');
  function render() {
    var list = results(applied);
    grid.innerHTML = list.map(function (p, i) { return M.productCard(p, { reveal: false, style: '--i:' + Math.min(i, 11) }); }).join('');
    grid.hidden = !list.length; empty.hidden = !!list.length;
    $('count').innerHTML = '<b>' + list.length + '</b> ' + plural(list.length);
    var n = activeCount(applied);
    $('fBadge').textContent = n || '';
    $('fClearSide').hidden = !n;
    paintChips();
    paintCounts(applied);
    paintQuick();
    paintNav();
  }
  function paintChips() {
    var s = applied, out = [];
    var chip = function (label, k, v) { out.push('<button type="button" class="chip-x" data-k="' + k + '" data-v="' + esc(v) + '" aria-label="Quitar filtro ' + esc(label) + '">' + esc(label) + '<i aria-hidden="true">×</i></button>'); };
    s.cat.forEach(function (c) { chip(CAT_NAME[c], 'cat', c); });
    s.talla.forEach(function (t) { chip('Talla ' + t, 'talla', t); });
    s.color.forEach(function (c) { chip(COLORS[c].name, 'color', c); });
    if (s.min > PMIN || s.max < PMAX) chip(usd(s.min) + ' – ' + usd(s.max), 'precio', '');
    if (s.disp) chip('Solo disponibles', 'disp', '');
    if (out.length) out.push('<button type="button" class="chip-clear" data-k="all">Limpiar filtros</button>');
    $('chips').innerHTML = out.join('');
  }
  function paintQuick() {
    var one = applied.cat.length === 1 ? applied.cat[0] : (applied.cat.length ? null : '');
    document.querySelectorAll('#quick button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.cat === one); });
  }
  // resalta en el header la categoría activa (sin tocar su diseño)
  function paintNav() {
    document.querySelectorAll('.nav a').forEach(function (a) {
      var m = (a.getAttribute('href') || '').match(/[?&]cat=([^&]+)/);
      var on = !!m && applied.cat.length === 1 && applied.cat[0] === m[1];
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function commit(s) { applied = clone(s); toURL(applied); writeUI(applied); render(); }

  /* ---------- eventos de los filtros ---------- */
  function onChange() {
    paintRange();
    var s = readUI();
    if (drawerOpen) { draft = s; paintCounts(s); paintApply(s); }   // mobile: se aplica con "Ver productos"
    else commit(s);                                                    // desktop: en vivo
  }
  fCat.addEventListener('change', onChange);
  fStock.addEventListener('change', onChange);
  [pMin, pMax].forEach(function (r) { r.addEventListener('input', onChange); });
  $('fControls').addEventListener('click', function (e) {
    var b = e.target.closest('.f-pill'); if (!b) return;
    b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); onChange();
  });
  $('sort').addEventListener('change', function (e) { var s = clone(applied); s.orden = e.target.value; commit(s); });
  $('fClearSide').addEventListener('click', function () { commit(defaults(applied.orden)); });
  $('emptyClear').addEventListener('click', function () { commit(defaults(applied.orden)); });
  $('chips').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var s = clone(applied), k = b.dataset.k, v = b.dataset.v;
    if (k === 'all') s = defaults(applied.orden);
    else if (k === 'precio') { s.min = PMIN; s.max = PMAX; }
    else if (k === 'disp') s.disp = false;
    else s[k] = s[k].filter(function (x) { return x !== v; });
    commit(s);
  });
  $('quick').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var s = clone(applied); s.cat = b.dataset.cat ? [b.dataset.cat] : []; commit(s);
    var top = $('resultados').getBoundingClientRect().top + window.scrollY - 96;
    if (window.scrollY < top - 40) window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
  });

  /* ---------- drawer (mobile/tablet) ---------- */
  var filters = $('filters'), scrim = $('scrim'), openBtn = $('fOpen'), closeBtn = $('fClose'), applyBtn = $('fApply');
  var mq = window.matchMedia('(max-width: 900px)');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function paintApply(s) {
    var n = results(s).length;
    applyBtn.textContent = n ? 'Ver ' + n + ' ' + plural(n) : 'Sin resultados';
  }
  function openDrawer() {
    drawerOpen = true; draft = clone(applied); writeUI(draft); paintApply(draft);
    filters.classList.add('open'); scrim.classList.add('show');
    filters.setAttribute('role', 'dialog'); filters.setAttribute('aria-modal', 'true');
    openBtn.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('no-scroll');
    closeBtn.focus();
  }
  function closeDrawer(keep) {
    if (!drawerOpen) return;
    drawerOpen = false;
    if (!keep) { writeUI(applied); paintCounts(applied); }      // cerrar sin aplicar descarta los cambios
    filters.classList.remove('open'); scrim.classList.remove('show');
    filters.removeAttribute('role'); filters.removeAttribute('aria-modal');
    openBtn.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('no-scroll');
    openBtn.focus();
  }
  openBtn.addEventListener('click', openDrawer);
  closeBtn.addEventListener('click', function () { closeDrawer(false); });
  scrim.addEventListener('click', function () { closeDrawer(false); });
  applyBtn.addEventListener('click', function () { var s = readUI(); closeDrawer(true); commit(s); });
  $('fClearDrawer').addEventListener('click', function () { writeUI(defaults(applied.orden)); onChange(); });
  document.addEventListener('keydown', function (e) {
    if (!drawerOpen) return;
    if (e.key === 'Escape') closeDrawer(false);
    if (e.key === 'Tab') {   // mantener el foco dentro del drawer
      var f = filters.querySelectorAll('button:not([hidden]),input,select,a[href]');
      f = [].filter.call(f, function (el) { return el.offsetParent !== null; });
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function () { if (!mq.matches) closeDrawer(false); });

  /* ---------- inicio ---------- */
  M.bindProductActions(grid);
  writeUI(applied); toURL(applied); render();
  window.addEventListener('popstate', function () { applied = fromURL(); writeUI(applied); render(); });
})();
