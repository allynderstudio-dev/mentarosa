/* Pantalla de login del dashboard: contraseña o Google (si está configurado). */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var next = params.get('next') || '/admin/';
  var ERRORS = {
    not_allowed: 'Esa cuenta no tiene acceso a este panel. El acceso es solo por invitación.',
    google_state: 'El inicio de sesión con Google expiró. Inténtalo de nuevo.',
    google_token: 'Google no confirmó tu cuenta. Inténtalo de nuevo.',
    google_off: 'El inicio de sesión con Google no está activado en este sitio.',
    limit: 'Demasiados intentos. Espera 15 minutos.',
    invite_invalid: 'La invitación no es válida o ya venció. Pide un enlace nuevo.',
    invite_email: 'Esa cuenta de Google no es la del correo invitado. Usa la cuenta correcta o crea una contraseña desde el enlace.'
  };
  var err = document.getElementById('err');
  function showErr(msg) { err.innerHTML = msg ? '<div class="err"></div>' : ''; if (msg) err.firstChild.textContent = msg; }
  if (params.get('error')) showErr(ERRORS[params.get('error')] || 'No se pudo iniciar sesión.');

  // Google solo aparece si el sitio tiene GOOGLE_CLIENT_ID / SECRET
  fetch('/api/auth/config').then(function (r) { return r.json(); }).then(function (c) {
    if (!c.google) return;
    var g = document.getElementById('google');
    g.href = '/api/auth/google?next=' + encodeURIComponent(next);
    g.hidden = false; document.getElementById('or').hidden = false;
  }).catch(function () {});

  var form = document.getElementById('form'), btn = document.getElementById('submit');
  form.addEventListener('submit', function (e) {
    e.preventDefault(); showErr('');
    var email = document.getElementById('email').value.trim(), password = document.getElementById('password').value;
    if (!email || !password) return showErr('Escribe tu correo y tu contraseña.');
    btn.disabled = true; btn.textContent = 'Entrando…';
    fetch('/api/auth/login', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Admin': '1' },
      body: JSON.stringify({ email: email, password: password, next: next })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || 'No se pudo iniciar sesión.');
        location.href = res.d.next || '/admin/';
      })
      .catch(function (e2) { showErr(e2.message); btn.disabled = false; btn.textContent = 'Iniciar sesión'; });
  });
})();
