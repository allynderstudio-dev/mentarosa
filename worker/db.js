/* Acceso a Postgres.
   Producción: Neon por HTTP (puerto 443, sin conexiones abiertas: ideal para Workers
   y para redes donde el 5432 se corta). En desarrollo local, dev/server.mjs inyecta
   env.__db con PGlite y la misma interfaz. */
import { neon } from '@neondatabase/serverless';

export function getDb(env) {
  if (env.__db) return env.__db;
  if (!env.DATABASE_URL) throw new Error('Falta el secreto DATABASE_URL');
  const sql = neon(env.DATABASE_URL);
  return {
    query: (text, params = []) => sql.query(text, params),
    // varias sentencias en una sola transacción: [[texto, params], …]
    tx: (list) => sql.transaction(list.map(([t, p]) => sql.query(t, p || [])))
  };
}
