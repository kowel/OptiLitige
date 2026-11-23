// Réglages et services du serveur : base PostgreSQL, stockage des fichiers et variables d'environnement.
//
//   DATABASE_URL            base PostgreSQL Supabase (« Transaction pooler », port 6543)
//   SUPABASE_URL            adresse du projet Supabase (https://….supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY  clé de service (serveur seulement, jamais dans le navigateur)
//   SUPABASE_BUCKET         compartiment des pièces jointes (défaut « pieces-jointes »)
//   OWNER_EMAIL, AUTH_MODE, ALLOWED_EMAIL_DOMAINS, clés transporteurs… : lus tels quels
//
// Sans DATABASE_URL, hors production : base PostgreSQL embarquée (PGlite) et fichiers dans
// .donnees-locales/ (OPTILITIGE_ETAT pour un autre dossier, utilisé par les tests).
import { Pool, type QueryResult } from 'pg';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SCHEMA, sqlDatabase, type Driver, type Runner, type SqlDatabase } from './sql-db';
import { localStore, supabaseStore, type FileStore } from './file-store';

const production = process.env.NODE_ENV === 'production';
export const localDir = () => process.env.OPTILITIGE_ETAT || '.donnees-locales';

type Cache = { db?: SqlDatabase; bucket?: FileStore | null };
const cache = ((globalThis as { __optilitige?: Cache }).__optilitige ||= {});

function postgresDriver(url: string): Driver {
  // Bibliothèque « pg » : chaque requête part en un seul échange, ce que le pooler Supabase en
  // mode transaction gère bien (avec postgres.js, des requêtes simultanées restaient bloquées).
  // Connexion chiffrée vers Supabase, sauf « sslmode=disable » dans l'adresse.
  const pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 20_000,
    ssl: /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false },
  });
  // Connexion inactive coupée par Supabase : ignorée, le pool en rouvre une
  pool.on('error', () => {});
  const runner =
    (q: { query: (text: string, values?: unknown[]) => Promise<QueryResult> }): Runner =>
    async (text, params) => {
      const r = await q.query(text, params as unknown[]);
      return { rows: r.rows as Record<string, unknown>[], changes: r.rowCount ?? 0 };
    };
  return {
    run: runner(pool),
    transaction: async (work) => {
      const client = await pool.connect();
      let result;
      try {
        await client.query('BEGIN');
        result = await work(runner(client));
        await client.query('COMMIT');
      } catch (e) {
        // Connexion abîmée (ROLLBACK impossible) : fermée au lieu d'être rendue au pool
        let broken: Error | undefined;
        await client.query('ROLLBACK').catch((err: Error) => (broken = err));
        client.release(broken);
        throw e;
      }
      client.release();
      return result;
    },
  };
}

function pgliteDriver(dir: string): Driver {
  // Chargé seulement en local : PostgreSQL complet dans le processus, sans installation
  let ready: Promise<import('@electric-sql/pglite').PGlite> | null = null;
  const pg = () =>
    (ready ||= (async () => {
      const { PGlite } = await import('@electric-sql/pglite');
      mkdirSync(join(dir, 'base'), { recursive: true });
      const db = new PGlite(join(dir, 'base'));
      await db.exec(SCHEMA);
      return db;
    })());
  type Q = { query: import('@electric-sql/pglite').PGlite['query'] };
  const runner =
    (q: Q): Runner =>
    async (text, params) => {
      const r = await q.query<Record<string, unknown>>(text, params as unknown[]);
      return { rows: r.rows, changes: r.affectedRows ?? 0 };
    };
  // Une seule requête à la fois sur PGlite : transactions mises en file
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>) => {
    const next = queue.then(work, work);
    queue = next.catch(() => undefined);
    return next;
  };
  return {
    run: (text, params) => serial(async () => runner(await pg())(text, params)),
    transaction: (work) => serial(async () => (await pg()).transaction((tx) => work(runner(tx)))),
  };
}

function database(): SqlDatabase {
  if (cache.db) return cache.db;
  const url = process.env.DATABASE_URL?.trim();
  if (!url && production) throw new Error('503|Base de données non configurée (DATABASE_URL).');
  cache.db = sqlDatabase(url ? postgresDriver(url) : pgliteDriver(localDir()));
  return cache.db;
}

function fileStore(): FileStore | undefined {
  if (cache.bucket !== undefined) return cache.bucket || undefined;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  cache.bucket =
    url && key
      ? supabaseStore(url, key, process.env.SUPABASE_BUCKET?.trim() || 'pieces-jointes')
      : production
        ? null
        : localStore(join(localDir(), 'fichiers'));
  return cache.bucket || undefined;
}

/** Comme l'objet « env » de Cloudflare : DB, BUCKET et les variables d'environnement */
export const env = new Proxy({} as Record<string, string | undefined>, {
  get(_, name: string) {
    if (name === 'DB') return database();
    if (name === 'BUCKET') return fileStore();
    return process.env[name];
  },
}) as Record<string, string | undefined> & { DB: SqlDatabase; BUCKET?: FileStore };
