/* =====================================================================
   Mentarosa · Ficha de producto (template único)
   ---------------------------------------------------------------------
   Lee el slug de la URL y pinta el producto desde el catálogo compartido:
     /products/<slug>            (Vercel reescribe a product.html)
     product.html?slug=<slug>    (alternativa sin reescritura)
   Variante elegida en la URL:  ?color=rosa&talla=M  (para compartir)
   ===================================================================== */
(function () {
  var M = window.Mentarosa, esc = M.esc, ICON = M.ICON, COLORS = M.colors;
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LETTERS = ['XS', 'S', 'M', 'L', 'XL'];

  function getSlug() {
    var m = location.pathname.match(/\/products\/([^\/?#]+)\/?$/);
    if (m) { try { return decodeURIComponent(m[1]).toLowerCase(); } catch (e) { return m[1]; } }
    return (new URLSearchParams(location.search).get('slug') || '').toLowerCase();
  }
  function setMeta(name, content) {
    var el = document.querySelector('meta[name="' + name + '"]');
    if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
    el.content = content;
  }
  // "Visítanos" del footer: con <base href="/"> el ancla iría a la homepage; la mantenemos en esta página
  document.querySelectorAll('a[href="#contacto-tienda"]').forEach(function (a) { a.href = location.pathname + location.search + '#contacto-tienda'; });

  var p = M.bySlug(getSlug());

  /* ---------- producto inexistente ---------- */
  if (!p) {
    $('notFound').hidden = false;
    document.title = 'Producto no encontrado · Mentarosa Boutique';
    setMeta('robots', 'noindex');
    return;
  }

  /* ---------- datos base ---------- */
  var catSlug = String(p.cat).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  var catUrl = 'shop.html?cat=' + catSlug;
  var colorOpts = (p.variantColors || []).filter(function (c) { return COLORS[c]; });
  var sizes = (p.sizes || []).slice().sort(function (a, b) {
    var ia = LETTERS.indexOf(a), ib = LETTERS.indexOf(b);
    return (ia > -1 && ib > -1) ? ia - ib : (ia > -1 ? -1 : ib > -1 ? 1 : a - b);
  });
  var soldOutAll = p.stock === false;
  var stockOf = function (color, size) { return M.variantStock(p, color, size); };
  var colorHasStock = function (c) { return sizes.length ? sizes.some(function (z) { return stockOf(c, z) > 0; }) : stockOf(c, null) > 0; };

  // estado inicial (respeta ?color= y ?talla= si son válidos)
  var q = new URLSearchParams(location.search);
  var state = { color: null, size: null, qty: 1, img: 0 };
  if (colorOpts.length) {
    state.color = colorOpts.indexOf(q.get('color')) > -1 ? q.get('color') : (colorOpts.filter(colorHasStock)[0] || colorOpts[0]);
  }
  if (sizes.indexOf(q.get('talla')) > -1) state.size = q.get('talla');

  /* ---------- SEO básico ---------- */
  document.title = p.name + ' · Mentarosa Boutique';
  setMeta('description', (p.desc || p.name) + ' · Mentarosa Boutique, San Cristóbal.');

  /* ---------- textos fijos ---------- */
  $('pdp').hidden = false;
  $('crumbCat').textContent = p.cat; $('crumbCat').href = catUrl;
  $('crumbName').textContent = p.name;
  $('iCat').textContent = p.cat; $('iCat').href = catUrl;
  $('pName').textContent = p.name;
  $('iPrice').innerHTML = M.money(p.price.amount, p.price.cur) + (p.old ? ' <s>' + M.money(p.old, p.price.cur) + '</s>' : '');
  $('iDesc').textContent = p.desc || '';
  var tagKey = soldOutAll ? 'soldout' : p.tag, tag = tagKey && M.TAGS[tagKey];
  [['iTag', 'i-tag'], ['gTag', 'g-tag']].forEach(function (t) {
    var el = $(t[0]); if (!tag) return;
    el.hidden = false; el.textContent = tag.label; el.className = t[1] + (tag.cls ? ' ' + tag.cls.trim() : '');
  });
  $('aDetails').innerHTML = (p.details || []).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') || '<li>Pronto agregaremos más detalles.</li>';
  $('aMaterial').textContent = p.material || 'Información de materiales pendiente.';
  $('aCare').innerHTML = (p.care || []).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
  $('relMore').href = catUrl; $('relMore').textContent = 'Ver más ' + p.cat.toLowerCase();

  /* ---------- galería ---------- */
  var gallery = document.querySelector('.gallery'), gMain = $('gMain'), stage = $('gStage'), thumbs = $('thumbs');
  gMain.style.setProperty('--g', p.bg);
  var images = [];
  // imagen de galería con su marco de reemplazo si la foto aún no existe
  function makeImg(src, alt, onFail) {
    var img = document.createElement('img');
    img.className = p.fit === 'cutout' ? 'cutout' : 'photo';
    img.alt = alt; img.draggable = false;
    img.onerror = onFail; img.src = src;
    return img;
  }
  function phHTML(src) { return '<div class="ph">' + ICON.img + '<b>Foto de producto</b><span>' + esc(src) + '</span></div>'; }
  function makeSlide(i) {
    var d = document.createElement('div'); d.className = 'g-slide';
    var src = images[i];
    d.appendChild(makeImg(src, p.name + ' · foto ' + (i + 1), function () { d.innerHTML = phHTML(src); }));
    return d;
  }
  function showImage(i, instant) {
    var n = images.length; state.img = (i + n) % n;
    var old = stage.querySelectorAll('.g-slide');
    var s = makeSlide(state.img); if (instant || reduce) s.style.animation = 'none';
    stage.appendChild(s);
    old.forEach(function (o) { o.classList.add('out'); setTimeout(function () { if (o.parentNode) o.remove(); }, reduce ? 0 : 420); });
    thumbs.querySelectorAll('.g-thumb').forEach(function (t, k) { t.setAttribute('aria-selected', k === state.img); t.tabIndex = k === state.img ? 0 : -1; });
    $('gCount').textContent = (state.img + 1) + ' / ' + n;
  }
  function buildGallery() {
    images = M.imagesOf(p, state.color);
    gallery.classList.toggle('single', images.length < 2);
    thumbs.innerHTML = images.map(function (src, k) {
      return '<button class="g-thumb" type="button" role="tab" style="--g:' + p.bg + '" aria-label="Ver foto ' + (k + 1) + '" data-i="' + k + '">'
        + '<span class="ph-i">' + ICON.img + '</span>'
        + '<img class="' + (p.fit === 'cutout' ? 'cutout' : '') + '" src="' + esc(src) + '" alt="" loading="lazy" onerror="this.remove()"></button>';
    }).join('');
    showImage(Math.min(state.img, images.length - 1), true);
  }
  thumbs.addEventListener('click', function (e) { var t = e.target.closest('.g-thumb'); if (t) showImage(+t.dataset.i); });
  thumbs.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault(); showImage(state.img + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1));
    var t = thumbs.querySelector('[aria-selected="true"]'); if (t) t.focus();
  });
  $('gPrev').addEventListener('click', function (e) { e.stopPropagation(); showImage(state.img - 1); });
  $('gNext').addEventListener('click', function (e) { e.stopPropagation(); showImage(state.img + 1); });
  // deslizar en pantallas táctiles
  var x0 = null, swiped = false;
  gMain.addEventListener('pointerdown', function (e) { x0 = e.clientX; swiped = false; });
  gMain.addEventListener('pointerup', function (e) {
    if (x0 === null) return; var dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 40 && images.length > 1) { swiped = true; showImage(state.img + (dx < 0 ? 1 : -1)); }
  });

  /* ---------- visor ampliado ---------- */
  var lb = $('lightbox'), lbFig = $('lbFig'), lbIdx = 0;
  function lbShow(i) {
    var n = images.length; lbIdx = (i + n) % n;
    var src = images[lbIdx];
    lbFig.style.setProperty('--g', p.bg); lbFig.innerHTML = '';
    lbFig.appendChild(makeImg(src, p.name, function () { lbFig.innerHTML = phHTML(src); }));
    $('lbCount').textContent = (lbIdx + 1) + ' / ' + n;
  }
  function openLB() {
    if (typeof lb.showModal !== 'function') return;
    lb.classList.toggle('single', images.length < 2);
    lbShow(state.img); lb.showModal(); document.documentElement.classList.add('no-scroll');
  }
  lb.addEventListener('close', function () { document.documentElement.classList.remove('no-scroll'); showImage(lbIdx, true); $('gZoom').focus(); });
  $('gZoom').addEventListener('click', function (e) { e.stopPropagation(); openLB(); });
  gMain.addEventListener('click', function (e) { if (!swiped && !e.target.closest('button')) openLB(); });
  $('lbClose').addEventListener('click', function () { lb.close(); });
  $('lbPrev').addEventListener('click', function () { lbShow(lbIdx - 1); });
  $('lbNext').addEventListener('click', function () { lbShow(lbIdx + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') lbShow(lbIdx + 1); if (e.key === 'ArrowLeft') lbShow(lbIdx - 1); });

  /* ---------- variantes ---------- */
  var optColor = $('optColor'), optSize = $('optSize'), colorsEl = $('colors'), sizesEl = $('sizes');
  if (colorOpts.length) {
    optColor.hidden = false;
    colorsEl.innerHTML = colorOpts.map(function (c) {
      return '<button type="button" class="o-color" role="radio" data-c="' + c + '" aria-checked="false"><i style="--c:' + COLORS[c].hex + '"></i>' + esc(COLORS[c].name) + '</button>';
    }).join('');
  } else if ((p.colors || []).length) {
    $('singleColor').hidden = false;
    $('singleColorName').textContent = p.colors.map(function (c) { return COLORS[c] ? COLORS[c].name : c; }).join(' y ');
  }
  if (sizes.length) {
    optSize.hidden = false;
    sizesEl.innerHTML = sizes.map(function (z) { return '<button type="button" class="o-size" role="radio" data-s="' + esc(z) + '" aria-checked="false">' + esc(z) + '</button>'; }).join('');
  }

  var addBtn = $('addBtn'), addLabel = addBtn.querySelector('span'), msg = $('buyMsg'), qtyIn = $('qty');
  function currentStock() {
    if (soldOutAll) return 0;
    if (sizes.length && !state.size) return null;            // aún sin talla
    return stockOf(state.color, state.size);
  }
  function maxQty() { var s = currentStock(); return Math.max(1, Math.min(10, s === null ? 10 : s)); }

  function paint() {
    // colores
    colorsEl.querySelectorAll('.o-color').forEach(function (b) {
      var c = b.dataset.c, on = c === state.color, ok = colorHasStock(c);
      b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1;
      b.classList.toggle('na', !ok);
      b.setAttribute('aria-label', COLORS[c].name + (ok ? '' : ' (agotado)'));
    });
    if (state.color) $('colorName').textContent = COLORS[state.color].name;
    // tallas
    var anyChecked = false;
    sizesEl.querySelectorAll('.o-size').forEach(function (b) {
      var z = b.dataset.s, st = stockOf(state.color, z), on = z === state.size;
      if (on) anyChecked = true;
      b.setAttribute('aria-checked', on);
      b.classList.toggle('na', st === 0); b.classList.toggle('low', st > 0 && st <= 2);
      b.setAttribute('aria-label', 'Talla ' + z + (st === 0 ? ' (agotada)' : st <= 2 ? ' (últimas unidades)' : ''));
    });
    sizesEl.querySelectorAll('.o-size').forEach(function (b, k) { b.tabIndex = anyChecked ? (b.dataset.s === state.size ? 0 : -1) : (k === 0 ? 0 : -1); });
    $('sizeName').textContent = state.size || 'elige una';

    // disponibilidad
    var avail = $('iAvail'), txt, cls = '', s = currentStock();
    if (soldOutAll) { txt = 'Agotado'; cls = 'out'; }
    else if (s === null) {
      var n = sizes.filter(function (z) { return stockOf(state.color, z) > 0; }).length;
      if (n) txt = 'Disponible en ' + n + (n === 1 ? ' talla' : ' tallas') + (state.color && colorOpts.length ? ' en ' + COLORS[state.color].name.toLowerCase() : '');
      else { txt = 'Agotado' + (state.color && colorOpts.length ? ' en ' + COLORS[state.color].name.toLowerCase() : ''); cls = 'out'; }
    }
    else if (s === 0) { txt = 'Agotado en talla ' + state.size + (state.color && colorOpts.length ? ' · ' + COLORS[state.color].name : ''); cls = 'out'; }
    else if (s <= 2) { txt = s === 1 ? '¡Última unidad!' : '¡Últimas ' + s + ' unidades!'; cls = 'low'; }
    else txt = 'Disponible';
    avail.className = 'i-avail' + (cls ? ' ' + cls : ''); avail.lastChild.textContent = txt;

    // cantidad y botón
    var mq = maxQty(); state.qty = Math.min(Math.max(1, state.qty), mq);
    qtyIn.value = state.qty; qtyIn.max = mq;
    $('qMinus').disabled = state.qty <= 1; $('qPlus').disabled = state.qty >= mq || s === 0 || soldOutAll;
    var blocked = soldOutAll || s === 0 || (s === null && sizes.length && cls === 'out');
    addBtn.disabled = !!blocked;
    if (!addBtn.classList.contains('done')) addLabel.textContent = blocked ? (soldOutAll ? 'Agotado' : 'No disponible') : 'Agregar al carrito';
    $('favBtn').setAttribute('aria-pressed', M.Wishlist.has(p.id));
  }
  function syncURL() {
    var u = new URLSearchParams(location.search);
    ['color', 'talla'].forEach(function (k) { u.delete(k); });
    if (state.color && colorOpts.length > 1) u.set('color', state.color);
    if (state.size) u.set('talla', state.size);
    var qs = u.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  colorsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.o-color'); if (!b || b.dataset.c === state.color) return;
    state.color = b.dataset.c; msg.textContent = '';
    var hadGallery = p.colorImages && (p.colorImages[state.color]);
    if (hadGallery) { state.img = 0; buildGallery(); }
    paint(); syncURL();
  });
  sizesEl.addEventListener('click', function (e) {
    var b = e.target.closest('.o-size'); if (!b) return;
    state.size = b.dataset.s;
    var st = stockOf(state.color, state.size);
    msg.textContent = st === 0 ? 'La talla ' + state.size + ' está agotada' + (colorOpts.length ? ' en ' + COLORS[state.color].name.toLowerCase() : '') + '. Prueba con otra talla' + (colorOpts.length > 1 ? ' o color' : '') + '.' : '';
    paint(); syncURL();
  });
  // flechas dentro de cada grupo de opciones (patrón radiogroup)
  [colorsEl, sizesEl].forEach(function (g) {
    g.addEventListener('keydown', function (e) {
      if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].indexOf(e.key) < 0) return;
      var items = [].slice.call(g.children), i = items.indexOf(document.activeElement);
      if (i < 0) return; e.preventDefault();
      var n = items[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
      n.focus(); n.click();
    });
  });

  $('qMinus').addEventListener('click', function () { state.qty--; paint(); });
  $('qPlus').addEventListener('click', function () { state.qty++; paint(); });
  qtyIn.addEventListener('change', function () { state.qty = parseInt(qtyIn.value, 10) || 1; paint(); });

  $('favBtn').addEventListener('click', function () { M.toggleWish(p, $('favBtn')); });
  window.addEventListener('mentarosa:wishlist', function () { $('favBtn').setAttribute('aria-pressed', M.Wishlist.has(p.id)); });

  addBtn.addEventListener('click', function () {
    if (addBtn.disabled) return;
    if (sizes.length && !state.size) {
      msg.textContent = 'Elige tu talla para continuar.';
      optSize.classList.remove('shake'); void optSize.offsetWidth; optSize.classList.add('shake');
      var first = sizesEl.querySelector('.o-size:not(.na)'); if (first) first.focus();
      return;
    }
    var st = currentStock(); if (!st) return;
    // Carrito central (store.js): una línea por producto + color + talla. No hay checkout ni pago.
    var r = M.addToCart({ productId: p.id, color: colorOpts.length ? state.color : null, size: state.size, qty: state.qty });
    if (!r.ok) {
      msg.textContent = r.reason === 'max' ? 'Ya tienes en tu carrito todas las unidades disponibles de esta variante (' + r.max + ').' : 'No pudimos agregar este producto. Revisa la talla y el color.';
      return;
    }
    msg.textContent = r.clamped ? 'Agregamos ' + r.added + (r.added === 1 ? ' unidad' : ' unidades') + ': es lo disponible para esta variante.' : '';
    addBtn.classList.add('done'); addLabel.textContent = 'Agregado';
    setTimeout(function () { addBtn.classList.remove('done'); paint(); }, 1600);
  });

  /* ---------- relacionados: misma categoría primero ---------- */
  var others = M.catalog.filter(function (x) { return x.id !== p.id; });
  var byNew = function (a, b) { return (b.added || '').localeCompare(a.added || ''); };
  var rel = others.filter(function (x) { return x.cat === p.cat; }).sort(byNew)
    .concat(others.filter(function (x) { return x.cat !== p.cat; }).sort(byNew)).slice(0, 4);
  var relGrid = $('relGrid');
  relGrid.innerHTML = rel.map(function (x, i) { return M.productCard(x, { reveal: false, style: '--i:' + i }); }).join('');
  M.bindProductActions(relGrid);

  /* ---------- inicio ---------- */
  buildGallery(); paint();
})();
