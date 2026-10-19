/* =====================================================================
   Mentarosa · Página /cart
   Misma fuente de datos (Mentarosa.Cart) y mismo render de líneas que el drawer.
   El pedido se envía por WhatsApp (order.js); no hay checkout ni pagos.
   ===================================================================== */
(function () {
  var M = window.Mentarosa, Cart = M.Cart, esc = M.esc;
  var $ = function (id) { return document.getElementById(id); };
  var list = $('cLines'), full = $('cartFull'), empty = $('cartEmpty');

  function fmtTime(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' a las ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }
  function render() {
    var lines = Cart.lines(), n = Cart.count();
    list.innerHTML = lines.map(M.cartLineHTML).join('');
    full.hidden = !lines.length; empty.hidden = !!lines.length;
    var txt = n + (n === 1 ? ' artículo' : ' artículos');
    $('cCount').textContent = n ? txt + ' en tu carrito' : 'Tu carrito está vacío';
    $('sItems').textContent = 'Subtotal · ' + txt;
    $('sSub').innerHTML = M.cartTotals(lines).map(esc).join('<br>');

    var o = M.Order.build();
    // productos agotados: no se puede armar el pedido hasta quitarlos
    var blocked = o && o.blocked.length;
    $('waOrder').disabled = !o || !!blocked;
    $('waBlocked').hidden = !blocked;
    if (blocked) $('waBlocked').textContent = 'Quita los productos agotados para hacer tu pedido: ' + o.blocked.join(', ') + '.';
    // estado honesto: abierto en WhatsApp ≠ confirmado
    var st = $('waStatus');
    st.hidden = !(o && o.sentAt);
    if (o && o.sentAt) st.innerHTML = 'Pedido <b>' + esc(o.ref) + '</b> abierto en WhatsApp el ' + esc(fmtTime(o.sentAt)) + '. <span>Pendiente de confirmación por Mentarosa.</span>';
  }
  M.bindCartLines(list);
  window.addEventListener('mentarosa:cart', render);

  /* ---------- resumen del pedido ---------- */
  var dlg = $('orderDlg'), lastText = '';
  function extras() { return { name: $('odName').value.trim(), note: $('odNote').value.trim() }; }
  function fillReview() {
    var o = M.Order.build(); if (!o) return false;
    $('odRef').textContent = o.ref;
    $('odItems').innerHTML = o.items.map(function (it) {
      var v = [it.size ? 'Talla ' + it.size : '', it.color].filter(Boolean).join(' · ');
      return '<li><div><b>' + esc(it.name) + '</b>' + (v ? '<span>' + esc(v) + '</span>' : '') + '</div>'
        + '<div class="od-q">' + it.qty + ' × ' + esc(it.unitText) + '<b>' + esc(it.subtotalText) + '</b></div></li>';
    }).join('');
    $('odCount').textContent = 'Subtotal · ' + o.count + (o.count === 1 ? ' artículo' : ' artículos');
    $('odSub').innerHTML = o.totals.map(function (t) { return esc(t.text); }).join('<br>');
    $('odFallback').hidden = M.Order.hasNumber();
    lastText = M.Order.message(o, extras());
    $('odMsg').textContent = lastText;
    return true;
  }
  function openDlg() {
    if (!fillReview()) return;
    $('odReview').hidden = false; $('odDone').hidden = true;
    dlg.showModal(); document.documentElement.classList.add('no-scroll');
    $('odSend').focus();
  }
  function closeDlg() { if (dlg.open) dlg.close(); }
  dlg.addEventListener('close', function () { document.documentElement.classList.remove('no-scroll'); render(); $('waOrder').focus(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDlg(); });
  ['odName', 'odNote'].forEach(function (id) { $(id).addEventListener('input', fillReview); });

  function doSend() {
    var btn = $('odSend'); btn.disabled = true;
    M.Order.send(extras()).then(function (r) {
      btn.disabled = false;
      if (!r.ok) {
        if (r.reason === 'blocked') M.say('Quita los productos agotados antes de pedir.');
        if (r.reason === 'empty') closeDlg();
        return;
      }
      lastText = r.text || lastText;
      var msg = r.mode === 'prefilled'
        ? 'Abrimos WhatsApp con tu pedido ' + r.ref + ' ya escrito. Solo falta que lo envíes.'
        : r.mode === 'copied'
          ? 'Copiamos tu pedido ' + r.ref + '. En el chat de Mentarosa, mantén presionado y elige «Pegar», luego envíalo.'
          : 'Abrimos el chat de Mentarosa. Copia tu pedido con el botón de abajo, pégalo en el chat y envíalo.';
      $('odDoneText').textContent = msg;
      $('odCopy').hidden = r.mode === 'prefilled';          // con mensaje precargado no hace falta copiar
      $('odReview').hidden = true; $('odDone').hidden = false;
      $('odFinish').focus();
      render();
    });
  }
  $('waOrder').addEventListener('click', openDlg);
  $('odSend').addEventListener('click', doSend);
  $('odReopen').addEventListener('click', doSend);
  $('odCopy').addEventListener('click', function () {
    M.Order.copy(lastText).then(function (ok) { M.say(ok ? 'Pedido copiado. Pégalo en el chat de Mentarosa.' : 'No pudimos copiar automáticamente. Vuelve al carrito, abre el resumen y copia el mensaje desde «Ver el mensaje».'); });
  });
  [$('odClose'), $('odBack'), $('odFinish')].forEach(function (b) { b.addEventListener('click', closeDlg); });

  render();
})();
