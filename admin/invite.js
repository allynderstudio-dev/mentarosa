/* Aceptar una invitación al dashboard. El token viaja en el # del enlace
   (no llega a los registros del servidor ni a otros sitios). */
(function () {
  'use strict';
  var token = location.hash.replace(/^#/, '');
  var $ = function (id) { return document.getElementById(id); };
  var ROLES = { owner: 'administrador', editor: 'editor' };
  function showErr(msg) { $('err').innerHTML = msg ? '<div class="err"></div>' : ''; if (msg) $('err').firstChild.textContent = msg; }
  function dead(msg) { $('title').textContent = 'Invitación no válida'; $('sub').textContent = ''; showErr(msg); }

  if (!token) return dead('El enlace está incompleto. Ábrelo tal como te llegó.');

  fetch('/api/auth/invite?token=' + encodeURIComponent(token))
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      if (!res.ok) return dead(res.d.error);
      var d = res.d;
      $('title').textContent = 'Hola' + (d.name ? ', ' + d.name : '');
      $('sub').textContent = 'Te invitaron al panel de productos como ' + (ROLES[d.role] || 'editor') + '. Elige cómo vas a entrar.';
      $('email').value = d.email;
      $('ok').hidden = false;
      if (d.google) {
        $('google').href = '/api/auth/google?invite=' + encodeURIComponent(token);
        $('google').hidden = false; $('or').hidden = false;
      }
    })
    .catch(function () { dead('No se pudo revisar la invitación. Inténtalo de nuevo.'); });

  $('form').addEventListener('submit', function (e) {
    e.preventDefault(); showErr('');
    var p1 = $('p1').value, p2 = $('p2').value;
    if (p1.length < 10) return showErr('La contraseña debe tener al menos 10 caracteres.');
    if (p1 !== p2) return showErr('Las contraseñas no coinciden.');
    var btn = $('submit'); btn.disabled = true; btn.textContent = 'Guardando…';
    fetch('/api/auth/invite/accept', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Admin': '1' },
      body: JSON.stringify({ token: token, password: p1 })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || 'No se pudo aceptar la invitación.');
        history.replaceState(null, '', '/admin/invite');   // el token ya no sirve; se quita de la barra
        location.href = '/admin/';
      })
      .catch(function (er) { showErr(er.message); btn.disabled = false; btn.textContent = 'Aceptar invitación'; });
  });
})();
