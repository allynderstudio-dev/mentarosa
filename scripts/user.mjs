/* Usuarios del dashboard desde la terminal (para el primer dueño, o si alguien pierde el acceso).
   Usa la DATABASE_URL de .dev.vars (o de la variable de entorno).

     npm run user -- list
     npm run user -- add correo@dominio.com --owner      (sin contraseña: entra con Google)
     npm run user -- password correo@dominio.com         (pide la contraseña sin mostrarla)
     npm run user -- remove correo@dominio.com
*/
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { hashPassword, passwordProblem, normEmail, validEmail } from '../worker/auth.js';
import { applySchema } from './seed-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vars = await fs.readFile(path.join(ROOT, '.dev.vars'), 'utf8').catch(() => '');
const DATABASE_URL = process.env.DATABASE_URL || /^DATABASE_URL=(.+)$/m.exec(vars)?.[1]?.trim();
if (!DATABASE_URL) { console.error('Falta DATABASE_URL en .dev.vars'); process.exit(1); }
const sql = neon(DATABASE_URL);
const db = { query: (t, p = []) => sql.query(t, p) };

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };   // no muestra lo que se escribe
    rl.question(question, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}

const [cmd, emailArg, ...rest] = process.argv.slice(2);
const email = normEmail(emailArg);
await applySchema(ROOT, db);

if (cmd === 'list') {
  const rows = await db.query('select email, role, active, password_hash is not null as pass, last_login_at from admin_users order by created_at');
  console.table(rows.map((r) => ({ correo: r.email, rol: r.role, activo: r.active, contraseña: r.pass ? 'sí' : 'no (solo Google)', último_ingreso: r.last_login_at })));
} else if (cmd === 'add') {
  if (!validEmail(email)) { console.error('Correo no válido'); process.exit(1); }
  const role = rest.includes('--owner') ? 'owner' : 'editor';
  await db.query('insert into admin_users (email, role, accepted_at) values ($1, $2, now()) on conflict (email) do update set role = excluded.role, active = true, accepted_at = coalesce(admin_users.accepted_at, now())', [email, role]);
  console.log(`Listo: ${email} (${role === 'owner' ? 'dueño' : 'editor'}). Puede entrar con Google; para contraseña: npm run user -- password ${email}`);
} else if (cmd === 'password') {
  const rows = await db.query('select id from admin_users where email = $1', [email]);
  if (!rows.length) { console.error('Ese correo no tiene acceso. Agrégalo primero con: npm run user -- add'); process.exit(1); }
  const p1 = await askHidden('Nueva contraseña (mín. 10 caracteres): ');
  const problem = passwordProblem(p1); if (problem) { console.error(problem); process.exit(1); }
  const p2 = await askHidden('Repítela: ');
  if (p1 !== p2) { console.error('No coinciden'); process.exit(1); }
  await db.query('update admin_users set password_hash = $2 where id = $1', [rows[0].id, await hashPassword(p1)]);
  await db.query('delete from admin_sessions where user_id = $1', [rows[0].id]);
  console.log('Contraseña guardada.');
} else if (cmd === 'remove') {
  const rows = await db.query('delete from admin_users where email = $1 returning id', [email]);
  console.log(rows.length ? 'Acceso quitado.' : 'Ese correo no tenía acceso.');
} else {
  console.log('Uso: npm run user -- list | add <correo> [--owner] | password <correo> | remove <correo>');
}
