/* =====================================================================
   Mentarosa · JS compartido entre páginas
   - Header (menú móvil)       - Tarjeta de producto + favoritos/carrito
   - Aparición suave (.reveal) - Newsletter + footer
   Se carga al final del <body>, después de catalog.js.
   ===================================================================== */
(function () {
  var M = window.Mentarosa = window.Mentarosa || {};
  M.catalog = window.MENTAROSA_CATALOG || [];
  M.colors = window.MENTAROSA_COLORS || {};

  var ICON = M.ICON = {
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20.5C5 15 2.5 11.5 2.5 8.3 2.5 5.6 4.5 3.8 7 3.8c2 0 4 1.2 5 3 1-1.8 3-3 5-3 2.5 0 4.5 1.8 4.5 4.5 0 3.2-2.5 6.7-9.5 12.2Z"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
    img: '<svg viewBox="0 0 48 48"><rect x="6" y="9" width="36" height="30" rx="6"/><circle cx="17" cy="20" r="3.5"/><path d="m8 36 11-10 8 7 6-5 9 8"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
  };
  M.esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  M.money = function (a, cur) { return cur === 'USD' ? '$' + a.toFixed(2) : a.toLocaleString('es-CO') + ' ' + cur; };
  M.byId = function (id) { for (var i = 0; i < M.catalog.length; i++) if (M.catalog[i].id === id) return M.catalog[i]; return null; };

  /* ---------- datos de ficha (PDP) fusionados en cada producto ---------- */
  var DETAILS = window.MENTAROSA_DETAILS || {}, CARE = window.MENTAROSA_CARE || {};
  var slugify = function (s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  M.catalog.forEach(function (p) {
    var d = DETAILS[p.id] || {};
    for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) p[k] = d[k];
    if (!p.slug) p.slug = slugify(p.name);
    if (!p.care) p.care = CARE[p.cat] || [];
  });
  M.bySlug = function (slug) { for (var i = 0; i < M.catalog.length; i++) if (M.catalog[i].slug === slug) return M.catalog[i]; return null; };
  /* ---------- búsqueda de texto (header y tienda usan la misma lógica) ---------- */
  M.norm = function (t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim(); };
  // palabras que la gente usa para buscar cada categoría
  var CAT_WORDS = { Tops: 'top blusa camisa franela', Pantalones: 'pantalon', Chaquetas: 'chaqueta abrigo', Zapatos: 'zapato calzado' };
  function fields(p) {
    var colors = (p.colors || []).concat(p.variantColors || []).map(function (c) { return M.colors[c] ? M.colors[c].name : c; });
    var tag = p.tag === 'new' ? 'nuevo new novedad' : p.tag === 'best' ? 'bestseller mas vendido favorito' : '';
    return [M.norm(p.name),                                              // 0 · nombre
            M.norm([p.cat, CAT_WORDS[p.cat], p.keywords].join(' ')),     // 1 · categoría y palabras clave
            M.norm(colors.join(' ')),                                    // 2 · colores
            M.norm([p.desc, p.material, tag].join(' '))];                // 3 · descripción
  }
  // coincidencia que tolera plurales ("jeans" → "jean", "tacones" → "tacon")
  function tokenHit(hay, t) {
    if (hay.indexOf(t) > -1) return true;
    if (t.length > 4 && /es$/.test(t) && hay.indexOf(t.slice(0, -2)) > -1) return true;
    if (t.length > 3 && /s$/.test(t) && hay.indexOf(t.slice(0, -1)) > -1) return true;
    return false;
  }
  // nivel de la peor palabra: 0 = todas en el nombre … 3 = alguna solo en la descripción · -1 = no coincide
  function level(p, q) {
    var tokens = M.norm(q).split(' ').filter(Boolean); if (!tokens.length) return 0;
    var f = fields(p), worst = 0;
    for (var i = 0; i < tokens.length; i++) {
      var lv = -1;
      for (var k = 0; k < f.length; k++) if (tokenHit(f[k], tokens[i])) { lv = k; break; }
      if (lv < 0) return -1;
      if (lv > worst) worst = lv;
    }
    return worst;
  }
  M.matchesQuery = function (p, q) { return level(p, q) > -1; };
  /* resultados ordenados por relevancia */
  M.searchProducts = function (q) {
    var nq = M.norm(q); if (!nq) return [];
    return M.catalog.map(function (p) {
      var lv = level(p, q); if (lv < 0) return null;
      var score = lv * 2 + (M.norm(p.name).indexOf(nq) === 0 ? 0 : 1) + (p.stock === false ? .5 : 0);
      return { p: p, score: score };
    }).filter(Boolean).sort(function (a, b) { return a.score - b.score || a.p.name.localeCompare(b.p.name, 'es'); }).map(function (r) { return r.p; });
  };
  M.productUrl = function (p) { return 'products/' + encodeURIComponent(p.slug); };
  M.imagesOf = function (p, color) {
    if (color && p.colorImages && p.colorImages[color]) return p.colorImages[color];
    return p.images || [p.img, p.img2].filter(Boolean);
  };
  /* stock de una variante: 0 agotado · 1–2 últimas unidades · lo no indicado se considera disponible (10) */
  M.variantStock = function (p, color, size) {
    if (p.stock === false) return 0;
    var inv = p.inventory || {}, c = color || '*', z = size || '*';
    var keys = [c + '|' + z, '*|' + z, c + '|*'];
    for (var i = 0; i < keys.length; i++) if (Object.prototype.hasOwnProperty.call(inv, keys[i])) return inv[keys[i]];
    return 10;
  };

  /* ---------- aviso flotante (con acción opcional, p. ej. "Deshacer") ---------- */
  var toast, tt;
  M.say = function (msg, action) {
    if (!toast) {
      toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status');
      toast.innerHTML = '<i>' + ICON.check + '</i><span></span><button type="button" class="toast-act" hidden></button>';
      document.body.appendChild(toast);
      toast.querySelector('.toast-act').addEventListener('click', function () { var f = toast._act; toast.classList.remove('show'); if (f) f(); });
    }
    toast.querySelector('span').textContent = msg;
    var btn = toast.querySelector('.toast-act');
    btn.hidden = !action; toast._act = action ? action.fn : null; if (action) btn.textContent = action.label;
    toast.classList.add('show');
    clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove('show'); }, action ? 4200 : 2200);
  };

  /* ---------- contadores del header (carrito y favoritos) ---------- */
  function pop(el) { if (!el) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  function paintBadges(e) {
    var c = M.Cart.count(), w = M.Wishlist.count();
    document.querySelectorAll('.icon-btn.cart .badge').forEach(function (b) { b.textContent = c > 99 ? '99+' : c; b.hidden = !c; if (e && e.type === 'mentarosa:cart' && e.detail && e.detail.action === 'add') pop(b); });
    document.querySelectorAll('.icon-btn.cart').forEach(function (b) { b.setAttribute('aria-label', c ? 'Carrito, ' + c + (c === 1 ? ' artículo' : ' artículos') : 'Carrito vacío'); });
    document.querySelectorAll('.wl-badge').forEach(function (b) { b.textContent = w > 99 ? '99+' : w; b.hidden = !w; if (e && e.type === 'mentarosa:wishlist' && e.detail && e.detail.action === 'add') pop(b); });
    document.querySelectorAll('.icon-btn.wl').forEach(function (b) { b.setAttribute('aria-label', w ? 'Favoritos, ' + w + ' guardados' : 'Favoritos'); });
  }
  window.addEventListener('mentarosa:cart', paintBadges);
  window.addEventListener('mentarosa:wishlist', paintBadges);
  M.paintBadges = paintBadges;

  /* corazones de todas las tarjetas siempre al día (misma pestaña y otras pestañas) */
  window.addEventListener('mentarosa:wishlist', function () {
    document.querySelectorAll('.p[data-id] .p-fav').forEach(function (b) {
      var id = b.closest('.p').dataset.id; b.setAttribute('aria-pressed', M.Wishlist.has(id));
    });
  });
  /* guardar / quitar de favoritos con aviso y "Deshacer" */
  M.toggleWish = function (p, btn) {
    var added = M.Wishlist.toggle(p.id);
    if (btn) { btn.classList.remove('burst'); void btn.offsetWidth; if (added) btn.classList.add('burst'); }
    if (added) M.say('Guardado en favoritos: ' + p.name, { label: 'Ver favoritos', fn: function () { location.href = 'wishlist'; } });
    else M.say('Quitado de favoritos: ' + p.name, { label: 'Deshacer', fn: function () { M.Wishlist.add(p.id); } });
    return added;
  };

  /* ---------- tarjeta de producto (homepage y tienda) ---------- */
  var TAGS = M.TAGS = { new: { label: 'NEW', cls: '' }, best: { label: 'BESTSELLER', cls: ' best' }, soldout: { label: 'AGOTADO', cls: ' soldout' } };
  M.productCard = function (p, opts) {
    opts = opts || {};
    var esc = M.esc, soldout = p.stock === false;
    var t = soldout ? TAGS.soldout : (p.tag && TAGS[p.tag]);
    var tag = t ? '<span class="p-tag' + t.cls + '">' + t.label + '</span>' : '';
    var fail = "this.closest('.p-media').classList.add('noimg');this.remove()";
    var media = p.fit === 'cutout'
      ? '<img class="cutout" src="' + esc(p.img) + '" alt="' + esc(p.name) + '" loading="lazy" width="1110" height="810">'
      : (p.img2 ? '<img class="photo photo2" src="' + esc(p.img2) + '" alt="" loading="lazy" onerror="this.nextElementSibling.classList.remove(\'has2\');this.remove()">' : '')
        + '<img class="photo' + (p.img2 ? ' has2' : '') + '" src="' + esc(p.img) + '" alt="' + esc(p.name) + '" loading="lazy" onerror="' + fail + '">';
    var old = p.old ? '<s>' + M.money(p.old, p.price.cur) + '</s>' : '';
    var on = M.Wishlist.has(p.id);
    var cls = 'p' + (opts.reveal === false ? '' : ' reveal') + (soldout ? ' is-soldout' : '') + (opts.cls ? ' ' + opts.cls : '');
    var add = soldout
      ? '<button class="p-add" type="button" disabled aria-label="' + esc(p.name) + ' está agotado">' + ICON.bag + '<span>Agotado</span></button>'
      : '<button class="p-add" type="button" aria-label="Agregar ' + esc(p.name) + ' al carrito">' + ICON.bag + '<span>Agregar al carrito</span></button>';
    return '<article class="' + cls + '" data-id="' + esc(p.id) + '"' + (opts.style ? ' style="' + opts.style + '"' : '') + '>'
      + '<div class="p-media" style="--g:' + p.bg + '">'
      + '<div class="p-ph">' + ICON.img + '<span>Foto de producto<br>' + esc(p.img) + '</span></div>'
      + media
      + '<a class="p-link" href="' + M.productUrl(p) + '" tabindex="-1" aria-hidden="true"></a>'
      + tag
      + '<button class="p-fav" type="button" aria-pressed="' + on + '" aria-label="Guardar ' + esc(p.name) + ' en favoritos">' + ICON.heart + '</button>'
      + add
      + '</div>'
      + '<div class="p-info"><div><span class="p-cat">' + esc(p.cat) + '</span><h3 class="p-name"><a href="' + M.productUrl(p) + '">' + esc(p.name) + '</a></h3></div>'
      + '<div class="p-price">' + M.money(p.price.amount, p.price.cur) + old + '</div></div></article>';
  };
  /* favoritos y "agregar" por delegación sobre cualquier contenedor de tarjetas */
  M.bindProductActions = function (container) {
    container.addEventListener('click', function (e) {
      var art = e.target.closest('.p'); if (!art) return;
      var p = M.byId(art.dataset.id); if (!p) return;
      var fav = e.target.closest('.p-fav'), add = e.target.closest('.p-add');
      if (fav) { e.preventDefault(); M.toggleWish(p, fav); }
      if (add && !add.disabled) { e.preventDefault(); M.quickAdd(p, art.querySelector('.p-media'), add); }
    });
  };

  /* ---------- aparición suave al hacer scroll ---------- */
  M.observe = function (nodes, o) {
    o = o || {};
    var step = o.step || 70;
    nodes = [].slice.call(nodes);
    if (!('IntersectionObserver' in window)) { nodes.forEach(function (n) { n.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: o.threshold || .15, rootMargin: '0px 0px ' + (o.margin || '-6%') + ' 0px' });
    nodes.forEach(function (n, i) { n.style.transitionDelay = ((i % 4) * step) + 'ms'; io.observe(n); });
  };
  M.observe(document.querySelectorAll('.reveal'), { step: 70, threshold: .15, margin: '-6%' });

  /* ---------- header: menú móvil ---------- */
  var header = document.querySelector('.header'), menuBtn = document.getElementById('menuBtn');
  if (header && menuBtn) {
    menuBtn.addEventListener('click', function () { var o = header.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', o); });
    document.querySelectorAll('.nav a').forEach(function (a) { a.addEventListener('click', function () { header.classList.remove('open'); menuBtn.setAttribute('aria-expanded', false); }); });
  }

  /* ---------- newsletter: validación + punto de integración ----------
     INTEGRACIÓN FUTURA: define el endpoint de tu servicio (Mailchimp, Klaviyo, Brevo, un backend propio, etc.).
     Mientras `endpoint` esté vacío NO se envía ni se guarda nada, y la página lo dice con claridad. */
  window.MENTAROSA_NEWSLETTER = window.MENTAROSA_NEWSLETTER || {
    endpoint: '',            // p. ej. 'https://tu-backend.com/api/subscribe'
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    buildPayload: function (email) { return JSON.stringify({ email: email, consent: true, source: 'homepage', ts: new Date().toISOString() }); }
  };
  var form = document.getElementById('nlForm');
  if (form) {
    var email = document.getElementById('nlEmail'), consent = document.getElementById('nlConsent'), msg = document.getElementById('nlMsg');
    var RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var say = function (type, text) { msg.className = 'nl-msg ' + type; msg.textContent = text; };
    var bad = function (text, field) { form.classList.add('invalid'); email.setAttribute('aria-invalid', field === email); say('err', text); if (field) field.focus(); };
    email.addEventListener('input', function () { form.classList.remove('invalid'); email.removeAttribute('aria-invalid'); if (msg.classList.contains('err')) { msg.className = 'nl-msg'; msg.textContent = ''; } });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.elements.website.value) return;                       // honeypot: bots
      var v = email.value.trim();
      if (!v) return bad('Escribe tu correo para continuar.', email);
      if (v.length > 254 || !RE.test(v)) return bad('Revisa tu correo: parece que le falta algo (por ejemplo, nombre@correo.com).', email);
      if (!consent.checked) return bad('Acepta recibir correos para poder suscribirte.', consent);
      var cfg = window.MENTAROSA_NEWSLETTER;
      if (!cfg.endpoint) {
        form.classList.remove('invalid');
        say('info', 'Tu correo es válido, pero la suscripción aún no está conectada a un servicio de email marketing. Por ahora no se guardó nada.');
        return;
      }
      var btn = form.querySelector('button[type=submit]'); btn.disabled = true; say('info', 'Enviando…');
      fetch(cfg.endpoint, { method: cfg.method, headers: cfg.headers, body: cfg.buildPayload(v) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); form.reset(); say('ok', '¡Listo! Revisa tu correo para confirmar tu suscripción.'); })
        .catch(function () { say('err', 'No pudimos completar la suscripción. Inténtalo de nuevo en unos minutos.'); })
        .then(function () { btn.disabled = false; });
    });
  }

  paintBadges();

  /* ---------- footer ---------- */
  var y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();
  var top = document.getElementById('toTop');
  if (top) top.addEventListener('click', function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
  document.querySelectorAll('a[data-placeholder]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); }); // enlaces pendientes: no navegan
})();
