/* =====================================================================
   Mentarosa · Transición entre páginas con el logo
   ---------------------------------------------------------------------
   Uso en cualquier página:  <script src="assets/js/transition.js"></script>
   dentro del <head> (sin defer), junto a assets/css/site.css.

   Cómo funciona — sin temporizadores que ralenticen la navegación:
   1. Al hacer clic en un enlace interno a otra página, se muestra la capa
      con el logo y el navegador navega de inmediato (no se retiene el clic).
   2. La página nueva arranca cubierta por la misma capa solo si venimos de
      esa navegación, y la retira en cuanto el documento está listo.
   3. Cargas directas, recargas, anclas (#), enlaces externos, pestañas nuevas
      y descargas NO muestran transición. Con "reducir movimiento" se omite.
   ===================================================================== */
(function () {
  var KEY = 'mentarosa:pt', root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- entrada: ¿venimos de una navegación interna con transición? --- */
  var entering = false;
  try { entering = sessionStorage.getItem(KEY) === '1'; sessionStorage.removeItem(KEY); } catch (e) {}
  if (entering && !reduce) root.classList.add('pt-enter');

  function reveal() { root.classList.remove('pt-enter'); }
  if (root.classList.contains('pt-enter')) {
    document.addEventListener('DOMContentLoaded', function () {
      // espera a las fuentes para evitar un salto tipográfico, pero nunca más que el evento load
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(reveal);
      else reveal();
    });
    window.addEventListener('load', reveal);
  }

  /* --- salida: interceptar solo navegaciones reales entre páginas --- */
  function isPageNav(e, a) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (!a || !a.href || a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return false;
    if (a.target && a.target !== '_self') return false;
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return false; }
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return false;
    // misma página (solo cambia el #ancla): no es una navegación
    if (url.pathname === location.pathname && url.search === location.search) return false;
    return true;
  }
  document.addEventListener('click', function (e) {
    if (reduce) return;
    var a = e.target.closest && e.target.closest('a');
    if (!isPageNav(e, a)) return;
    try { sessionStorage.setItem(KEY, '1'); } catch (err) {}
    root.classList.add('pt-leave');      // la navegación sigue su curso de inmediato
  });

  /* --- volver con el botón Atrás (bfcache) o navegación cancelada --- */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { root.classList.remove('pt-leave', 'pt-enter'); try { sessionStorage.removeItem(KEY); } catch (err) {} }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') root.classList.remove('pt-leave');
  });
})();
