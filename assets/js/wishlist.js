/* =====================================================================
   Mentarosa · Página /wishlist
   Lee los favoritos de Mentarosa.Wishlist y reutiliza las tarjetas del sitio.
   ===================================================================== */
(function () {
  var M = window.Mentarosa, W = M.Wishlist;
  var grid = document.getElementById('wlGrid'), empty = document.getElementById('wlEmpty'), count = document.getElementById('wlCount');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function render(animate) {
    var items = W.ids().map(M.byId).filter(Boolean);       // datos siempre frescos del catálogo
    grid.innerHTML = items.map(function (p, i) { return M.productCard(p, { reveal: false, style: animate ? '--i:' + Math.min(i, 11) : '--i:0', cls: animate ? 'enter' : '' }); }).join('');
    grid.hidden = !items.length; empty.hidden = !!items.length;
    count.textContent = items.length ? items.length + (items.length === 1 ? ' producto guardado' : ' productos guardados') : 'Aún no guardas productos';
  }
  M.bindProductActions(grid);
  window.addEventListener('mentarosa:wishlist', function (e) {
    var d = e.detail || {};
    var card = d.action === 'remove' && grid.querySelector('.p[data-id="' + d.id + '"]');
    if (card && !reduce) { card.classList.add('leaving'); setTimeout(function () { render(false); }, 320); }
    else render(d.action === 'add' || d.source === 'storage');
  });
  render(true);
})();
