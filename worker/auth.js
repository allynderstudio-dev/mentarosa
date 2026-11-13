/* =====================================================================
   Login propio del dashboard (plantilla de la agencia)
   ---------------------------------------------------------------------
   - Usuarios en la tabla admin_users de cada cliente (lista de quién entra).
   - Roles: "superadmin" (la Agencia, correos de SUPERADMIN_EMAILS: acceso total y
     permanente, nadie la puede quitar desde el panel), "owner" (Administrador del
     cliente: todo, incluso invitar y quitar a otros, menos tocar a la Agencia) y
     "editor" (solo productos).
   - Solo por invitación: un usuario puede entrar cuando acepta su enlace (accepted_at).
     La Agencia no necesita invitación: su usuario se crea solo al primer ingreso.
   - Dos formas de entrar: correo + contraseña, o Google (OpenID Connect).
     Con Google solo entra quien ya está en admin_users y activo.
   - Sesión: token aleatorio en cookie HttpOnly; en la base solo va su SHA-256.
   - Contraseñas: PBKDF2-SHA256 (WebCrypto, 100 000 iteraciones, sal aleatoria).
   - Límite: 8 fallos por correo o 30 por IP cada 15 minutos.
   Variables: GOOGLE_CLIENT_ID (pública) y GOOGLE_CLIENT_SECRET (secreto).
   Sin ellas, el botón de Google no aparece y solo funciona la contraseña.
   ===================================================================== */
import { getDb } from './db.js';

const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000;        // máximo que admite WebCrypto en Workers
const enc = new TextEncoder();

/* ---------- utilidades ---------- */
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function fromB64u(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const randomToken = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));
async function sha256(text) { return b64u(await crypto.subtle.digest('SHA-256', enc.encode(text))); }
function sameBytes(a, b) {                       // comparación en tiempo constante
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
export const normEmail = (e) => String(e || '').trim().toLowerCase();
export const validEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e);

/* ---------- contraseñas ---------- */
async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64u(salt)}$${b64u(hash)}`;
}
export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const hash = await pbkdf2(password, fromB64u(parts[2]), Number(parts[1]));
  return sameBytes(hash, fromB64u(parts[3]));
}
export function passwordProblem(p) {
  if (typeof p !== 'string' || p.length < 10) return 'La contraseña debe tener al menos 10 caracteres';
  if (p.length > 200) return 'La contraseña es demasiado larga';
  return null;
}
// hash fijo para gastar el mismo tiempo cuando el correo no existe (no revela qué correos hay)
let dummyHash = null;

/* ---------- Agencia (superadmin) ---------- */
export const superEmails = (env) => String(env.SUPERADMIN_EMAILS || '').split(',').map(normEmail).filter(Boolean);
export const isSuper = (env, email) => superEmails(env).includes(normEmail(email));
/** Garantiza que la Agencia exista, esté activa y aceptada (no depende de invitaciones). */
export async function ensureSuper(db, env, email) {
  if (!isSuper(env, email)) return;
  await db.query(
    `insert into admin_users (email, role, accepted_at) values ($1, 'owner', now())
     on conflict (email) do update set active = true, role = 'owner', accepted_at = coalesce(admin_users.accepted_at, now())`,
    [normEmail(email)]);
}
const INVITE_DAYS = 7;
/** Crea un enlace de invitación nuevo (invalida los anteriores). Devuelve el token. */
export async function createInvite(db, userId) {
  const token = randomToken();
  await db.query('delete from admin_invites where user_id = $1', [userId]);
  await db.query(`insert into admin_invites (token_hash, user_id, expires_at) values ($1, $2, now() + interval '${INVITE_DAYS} days')`,
    [await sha256(token), userId]);
  return token;
}
async function findInvite(db, token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const rows = await db.query(
    `select i.token_hash, i.user_id, u.email, u.name, u.role
       from admin_invites i join admin_users u on u.id = i.user_id
      where i.token_hash = $1 and i.used_at is null and i.expires_at > now() and u.active`, [await sha256(token)]);
  return rows[0] || null;
}
async function consumeInvite(db, inv) {
  await db.query('update admin_invites set used_at = now() where token_hash = $1', [inv.token_hash]);
  await db.query('update admin_users set accepted_at = coalesce(accepted_at, now()) where id = $1', [inv.user_id]);
}

/* ---------- cookies ---------- */
// __Host- exige Secure, Path=/ y sin Domain: la cookie no se puede leer ni pisar desde subdominios
const cookieName = (url) => (url.protocol === 'https:' ? '__Host-admin_session' : 'admin_session');
function readCookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + name.replace(/[-_]/g, '\\$&') + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function setCookie(url, name, value, maxAge) {
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/* ---------- sesiones ---------- */
async function createSession(env, request, userId) {
  const url = new URL(request.url);
  const token = randomToken();
  const db = getDb(env);
  await db.query(
    `insert into admin_sessions (token_hash, user_id, expires_at, user_agent)
     values ($1, $2, now() + ($3 || ' days')::interval, $4)`,
    [await sha256(token), userId, String(SESSION_DAYS), (request.headers.get('User-Agent') || '').slice(0, 300)]);
  await db.query('update admin_users set last_login_at = now() where id = $1', [userId]);
  await db.query('delete from admin_sessions where expires_at < now()');
  return setCookie(url, cookieName(url), token, SESSION_DAYS * 86400);
}

/** Usuario de la sesión actual { id, email, name, role } o null. */
export async function getAdmin(request, env) {
  const url = new URL(request.url);
  const token = readCookie(request, cookieName(url));
  if (!token || token.length > 100) return null;
  const db = getDb(env);
  const rows = await db.query(
    `select u.id, u.email, u.name, u.role, u.password_hash is not null as has_password, s.expires_at
       from admin_sessions s join admin_users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now() and u.active and u.accepted_at is not null`,
    [await sha256(token)]);
  if (!rows.length) return null;
  const u = rows[0];
  // sesión deslizante: si le quedan menos de 15 días, se extiende otros 30
  if (new Date(u.expires_at).getTime() - Date.now() < 15 * 86400e3) {
    await db.query(`update admin_sessions set expires_at = now() + interval '${SESSION_DAYS} days' where token_hash = $1`, [await sha256(token)]);
  }
  return { id: String(u.id), email: u.email, name: u.name, role: isSuper(env, u.email) ? 'superadmin' : u.role, has_password: u.has_password };
}

/* ---------- límite de intentos ---------- */
const clientIp = (request) => request.headers.get('CF-Connecting-IP') || 'local';
async function tooManyAttempts(db, email, ip) {
  const rows = await db.query(
    `select
       count(*) filter (where email = $1) as by_email,
       count(*) filter (where ip = $2)    as by_ip
     from login_attempts
     where not ok and created_at > now() - interval '15 minutes' and (email = $1 or ip = $2)`, [email, ip]);
  return Number(rows[0].by_email) >= 8 || Number(rows[0].by_ip) >= 30;
}
async function recordAttempt(db, email, ip, ok) {
  await db.query('insert into login_attempts (email, ip, ok) values ($1, $2, $3)', [email.slice(0, 320), ip, ok]);
  if (Math.random() < 0.05) await db.query(`delete from login_attempts where created_at < now() - interval '1 day'`);
}

/* ---------- respuestas ---------- */
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const redirect = (location, cookies = []) => {
  const h = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  cookies.forEach((c) => h.append('Set-Cookie', c));
  return new Response(null, { status: 302, headers: h });
};
// solo rutas internas del dashboard como destino tras el login (evita redirecciones abiertas)
const safeNext = (n) => (typeof n === 'string' && /^\/admin(\/[^\s\\]*)?$/.test(n) && !n.startsWith('//') ? n : '/admin/');

/* ---------- Google (OpenID Connect, flujo de código con PKCE) ---------- */
const googleEnabled = (env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

async function googleStart(request, env, url) {
  if (!googleEnabled(env)) return redirect('/admin/login?error=google_off');
  const state = randomToken(16), verifier = randomToken(32);
  const challenge = b64u(await crypto.subtle.digest('SHA-256', enc.encode(verifier)));
  const next = safeNext(url.searchParams.get('next'));
  const invite = (url.searchParams.get('invite') || '').slice(0, 100);
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID, redirect_uri: `${url.origin}/api/auth/google/callback`,
    response_type: 'code', scope: 'openid email profile', state,
    code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account'
  }).toString();
  const payload = JSON.stringify({ state, verifier, next, invite });
  return redirect(auth.toString(), [setCookie(url, 'admin_oauth', payload, 600)]);
}

async function googleCallback(request, env, url) {
  const fail = (code) => redirect(`/admin/login?error=${code}`, [setCookie(url, 'admin_oauth', '', 0)]);
  if (!googleEnabled(env)) return fail('google_off');
  let saved; try { saved = JSON.parse(readCookie(request, 'admin_oauth') || 'null'); } catch { saved = null; }
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  if (!saved || !code || !state || state !== saved.state) return fail('google_state');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/auth/google/callback`, grant_type: 'authorization_code', code_verifier: saved.verifier
    })
  });
  if (!res.ok) return fail('google_token');
  const { id_token } = await res.json();
  // el id_token llega directo de Google por HTTPS en respuesta a nuestro secreto: basta validar sus campos
  let claims; try { claims = JSON.parse(new TextDecoder().decode(fromB64u(id_token.split('.')[1]))); } catch { return fail('google_token'); }
  const now = Math.floor(Date.now() / 1000);
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) || claims.aud !== env.GOOGLE_CLIENT_ID ||
      !(claims.exp > now) || claims.email_verified !== true) return fail('google_token');

  const email = normEmail(claims.email), db = getDb(env), ip = clientIp(request);
  if (await tooManyAttempts(db, email, ip)) return fail('limit');
  let rows;
  if (saved.invite) {
    // aceptar invitación con Google: la cuenta de Google debe ser la del correo invitado
    const inv = await findInvite(db, saved.invite);
    if (!inv) return fail('invite_invalid');
    if (inv.email !== email) { await recordAttempt(db, email, ip, false); return fail('invite_email'); }
    await consumeInvite(db, inv);
    rows = [{ id: inv.user_id, name: inv.name }];
  } else {
    await ensureSuper(db, env, email);
    rows = await db.query('select id, name from admin_users where email = $1 and active and accepted_at is not null', [email]);
  }
  if (!rows.length) { await recordAttempt(db, email, ip, false); return fail('not_allowed'); }
  await recordAttempt(db, email, ip, true);
  if (!rows[0].name && claims.name) await db.query('update admin_users set name = $2 where id = $1', [rows[0].id, String(claims.name).slice(0, 120)]);
  const cookie = await createSession(env, request, rows[0].id);
  return redirect(saved.next || '/admin/', [cookie, setCookie(url, 'admin_oauth', '', 0)]);
}

/* ---------- rutas públicas de /api/auth/* ---------- */
export async function authApi(request, env, url) {
  const path = url.pathname.replace(/^\/api\/auth\/?/, '');
  const db = getDb(env);

  if (path === 'config' && request.method === 'GET') return json({ google: googleEnabled(env) });
  if (path === 'google' && request.method === 'GET') return googleStart(request, env, url);
  if (path === 'google/callback' && request.method === 'GET') return googleCallback(request, env, url);

  // GET /api/auth/invite?token=… → a quién está dirigida la invitación
  if (path === 'invite' && request.method === 'GET') {
    const inv = await findInvite(db, url.searchParams.get('token'));
    if (!inv) return json({ error: 'Esta invitación no es válida o ya venció. Pide un enlace nuevo.' }, 404);
    return json({ email: inv.email, name: inv.name, role: inv.role, google: googleEnabled(env) });
  }

  if (request.method !== 'POST') return json({ error: 'Ruta no encontrada' }, 404);
  const origin = request.headers.get('Origin');
  if (request.headers.get('X-Admin') !== '1' || (origin && origin !== url.origin)) return json({ error: 'Origen no permitido' }, 403);

  if (path === 'login') {
    let body; try { body = await request.json(); } catch { body = {}; }
    const email = normEmail(body.email), password = typeof body.password === 'string' ? body.password : '';
    const ip = clientIp(request);
    if (!validEmail(email) || !password) return json({ error: 'Escribe tu correo y tu contraseña' }, 400);
    if (await tooManyAttempts(db, email, ip)) return json({ error: 'Demasiados intentos. Espera 15 minutos.' }, 429);
    await ensureSuper(db, env, email);
    const rows = await db.query('select id, password_hash from admin_users where email = $1 and active and accepted_at is not null', [email]);
    const user = rows[0];
    if (!dummyHash) dummyHash = await hashPassword(randomToken());
    const ok = await verifyPassword(password, user && user.password_hash ? user.password_hash : dummyHash) && !!(user && user.password_hash);
    await recordAttempt(db, email, ip, ok);
    if (!ok) return json({ error: 'Correo o contraseña incorrectos' }, 401);
    const cookie = await createSession(env, request, user.id);
    return json({ ok: true, next: safeNext(body.next) }, 200, { 'Set-Cookie': cookie });
  }

  // POST /api/auth/invite/accept { token, password } → crea la contraseña y entra
  if (path === 'invite/accept') {
    let body; try { body = await request.json(); } catch { body = {}; }
    const inv = await findInvite(db, body.token);
    if (!inv) return json({ error: 'Esta invitación no es válida o ya venció. Pide un enlace nuevo.' }, 404);
    const problem = passwordProblem(body.password); if (problem) return json({ error: problem }, 400);
    await db.query('update admin_users set password_hash = $2 where id = $1', [inv.user_id, await hashPassword(body.password)]);
    await consumeInvite(db, inv);
    const cookie = await createSession(env, request, inv.user_id);
    return json({ ok: true, next: '/admin/' }, 200, { 'Set-Cookie': cookie });
  }

  if (path === 'logout') {
    const token = readCookie(request, cookieName(url));
    if (token) await db.query('delete from admin_sessions where token_hash = $1', [await sha256(token)]);
    return json({ ok: true }, 200, { 'Set-Cookie': setCookie(url, cookieName(url), '', 0) });
  }

  return json({ error: 'Ruta no encontrada' }, 404);
}

