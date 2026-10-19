/* =====================================================================
   Mentarosa · Pedidos por WhatsApp
   ---------------------------------------------------------------------
   Arma un pedido con el carrito actual (Mentarosa.Cart) y lo abre en el
   WhatsApp oficial de Mentarosa con el mensaje listo para enviar.

   - No hay checkout, pagos ni cuentas: pago y entrega se coordinan por WhatsApp.
   - Abrir WhatsApp NO confirma el pedido y NO vacía el carrito.
   - No se agregan costos de envío, descuentos ni disponibilidad inventada.
   - No se guarda información personal (nombre y comentario solo viajan en el mensaje).
   Depende de: catalog.js, store.js, site.js
   ===================================================================== */

/* ---------- CONFIGURACIÓN (editar aquí) ----------
   number: número oficial de WhatsApp en formato internacional, solo dígitos,
           sin "+", espacios ni guiones. Ej.: Venezuela 58 + 4141234567 → '584141234567'.
           Con el número, el mensaje se abre ya escrito (wa.me/<número>?text=...).
   fallbackLink: enlace oficial actual de Mentarosa (de su Instagram). Este tipo de
           enlace NO admite texto precargado: mientras `number` esté vacío, el pedido
           se copia al portapapeles y se abre este enlace para pegarlo en el chat. */
window.MENTAROSA_WHATSAPP = window.MENTAROSA_WHATSAPP || {
  number: '584127930001',                                  // WhatsApp oficial de Mentarosa: +58 412 7930001
  fallbackLink: 'https://wa.me/message/2PVRC4MJKY7KF1',
  storeName: 'Mentarosa Boutique'
};

(function () {
  var M = window.Mentarosa, Cart = M.Cart, COLORS = M.colors;
  var KEY = 'mentarosa.order';           // solo referencia y estado del borrador (sin datos personales)

  function readState() { try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && typeof s.ref === 'string' ? s : null; } catch (e) { return null; } }
  function writeState(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  // firma del carrito: si cambia, es otro pedido y recibe otra referencia
  function signature(lines) { return lines.map(function (l) { return l.id + 'x' + l.qty; }).sort().join('|'); }
  function newRef() {
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var rand = '';
    try { var a = new Uint32Array(1); crypto.getRandomValues(a); rand = a[0].toString(36); } catch (e) { rand = Math.random().toString(36).slice(2); }
    return 'MR-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + rand.slice(0, 4).toUpperCase().padStart(4, '0');
  }
  function colorText(p, line) {
    if (line.color && COLORS[line.color]) return COLORS[line.color].name;
    // producto de un solo color: se informa el color del catálogo
    return (p.colors || []).map(function (c) { return COLORS[c] ? COLORS[c].name : c; }).join(' y ');
  }

  /* pedido a partir del carrito actual (null si está vacío) */
  function build() {
    var lines = Cart.lines();
    if (!lines.length) return null;
    var sig = signature(lines), st = readState();
    if (!st || st.signature !== sig) { st = { ref: newRef(), signature: sig, created: Date.now() }; writeState(st); }
    var items = [], totals = {}, order = [], blocked = [];
    lines.forEach(function (l) {
      var p = M.byId(l.productId); if (!p) return;
      var cur = p.price.cur, unit = p.price.amount, sub = unit * l.qty;
      if (!(cur in totals)) { totals[cur] = 0; order.push(cur); }
      totals[cur] += sub;
      if (Cart.stockOf(l) === 0) blocked.push(p.name + (l.size ? ' (talla ' + l.size + ')' : ''));
      items.push({ id: p.id, name: p.name, size: l.size, color: colorText(p, l), qty: l.qty, cur: cur,
        unit: unit, subtotal: sub, unitText: M.money(unit, cur), subtotalText: M.money(sub, cur) });
    });
    return {
      ref: st.ref, created: st.created, sentAt: st.sentAt || null,
      items: items, count: items.reduce(function (n, i) { return n + i.qty; }, 0),
      totals: order.map(function (c) { return { cur: c, amount: totals[c], text: M.money(totals[c], c) }; }),
      blocked: blocked
    };
  }

  /* mensaje organizado (WhatsApp interpreta *negritas*) */
  function message(o, extra) {
    extra = extra || {};
    var L = [];
    L.push('¡Hola, Mentarosa! 💖 Quiero hacer este pedido:');
    L.push('');
    L.push('*Pedido ' + o.ref + '*');
    L.push('');
    o.items.forEach(function (it, i) {
      L.push((i + 1) + '. *' + it.name + '*');
      var v = [];
      if (it.size) v.push('Talla: ' + it.size);
      if (it.color) v.push('Color: ' + it.color);
      if (v.length) L.push('   ' + v.join(' · '));
      L.push('   Cantidad: ' + it.qty + ' × ' + it.unitText + ' = ' + it.subtotalText);
      L.push('');
    });
    L.push('Artículos: ' + o.count);
    L.push('*Subtotal: ' + o.totals.map(function (t) { return t.text; }).join(' + ') + '*');
    if (o.totals.length > 1) L.push('(El pedido incluye precios en distintas monedas)');
    L.push('');
    if (extra.name) L.push('Nombre: ' + extra.name);
    if (extra.note) L.push('Comentario: ' + extra.note);
    if (extra.name || extra.note) L.push('');
    L.push('Los precios son de referencia. Quedo pendiente de la confirmación de disponibilidad, pago y entrega. ¡Gracias!');
    return L.join('\n');
  }

  function digits(n) { return String(n || '').replace(/\D/g, ''); }
  function hasNumber() { return digits(window.MENTAROSA_WHATSAPP.number).length >= 8; }
  function waUrl(text) { return 'https://wa.me/' + digits(window.MENTAROSA_WHATSAPP.number) + '?text=' + encodeURIComponent(text); }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove(); return ok;
  }

  /* abre WhatsApp. Devuelve { ok, mode: 'prefilled' | 'copied' | 'manual', reason } */
  function send(extra) {
    var o = build();
    if (!o) return Promise.resolve({ ok: false, reason: 'empty' });
    if (o.blocked.length) return Promise.resolve({ ok: false, reason: 'blocked', blocked: o.blocked });
    var text = message(o, extra);
    var mark = function () { var st = readState(); if (st) { st.sentAt = Date.now(); writeState(st); } };
    if (hasNumber()) {
      // se abre en una pestaña nueva (en mobile abre la app); el carrito NO se vacía
      var w = window.open(waUrl(text), '_blank');
      if (w) { try { w.opener = null; } catch (e) {} } else location.href = waUrl(text);   // si se bloquea la pestaña nueva
      mark();
      return Promise.resolve({ ok: true, mode: 'prefilled', ref: o.ref });
    }
    // sin número configurado: copiar el pedido y abrir el enlace oficial para pegarlo
    var win = window.open('', '_blank');                       // abrir ya, dentro del clic, para que no lo bloqueen
    return copy(text).then(function (copied) {
      var link = window.MENTAROSA_WHATSAPP.fallbackLink;
      if (win) { try { win.opener = null; win.location.href = link; } catch (e) { window.open(link, '_blank', 'noopener'); } }
      else window.open(link, '_blank', 'noopener');
      mark();
      return { ok: true, mode: copied ? 'copied' : 'manual', ref: o.ref, text: text };
    });
  }

  M.Order = { build: build, message: message, send: send, hasNumber: hasNumber, copy: copy, state: readState };
})();
