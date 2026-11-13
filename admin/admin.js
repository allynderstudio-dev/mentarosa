/* =====================================================================
   Dashboard de productos (plantilla de la agencia)
   Vistas:  #/            lista con búsqueda y filtro por categoría
            #/nuevo       crear producto
            #/p/<id>      editar producto y sus fotos
   Las fotos se comprimen en el navegador (WebP, máx. 1600 px) antes de subir,
   así cada una pesa ~100–250 KB en R2.
   ===================================================================== */
(function () {
  'use strict';
  var COLORS = window.MENTAROSA_COLORS || {};
  var MAX_SIDE = 1600, QUALITY = 0.82;
  var DEFAULT_BGS = ['#FDE6EE,#FBC9D9', '#FFF8EA,#FCEBC8', '#F4D5EA,#FDE6EE', '#FCEBC8,#FFD6C7', '#FFF4F7,#FDE6EE', '#FBC9D9,#F4D5EA', '#FFD6C7,#FCEBC8'];

  var app = document.getElementById('app');
  var state = { me: null, products: [], q: '', cat: '' };
  var leaveGuard = null;    // función que devuelve true si hay cambios sin guardar

  /* ---------- utilidades ---------- */
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n, cur) { return cur === 'USD' ? '$' + Number(n).toFixed(2) : Number(n).toLocaleString('es-CO') + ' ' + (cur || 'pesos'); }
  function slugify(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function bgCss(pair) { return 'linear-gradient(160deg,' + pair + ')'; }
  function bgPair(css) { var m = /^linear-gradient\(160deg,(#[0-9a-fA-F]{6},#[0-9a-fA-F]{6})\)$/.exec(css || ''); return m ? m[1].toUpperCase() : null; }

  var toastEl = document.getElementById('toast'), toastT;
  function toast(msg, bad) {
    toastEl.textContent = msg; toastEl.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.className = 'toast' + (bad ? ' bad' : ''); }, bad ? 4500 : 2400);
  }
  function confirmBox(title, text, yes) {
    var d = document.getElementById('confirm');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmText').textContent = text;
    document.getElementById('confirmYes').textContent = yes || 'Eliminar';
    return new Promise(function (resolve) {
      d.returnValue = '';
      d.addEventListener('close', function h() { d.removeEventListener('close', h); resolve(d.returnValue === 'yes'); });
      d.showModal();
    });
  }

  function api(method, path, body, headers) {
    var opts = { method: method, headers: Object.assign({ 'X-Admin': '1' }, headers || {}), credentials: 'same-origin' };
    if (body !== undefined) {
      if (body instanceof Blob) opts.body = body;
      else { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
    }
    return fetch('/api/admin/' + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.status === 401) { location.href = '/admin/login?next=' + encodeURIComponent('/admin/' + location.hash); throw new Error('Tu sesión expiró.'); }
        if (!r.ok) throw new Error(data.error || 'Error ' + r.status);
        return data;
      });
    });
  }

  /* ---------- compresión de imágenes en el navegador ---------- */
  function loadBitmap(file) {
    if (window.createImageBitmap) return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return loadImg(file); });
    return loadImg(file);
  }
  function loadImg(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); res(img); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('No se pudo leer ' + file.name)); };
      img.src = url;
    });
  }
  function toBlob(canvas, type, q) { return new Promise(function (res) { canvas.toBlob(res, type, q); }); }
  function compress(file) {
    return loadBitmap(file).then(function (img) {
      var w = img.width, h = img.height, k = Math.min(1, MAX_SIDE / Math.max(w, h));
      var cw = Math.round(w * k), ch = Math.round(h * k);
      var c = document.createElement('canvas'); c.width = cw; c.height = ch;
      c.getContext('2d').drawImage(img, 0, 0, cw, ch);
      return toBlob(c, 'image/webp', QUALITY).then(function (b) {
        if (b && b.type === 'image/webp') return b;
        return toBlob(c, 'image/jpeg', 0.85);        // navegadores sin WebP
      }).then(function (blob) {
        // si el original ya era más liviano y del tamaño correcto, se sube tal cual
        if (k === 1 && /^image\/(jpeg|webp)$/.test(file.type) && file.size <= blob.size) blob = file;
        return { blob: blob, width: cw, height: ch };
      });
    });
  }

  /* ---------- enrutado ---------- */
  function route() {
    var h = location.hash.replace(/^#/, '') || '/';
    var m = /^\/p\/(.+)$/.exec(h);
    if (m) return editView(decodeURIComponent(m[1]));
    if (h === '/nuevo') return editView(null);
    if (h === '/usuarios') return usersView();
    if (h === '/cuenta') return accountView();
    return listView();
  }
  window.addEventListener('hashchange', function (e) {
    if (leaveGuard && leaveGuard() && !window.confirm('Tienes cambios sin guardar. ¿Salir de todas formas?')) {
      history.replaceState(null, '', e.oldURL.slice(e.oldURL.indexOf('#'))); return;
    }
    leaveGuard = null; route();
  });
  // la rueda del ratón sobre un campo numérico con foco cambiaría el precio sin querer
  document.addEventListener('wheel', function (e) { var a = document.activeElement; if (a && a.type === 'number' && e.target === a) a.blur(); }, { passive: true });
  window.addEventListener('beforeunload', function (e) { if (leaveGuard && leaveGuard()) { e.preventDefault(); e.returnValue = ''; } });

  /* =====================================================================
     LISTA
     ===================================================================== */
  function listView() {
    document.title = 'Productos · Mentarosa';
    var cats = state.me.categories;
    app.innerHTML =
      '<div class="list-head"><div><h1>Productos</h1><p id="count"></p></div>' +
      '<a class="btn" href="#/nuevo">+ Nuevo producto</a></div>' +
      '<div class="filters"><input type="search" id="q" placeholder="Buscar por nombre…" aria-label="Buscar" value="' + esc(state.q) + '">' +
      '<select id="cat" aria-label="Categoría"><option value="">Todas las categorías</option>' +
      cats.map(function (c) { return '<option' + (c === state.cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<div class="cards" id="cards"></div>';
    var q = document.getElementById('q'), cat = document.getElementById('cat');
    q.addEventListener('input', function () { state.q = q.value; paint(); });
    cat.addEventListener('change', function () { state.cat = cat.value; paint(); });
    paint();
    function paint() {
      var nq = norm(state.q);
      var list = state.products.filter(function (p) {
        return (!state.cat || p.category === state.cat) && (!nq || norm(p.name + ' ' + p.slug).indexOf(nq) > -1);
      });
      var pub = state.products.filter(function (p) { return p.published; }).length;
      document.getElementById('count').textContent = state.products.length + ' productos · ' + pub + ' publicados';
      var cards = document.getElementById('cards');
      if (!list.length) { cards.outerHTML = '<div class="empty" id="cards">' + (state.products.length ? 'Ningún producto coincide con la búsqueda.' : 'Todavía no hay productos. Crea el primero.') + '</div>'; return; }
      if (cards.className !== 'cards') { cards.outerHTML = '<div class="cards" id="cards"></div>'; cards = document.getElementById('cards'); }
      cards.innerHTML = list.map(function (p) {
        var img = p.images[0];
        var badges = (p.published ? '' : '<span class="badge draft">Borrador</span>') +
          (p.in_stock ? '' : '<span class="badge out">Agotado</span>') +
          (p.show_home ? '<span class="badge home">Inicio</span>' : '') +
          (p.tag === 'new' ? '<span class="badge tag">Nuevo</span>' : p.tag === 'best' ? '<span class="badge tag">Más vendido</span>' : '');
        return '<a class="card" href="#/p/' + encodeURIComponent(p.id) + '">' +
          '<div class="ph" style="background:' + esc(p.bg || '') + '">' +
          (img ? '<img loading="lazy" src="' + esc(img.url) + '" alt="">' : '<span class="noimg">Sin foto</span>') +
          '<div class="badges">' + badges + '</div></div>' +
          '<div class="body"><h3>' + esc(p.name) + '</h3><div class="meta"><span>' + esc(p.category) + '</span><span>' + esc(money(p.price, p.currency)) + '</span></div></div></a>';
      }).join('');
    }
  }

  /* =====================================================================
     EDITOR
     ===================================================================== */
  function blank() {
    return { id: null, name: '', slug: '', category: state.me.categories[0] || '', description: '', details: [], material: '',
      price: '', old_price: null, currency: 'pesos', sizes: [], colors: [], inventory: {}, in_stock: true, tag: null,
      show_home: false, published: true, keywords: '', bg: bgCss(DEFAULT_BGS[Math.floor(Math.random() * DEFAULT_BGS.length)]), fit: 'photo', images: [] };
  }
  function sizesFor(category, current) {
    var out = [];
    state.products.forEach(function (p) { if (p.category === category) p.sizes.forEach(function (s) { if (out.indexOf(s) < 0) out.push(s); }); });
    (current || []).forEach(function (s) { if (out.indexOf(s) < 0) out.push(s); });
    var L = ['XS', 'S', 'M', 'L', 'XL'];
    if (!out.length) out = category === 'Tops' ? L.slice() : ['Única'];
    return out.sort(function (a, b) {
      var ia = L.indexOf(a), ib = L.indexOf(b);
      if (ia > -1 || ib > -1) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return (parseFloat(a) - parseFloat(b)) || String(a).localeCompare(String(b));
    });
  }
  function bgOptions(current) {
    var set = DEFAULT_BGS.slice();
    state.products.forEach(function (p) { var b = bgPair(p.bg); if (b && set.indexOf(b) < 0) set.push(b); });
    var c = bgPair(current); if (c && set.indexOf(c) < 0) set.push(c);
    return set;
  }

  function editView(id) {
    var original = id ? state.products.filter(function (p) { return p.id === id; })[0] : blank();
    if (!original) { app.innerHTML = '<div class="empty">Producto no encontrado. <a href="#/">Volver a la lista</a></div>'; return; }
    var p = JSON.parse(JSON.stringify(original));
    var isNew = !p.id, slugTouched = !!p.id, queue = [], busy = false;
    var snapshot = JSON.stringify(formData());
    document.title = (isNew ? 'Nuevo producto' : p.name) + ' · Mentarosa';

    function formData() {
      return { name: p.name, slug: p.slug, category: p.category, description: p.description, details: p.details, material: p.material,
        price: p.price, old_price: p.old_price, currency: p.currency, sizes: p.sizes, colors: p.colors, inventory: p.inventory,
        in_stock: p.in_stock, tag: p.tag, show_home: p.show_home, published: p.published, keywords: p.keywords, bg: p.bg, fit: p.fit };
    }
    leaveGuard = function () { return !busy && (JSON.stringify(formData()) !== snapshot || queue.length > 0); };

    app.innerHTML =
      '<div class="ed-head"><div><a class="back" href="#/">← Productos</a><h1 id="title"></h1></div>' +
      (isNew ? '' : '<div class="row"><a class="btn ghost sm" target="_blank" rel="noopener" id="viewLink">Ver en la tienda ↗</a><button class="btn link" id="del">Eliminar producto</button></div>') +
      '</div>' +
      '<div id="err"></div>' +
      '<div class="ed-grid"><div>' +
        '<section class="panel"><h2>Información</h2>' +
          '<label class="field"><span>Nombre</span><input type="text" id="f-name" maxlength="120" required></label>' +
          '<label class="field"><span>Dirección (slug)</span><div class="prefix slug"><input type="text" id="f-slug" maxlength="80"></div><small>Se genera desde el nombre. Si cambias el de un producto publicado, el enlace anterior deja de funcionar.</small></label>' +
          '<div class="two"><label class="field"><span>Categoría</span><select id="f-category">' +
            state.me.categories.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
            '<label class="field"><span>Etiqueta</span><div class="seg" id="f-tag"><button type="button" data-v="">Ninguna</button><button type="button" data-v="new">Nuevo</button><button type="button" data-v="best">Más vendido</button></div></label></div>' +
          '<label class="field"><span>Descripción</span><textarea id="f-description" maxlength="3000" rows="4"></textarea></label>' +
          '<label class="field"><span>Detalles</span><textarea id="f-details" rows="4" placeholder="Uno por línea"></textarea><small>Uno por línea. Aparecen como viñetas en la ficha.</small></label>' +
          '<label class="field"><span>Material</span><input type="text" id="f-material" maxlength="300" placeholder="Ej.: 98% algodón, 2% elastano"></label>' +
        '</section>' +
        '<section class="panel"><h2>Precio</h2><div class="three">' +
          '<label class="field"><span>Precio</span><input type="number" id="f-price" min="0" step="any" inputmode="decimal" required></label>' +
          '<label class="field"><span>Precio anterior</span><input type="number" id="f-old" min="0" step="any" inputmode="decimal" placeholder="Opcional"></label>' +
          '<label class="field"><span>Moneda</span><select id="f-currency"><option value="pesos">Pesos (COP)</option><option value="USD">Dólares (USD)</option></select></label>' +
        '</div><small style="color:var(--ink-3);font-size:12px">El precio anterior se muestra tachado, para ofertas.</small></section>' +
        '<section class="panel"><h2>Tallas e inventario</h2>' +
          '<div class="field"><span>Tallas disponibles</span><div class="chips" id="f-sizes"></div></div>' +
          '<div class="field"><span>Unidades por talla <small style="font-weight:500">vacío = disponible · 0 = agotada · 1–2 = "últimas unidades"</small></span><div class="inv" id="f-inv"></div></div>' +
        '</section>' +
        '<section class="panel"><h2>Colores <small>para filtros y buscador</small></h2><div class="swatches" id="f-colors"></div></section>' +
      '</div><div>' +
        '<section class="panel"><h2>Fotos <small>la primera es la principal; la segunda aparece al pasar el cursor</small></h2>' +
          '<label class="drop" id="drop"><input type="file" id="files" accept="image/jpeg,image/png,image/webp,image/avif,image/heic" multiple hidden>' +
          '<b>Subir fotos</b><span>o arrástralas aquí</span><small>Se optimizan solas antes de subir (WebP, máx. 1600 px)</small></label>' +
          '<div class="photos" id="photos"></div></section>' +
        '<section class="panel"><h2>Visibilidad</h2><div class="toggles">' +
          tg('f-published', 'Publicado', 'Si lo apagas queda como borrador y no aparece en la tienda.') +
          tg('f-stock', 'Disponible', 'Apágalo para marcar el producto completo como agotado.') +
          tg('f-home', 'Mostrar en la portada', 'Sección "Recién llegados" de la página de inicio.') +
        '</div></section>' +
        '<section class="panel"><h2>Apariencia y búsqueda</h2>' +
          '<div class="field"><span>Fondo de la tarjeta</span><div class="bgs" id="f-bg"></div><small>Se ve mientras carga la foto.</small></div>' +
          '<label class="field"><span>Palabras clave</span><textarea id="f-keywords" rows="2" maxlength="600" placeholder="sinónimos: tenis zapatillas sneakers…"></textarea><small>Ayudan a que el buscador encuentre el producto.</small></label>' +
        '</section>' +
      '</div></div>' +
      '<div class="savebar"><span class="msg" id="msg"></span><div class="row">' +
        '<a class="btn ghost" href="#/">Cancelar</a><button class="btn" id="save">' + (isNew ? 'Crear producto' : 'Guardar cambios') + '</button></div></div>';

    function tg(id, title, help) { return '<label class="tg"><input type="checkbox" id="' + id + '"><span><b>' + title + '</b><small>' + help + '</small></span></label>'; }
    var $ = function (id) { return document.getElementById(id); };

    /* --- valores iniciales --- */
    $('f-name').value = p.name; $('f-slug').value = p.slug; $('f-category').value = p.category;
    $('f-description').value = p.description || ''; $('f-details').value = (p.details || []).join('\n');
    $('f-material').value = p.material || ''; $('f-price').value = p.price === '' ? '' : p.price;
    $('f-old').value = p.old_price == null ? '' : p.old_price; $('f-currency').value = p.currency;
    $('f-published').checked = p.published; $('f-stock').checked = p.in_stock; $('f-home').checked = p.show_home;
    $('f-keywords').value = p.keywords || '';
    $('title').textContent = isNew ? 'Nuevo producto' : p.name;
    if (!isNew) $('viewLink').href = '/products/' + encodeURIComponent(original.slug);

    /* --- enlaces de campos --- */
    function bind(id, key, fn) { $(id).addEventListener('input', function () { p[key] = fn ? fn(this.value) : this.value; refresh(); }); }
    bind('f-name', 'name'); bind('f-description', 'description'); bind('f-material', 'material');
    bind('f-keywords', 'keywords');
    bind('f-details', 'details', function (v) { return v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); });
    bind('f-price', 'price', function (v) { return v === '' ? '' : Number(v); });
    bind('f-old', 'old_price', function (v) { return v === '' ? null : Number(v); });
    $('f-currency').addEventListener('change', function () { p.currency = this.value; refresh(); });
    $('f-name').addEventListener('input', function () { if (!slugTouched) { p.slug = slugify(this.value); $('f-slug').value = p.slug; } $('title').textContent = this.value || 'Nuevo producto'; });
    $('f-slug').addEventListener('input', function () { slugTouched = true; p.slug = this.value; refresh(); });
    $('f-slug').addEventListener('blur', function () { p.slug = slugify(this.value || p.name); this.value = p.slug; refresh(); });
    $('f-category').addEventListener('change', function () { p.category = this.value; paintSizes(); refresh(); });
    $('f-published').addEventListener('change', function () { p.published = this.checked; refresh(); });
    $('f-stock').addEventListener('change', function () { p.in_stock = this.checked; refresh(); });
    $('f-home').addEventListener('change', function () { p.show_home = this.checked; refresh(); });

    function paintTag() { [].forEach.call($('f-tag').children, function (b) { b.setAttribute('aria-pressed', String((b.dataset.v || null) === p.tag)); }); }
    $('f-tag').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; p.tag = b.dataset.v || null; paintTag(); refresh(); });
    paintTag();

    /* tallas */
    function paintSizes() {
      var all = sizesFor(p.category, p.sizes);
      $('f-sizes').innerHTML = all.map(function (s) { return '<button type="button" class="chip" data-s="' + esc(s) + '" aria-pressed="' + (p.sizes.indexOf(s) > -1) + '">' + esc(s) + '</button>'; }).join('') +
        '<input class="chip-add" id="sizeAdd" placeholder="+ otra talla" maxlength="16" aria-label="Agregar talla">';
      $('sizeAdd').addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return; e.preventDefault();
        var v = this.value.trim(); if (!v) return;
        if (p.sizes.indexOf(v) < 0) p.sizes.push(v);
        paintSizes(); refresh(); $('sizeAdd').focus();
      });
      paintInv();
    }
    $('f-sizes').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      var s = b.dataset.s, i = p.sizes.indexOf(s);
      if (i > -1) p.sizes.splice(i, 1); else p.sizes.push(s);
      var order = sizesFor(p.category, p.sizes); p.sizes.sort(function (a, c) { return order.indexOf(a) - order.indexOf(c); });
      b.setAttribute('aria-pressed', String(i < 0)); paintInv(); refresh();
    });
    function paintInv() {
      if (!p.sizes.length) { $('f-inv').innerHTML = '<small style="color:var(--ink-3)">Elige al menos una talla.</small>'; return; }
      $('f-inv').innerHTML = p.sizes.map(function (s) {
        var k = '*|' + s, v = Object.prototype.hasOwnProperty.call(p.inventory, k) ? p.inventory[k] : '';
        return '<label>' + esc(s) + '<input type="number" min="0" max="9999" step="1" data-k="' + esc(k) + '" value="' + esc(v) + '" placeholder="—"></label>';
      }).join('');
    }
    $('f-inv').addEventListener('input', function (e) {
      var k = e.target.dataset.k; if (!k) return;
      if (e.target.value === '') delete p.inventory[k]; else p.inventory[k] = Math.max(0, Math.floor(Number(e.target.value)) || 0);
      refresh();
    });
    paintSizes();

    /* colores */
    $('f-colors').innerHTML = Object.keys(COLORS).map(function (k) {
      return '<button type="button" class="sw" data-c="' + esc(k) + '" aria-pressed="' + (p.colors.indexOf(k) > -1) + '"><i style="background:' + esc(COLORS[k].hex) + '"></i>' + esc(COLORS[k].name) + '</button>';
    }).join('');
    $('f-colors').addEventListener('click', function (e) {
      var b = e.target.closest('.sw'); if (!b) return;
      var c = b.dataset.c, i = p.colors.indexOf(c);
      if (i > -1) p.colors.splice(i, 1); else p.colors.push(c);
      b.setAttribute('aria-pressed', String(i < 0)); refresh();
    });

    /* fondo */
    function paintBg() {
      var cur = bgPair(p.bg);
      $('f-bg').innerHTML = bgOptions(p.bg).map(function (b) { return '<button type="button" data-b="' + b + '" style="background:' + bgCss(b) + '" aria-pressed="' + (b === cur) + '" aria-label="Fondo ' + b + '"></button>'; }).join('');
    }
    $('f-bg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; p.bg = bgCss(b.dataset.b); paintBg(); refresh(); });
    paintBg();

    /* --- fotos --- */
    function paintPhotos() {
      var imgs = p.images;
      var html = imgs.map(function (im, i) {
        return '<div class="photo" data-id="' + esc(im.id) + '"><img src="' + esc(im.url) + '" alt="Foto ' + (i + 1) + '">' +
          (i === 0 ? '<span class="badge pos">Principal</span>' : '') +
          '<div class="acts"><span class="row" style="gap:4px"><button type="button" class="icon-btn" data-a="left" aria-label="Mover antes"' + (i === 0 ? ' disabled' : '') + '>←</button>' +
          '<button type="button" class="icon-btn" data-a="right" aria-label="Mover después"' + (i === imgs.length - 1 ? ' disabled' : '') + '>→</button></span>' +
          '<button type="button" class="icon-btn" data-a="del" aria-label="Eliminar foto">✕</button></div></div>';
      }).join('');
      html += queue.map(function (q) {
        return '<div class="photo pending"><img src="' + q.preview + '" alt=""><div class="spin"><span>' + (q.status || (isNew ? 'Se sube al crear' : 'Subiendo…')) + '</span></div>' +
          (isNew && !q.status ? '<div class="acts" style="justify-content:flex-end"><button type="button" class="icon-btn" data-a="unqueue" data-q="' + q.n + '" aria-label="Quitar">✕</button></div>' : '') + '</div>';
      }).join('');
      $('photos').innerHTML = html;
    }
    $('photos').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || busy) return;
      if (b.dataset.a === 'unqueue') { queue = queue.filter(function (q) { return String(q.n) !== b.dataset.q; }); paintPhotos(); refresh(); return; }
      var id = b.closest('.photo').dataset.id, i = p.images.findIndex(function (x) { return x.id === id; });
      if (b.dataset.a === 'del') {
        confirmBox('¿Eliminar esta foto?', 'Se borra del almacenamiento y deja de verse en la tienda.', 'Eliminar foto').then(function (ok) {
          if (!ok) return;
          busy = true;
          api('DELETE', 'products/' + encodeURIComponent(p.id) + '/images/' + encodeURIComponent(id)).then(function (r) {
            syncImages(r.product); toast('Foto eliminada');
          }).catch(function (err) { toast(err.message, true); }).then(function () { busy = false; });
        });
        return;
      }
      var j = b.dataset.a === 'left' ? i - 1 : i + 1;
      if (j < 0 || j >= p.images.length) return;
      var order = p.images.map(function (x) { return x.id; });
      order.splice(j, 0, order.splice(i, 1)[0]);
      busy = true;
      api('PUT', 'products/' + encodeURIComponent(p.id) + '/images', { order: order }).then(function (r) { syncImages(r.product); })
        .catch(function (err) { toast(err.message, true); }).then(function () { busy = false; });
    });
    function syncImages(prod) {
      p.images = prod.images; original.images = prod.images;
      replaceInState(Object.assign({}, original, { images: prod.images }));
      paintPhotos();
    }

    var qn = 0;
    function addFiles(files) {
      files = [].filter.call(files, function (f) { return /^image\//.test(f.type) || /\.(heic|avif|webp)$/i.test(f.name); });
      if (!files.length) return;
      files.forEach(function (f) { queue.push({ n: ++qn, file: f, preview: URL.createObjectURL(f) }); });
      paintPhotos(); refresh();
      if (!isNew) uploadQueue(p.id);
    }
    function uploadQueue(pid) {
      if (!queue.length) return Promise.resolve();
      busy = true;
      var failed = 0;
      var chain = Promise.resolve();
      queue.slice().forEach(function (q) {
        chain = chain.then(function () {
          q.status = 'Optimizando…'; paintPhotos();
          return compress(q.file).then(function (c) {
            q.status = 'Subiendo…'; paintPhotos();
            return api('POST', 'products/' + encodeURIComponent(pid) + '/images', c.blob, { 'Content-Type': c.blob.type, 'X-Width': String(c.width), 'X-Height': String(c.height) });
          }).then(function (r) {
            queue = queue.filter(function (x) { return x !== q; }); URL.revokeObjectURL(q.preview);
            syncImages(r.product);
          }).catch(function (err) {
            failed++; queue = queue.filter(function (x) { return x !== q; });
            toast((q.file.name ? q.file.name + ': ' : '') + err.message, true); paintPhotos();
          });
        });
      });
      return chain.then(function () { busy = false; refresh(); if (!failed) toast('Fotos subidas'); });
    }
    $('files').addEventListener('change', function () { addFiles(this.files); this.value = ''; });
    var drop = $('drop');
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });
    paintPhotos();

    /* --- guardar --- */
    function refresh() {
      var dirty = JSON.stringify(formData()) !== snapshot;
      var msg = $('msg');
      if (isNew) { msg.textContent = queue.length ? queue.length + ' foto(s) listas para subir al crear' : ''; msg.className = 'msg'; }
      else { msg.textContent = dirty ? 'Cambios sin guardar' : 'Todo guardado · la tienda se actualiza en ~1 minuto'; msg.className = 'msg' + (dirty ? ' dirty' : ''); }
      $('save').disabled = busy || (!isNew && !dirty);
    }
    function showErr(m) { $('err').innerHTML = m ? '<div class="err">' + esc(m) + '</div>' : ''; if (m) window.scrollTo({ top: 0, behavior: 'smooth' }); }

    $('save').addEventListener('click', function () {
      showErr('');
      if (!p.name.trim()) return showErr('Escribe el nombre del producto.');
      if (p.price === '' || !(Number(p.price) >= 0)) return showErr('Escribe un precio válido.');
      if (!p.sizes.length) return showErr('Elige al menos una talla (o "Única").');
      if (!p.slug) p.slug = slugify(p.name);
      // inventario: solo se envían las tallas que siguen activas (y las claves por color que no maneja este editor)
      var inv = {};
      Object.keys(p.inventory).forEach(function (k) { var s = k.split('|')[1]; if (k.indexOf('*|') !== 0 || p.sizes.indexOf(s) > -1) inv[k] = p.inventory[k]; });
      p.inventory = inv;
      busy = true; refresh();
      var btn = $('save'); btn.textContent = 'Guardando…';
      var req = isNew ? api('POST', 'products', formData()) : api('PUT', 'products/' + encodeURIComponent(p.id), formData());
      req.then(function (r) {
        var saved = r.product;
        replaceInState(saved);
        if (isNew) {
          original = saved; p.id = saved.id;
          return uploadQueue(saved.id).then(function () {
            leaveGuard = null; toast('Producto creado');
            location.hash = '#/p/' + encodeURIComponent(saved.id);
          });
        }
        original = saved; p.slug = saved.slug; $('f-slug').value = saved.slug;
        $('viewLink').href = '/products/' + encodeURIComponent(saved.slug);
        snapshot = JSON.stringify(formData());
        toast('Cambios guardados');
      }).catch(function (err) { showErr(err.message); })
        .then(function () { busy = false; btn.textContent = isNew ? 'Crear producto' : 'Guardar cambios'; if (document.body.contains(btn)) refresh(); });
    });

    if (!isNew) $('del').addEventListener('click', function () {
      confirmBox('¿Eliminar "' + p.name + '"?', 'Se borra el producto y sus ' + p.images.length + ' foto(s). No se puede deshacer. Si solo quieres ocultarlo, apaga "Publicado".').then(function (ok) {
        if (!ok) return;
        busy = true;
        api('DELETE', 'products/' + encodeURIComponent(p.id)).then(function () {
          state.products = state.products.filter(function (x) { return x.id !== p.id; });
          leaveGuard = null; toast('Producto eliminado'); location.hash = '#/';
        }).catch(function (err) { busy = false; toast(err.message, true); });
      });
    });

    refresh();
    if (isNew) $('f-name').focus();
  }

  function replaceInState(prod) {
    var i = state.products.findIndex(function (x) { return x.id === prod.id; });
    if (i > -1) state.products[i] = prod; else state.products.unshift(prod);
  }

  /* =====================================================================
     USUARIOS (solo dueños)
     ===================================================================== */
  function usersView() {
    document.title = 'Usuarios · Mentarosa';
    if (state.me.role !== 'owner') { app.innerHTML = '<div class="empty">Solo un dueño puede administrar usuarios. <a href="#/">Volver</a></div>'; return; }
    app.innerHTML =
      '<div class="list-head"><div><h1>Usuarios</h1><p>Quién puede entrar a este panel.</p></div></div>' +
      '<div id="err"></div>' +
      '<section class="panel"><h2>Dar acceso</h2>' +
        '<form class="form-row" id="addForm" novalidate>' +
          '<label class="field"><span>Correo</span><input type="text" id="u-email" inputmode="email" autocomplete="off" placeholder="persona@gmail.com"></label>' +
          '<label class="field"><span>Nombre <small>(opcional)</small></span><input type="text" id="u-name" maxlength="120"></label>' +
          '<label class="field"><span>Rol</span><select id="u-role"><option value="editor">Editor</option><option value="owner">Dueño</option></select></label>' +
          '<label class="field"><span>Contraseña <small>(opcional)</small></span><input type="password" id="u-pass" autocomplete="new-password" placeholder="mín. 10 caracteres"></label>' +
          '<button class="btn" type="submit">Agregar</button>' +
        '</form>' +
        '<p class="hint">Sin contraseña, la persona entra con "Continuar con Google" usando ese mismo correo. Editor: maneja productos. Dueño: además administra usuarios.</p>' +
      '</section>' +
      '<section class="panel"><h2>Con acceso</h2><table class="users"><thead><tr><th>Persona</th><th>Rol</th><th>Acceso</th><th>Último ingreso</th><th></th></tr></thead><tbody id="rows"><tr><td colspan="5">Cargando…</td></tr></tbody></table></section>';
    var $ = function (id) { return document.getElementById(id); };
    function showErr(m) { $('err').innerHTML = m ? '<div class="err">' + esc(m) + '</div>' : ''; }
    function load() { return api('GET', 'users').then(function (r) { paint(r.users); }).catch(function (e) { showErr(e.message); }); }
    function paint(users) {
      $('rows').innerHTML = users.map(function (u) {
        var me = u.id === state.me.id;
        return '<tr data-id="' + esc(u.id) + '"><td><b>' + esc(u.name || u.email) + (me ? ' (tú)' : '') + '</b>' + (u.name ? '<small>' + esc(u.email) + '</small>' : '') + '</td>' +
          '<td>' + (u.role === 'owner' ? 'Dueño' : 'Editor') + (u.active ? '' : ' · <span class="badge out">Desactivado</span>') + '</td>' +
          '<td>' + (u.has_password ? 'Google y contraseña' : 'Solo Google') + '</td>' +
          '<td>' + (u.last_login_at ? esc(new Date(u.last_login_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })) : '<small>Nunca</small>') + '</td>' +
          '<td><div class="acts">' + (me ? '' :
            '<button class="btn ghost sm" data-a="role">' + (u.role === 'owner' ? 'Hacer editor' : 'Hacer dueño') + '</button>' +
            '<button class="btn ghost sm" data-a="active">' + (u.active ? 'Desactivar' : 'Activar') + '</button>' +
            '<button class="btn link" data-a="del">Quitar</button>') + '</div></td></tr>';
      }).join('');
      $('rows').onclick = function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var id = b.closest('tr').dataset.id, u = users.filter(function (x) { return x.id === id; })[0];
        if (b.dataset.a === 'del') {
          confirmBox('¿Quitar el acceso de ' + u.email + '?', 'Ya no podrá entrar al panel. Puedes volver a agregarlo cuando quieras.', 'Quitar acceso').then(function (ok) {
            if (ok) api('DELETE', 'users/' + id).then(function () { toast('Acceso quitado'); load(); }).catch(function (er) { toast(er.message, true); });
          });
          return;
        }
        var body = b.dataset.a === 'role' ? { role: u.role === 'owner' ? 'editor' : 'owner' } : { active: !u.active };
        api('PUT', 'users/' + id, body).then(function () { toast('Usuario actualizado'); load(); }).catch(function (er) { toast(er.message, true); });
      };
    }
    $('addForm').addEventListener('submit', function (e) {
      e.preventDefault(); showErr('');
      var body = { email: $('u-email').value.trim(), name: $('u-name').value.trim(), role: $('u-role').value };
      if ($('u-pass').value) body.password = $('u-pass').value;
      api('POST', 'users', body).then(function () {
        $('addForm').reset(); toast('Acceso agregado'); load();
      }).catch(function (er) { showErr(er.message); });
    });
    load();
  }

  /* =====================================================================
     MI CONTRASEÑA
     ===================================================================== */
  function accountView() {
    document.title = 'Mi contraseña · Mentarosa';
    var has = state.me.has_password;
    app.innerHTML =
      '<div class="list-head"><div><h1>Mi contraseña</h1><p>' + esc(state.me.email) + '</p></div></div>' +
      '<div id="err"></div>' +
      '<section class="panel" style="max-width:480px"><form id="pwForm" novalidate>' +
        (has ? '<label class="field"><span>Contraseña actual</span><input type="password" id="pw-cur" autocomplete="current-password"></label>'
             : '<p class="hint" style="margin:0 0 14px">Hoy entras solo con Google. Si creas una contraseña, también podrás entrar con tu correo.</p>') +
        '<label class="field"><span>Nueva contraseña</span><input type="password" id="pw-new" autocomplete="new-password" placeholder="mín. 10 caracteres"></label>' +
        '<label class="field"><span>Repite la nueva contraseña</span><input type="password" id="pw-new2" autocomplete="new-password"></label>' +
        '<button class="btn" type="submit">' + (has ? 'Cambiar contraseña' : 'Crear contraseña') + '</button>' +
      '</form></section>';
    var $ = function (id) { return document.getElementById(id); };
    $('pwForm').addEventListener('submit', function (e) {
      e.preventDefault(); $('err').innerHTML = '';
      if ($('pw-new').value !== $('pw-new2').value) { $('err').innerHTML = '<div class="err">Las contraseñas nuevas no coinciden.</div>'; return; }
      var body = { password: $('pw-new').value }; if (has) body.current = $('pw-cur').value;
      api('PUT', 'me/password', body).then(function () {
        state.me.has_password = true; toast('Contraseña guardada'); location.hash = '#/';
      }).catch(function (er) { $('err').innerHTML = '<div class="err">' + esc(er.message) + '</div>'; });
    });
  }

  /* ---------- menú de cuenta ---------- */
  function setupMenu() {
    var btn = document.getElementById('menuBtn'), pop = document.getElementById('menuPop');
    var label = state.me.name || state.me.email;
    document.getElementById('who').textContent = label;
    document.getElementById('avatar').textContent = label.trim().charAt(0).toUpperCase();
    document.getElementById('whoLine').textContent = state.me.email + ' · ' + (state.me.role === 'owner' ? 'Dueño' : 'Editor');
    document.getElementById('usersLink').hidden = state.me.role !== 'owner';
    btn.addEventListener('click', function (e) { e.stopPropagation(); pop.hidden = !pop.hidden; btn.setAttribute('aria-expanded', String(!pop.hidden)); });
    document.addEventListener('click', function (e) { if (!pop.hidden && !pop.contains(e.target)) { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    pop.addEventListener('click', function (e) { if (e.target.closest('a')) pop.hidden = true; });
    document.getElementById('logout').addEventListener('click', function () {
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-Admin': '1' } })
        .finally(function () { location.href = '/admin/login'; });
    });
  }

  /* ---------- arranque ---------- */
  Promise.all([api('GET', 'me'), api('GET', 'products')]).then(function (r) {
    state.me = r[0]; state.products = r[1].products;
    setupMenu();
    route();
  }).catch(function (err) {
    app.innerHTML = '<div class="empty">' + esc(err.message) + '</div>';
  });
})();
