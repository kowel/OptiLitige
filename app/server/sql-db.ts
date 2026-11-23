// Accès à la base PostgreSQL (Supabase en ligne, PGlite en local) avec la même forme que la base
// Cloudflare D1 de la version d'origine : prepare(sql).bind(...).first() / .all() / .run() et
// batch([...]). Les routes de l'API gardent ainsi leur code ; seules les requêtes propres à
// SQLite ont été traduites en PostgreSQL (fonctions JSON, INSERT … ON CONFLICT).
//
// Paramètres : « ? » (dans l'ordre) ou « ?1, ?2… » (numérotés), traduits en $1, $2… PostgreSQL.

export interface SqlResult<T = Record<string, unknown>> {
  results: T[];
  meta: { changes: number };
}

export interface SqlStatement {
  bind(...values: unknown[]): SqlStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<SqlResult<T>>;
  run<T = Record<string, unknown>>(): Promise<SqlResult<T>>;
}

export interface SqlDatabase {
  prepare(sql: string): SqlStatement;
  /** Plusieurs requêtes dans une seule transaction (tout ou rien) */
  batch<T = Record<string, unknown>>(statements: SqlStatement[]): Promise<SqlResult<T>[]>;
}

/** Exécute une requête : lignes renvoyées et nombre de lignes modifiées */
export type Runner = (
  text: string,
  params: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; changes: number }>;

export interface Driver {
  run: Runner;
  transaction<T>(work: (run: Runner) => Promise<T>): Promise<T>;
}

/** « ? » et « ?N » → « $N » (hors chaînes entre apostrophes) */
export function toPostgres(sql: string): string {
  let n = 0;
  let out = '';
  let quoted = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    // Commentaire « -- … » : recopié tel quel jusqu'à la fin de la ligne (apostrophes comprises)
    if (!quoted && ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end < 0 ? sql.length : end;
      out += sql.slice(i, stop);
      i = stop - 1;
      continue;
    }
    if (ch === "'") {
      quoted = !quoted;
      out += ch;
    } else if (ch === '?' && !quoted) {
      const m = /^\d+/.exec(sql.slice(i + 1));
      if (m) {
        out += '$' + m[0];
        i += m[0].length;
      } else out += '$' + ++n;
    } else out += ch;
  }
  return out;
}

/**
 * Texte accepté par PostgreSQL, y compris une fois lu comme JSON (payload::jsonb) : SQLite
 * acceptait le caractère nul et les moitiés d'emoji isolées, PostgreSQL les refuse — un seul
 * dossier touché ferait échouer la liste de tout le monde. Caractère nul retiré ; « \u0000 » et
 * moitié d'emoji isolée (« \ud83d » sans sa seconde moitié) retirés ou remplacés par « � ».
 * Une barre oblique saisie par l'agent (« \\u0000 » dans le JSON) n'est pas touchée.
 */
export function cleanText(s: string): string {
  if (!s.includes('\u0000') && !s.includes('\\u')) return s;
  return s
    .replace(/\u0000/g, '')
    .replace(/(?<!\\)((?:\\\\)*)\\u0000/g, '$1')
    .replace(
      /(?<!\\)((?:\\\\)*)\\u([dD][89abAB][0-9a-fA-F]{2})(?!\\u[dD][c-fC-F][0-9a-fA-F]{2})/g,
      '$1\\ufffd',
    )
    .replace(
      /(?<!\\u[dD][89abAB][0-9a-fA-F]{2})(?<!\\)((?:\\\\)*)\\u([dD][c-fC-F][0-9a-fA-F]{2})/g,
      '$1\\ufffd',
    );
}

// Valeurs envoyées à PostgreSQL : undefined → NULL, objets en JSON, textes nettoyés (cleanText)
const param = (v: unknown) =>
  v === undefined
    ? null
    : typeof v === 'string'
      ? cleanText(v)
      : typeof v === 'object' && v !== null
        ? cleanText(JSON.stringify(v))
        : v;

class Statement implements SqlStatement {
  private driver: Driver;
  readonly text: string;
  readonly params: unknown[];
  constructor(driver: Driver, text: string, params: unknown[] = []) {
    this.driver = driver;
    this.text = text;
    this.params = params;
  }
  bind(...values: unknown[]) {
    return new Statement(this.driver, this.text, values.map(param));
  }
  async exec<T>(run: Runner = this.driver.run): Promise<SqlResult<T>> {
    const r = await run(this.text, this.params);
    return { results: r.rows as T[], meta: { changes: r.changes } };
  }
  async first<T>() {
    return ((await this.exec<T>()).results[0] as T) ?? null;
  }
  all<T>() {
    return this.exec<T>();
  }
  run<T>() {
    return this.exec<T>();
  }
}

export function sqlDatabase(driver: Driver): SqlDatabase {
  return {
    prepare: (sql) => new Statement(driver, toPostgres(sql)),
    batch: <T>(statements: SqlStatement[]) =>
      driver.transaction(async (run) => {
        const results: SqlResult<T>[] = [];
        for (const s of statements) results.push(await (s as Statement).exec<T>(run));
        return results;
      }),
  };
}

/** Tables de l'outil (identiques à la version Cloudflare) */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS members (
  email text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  role text NOT NULL
);
CREATE TABLE IF NOT EXISTS records (
  id text PRIMARY KEY NOT NULL,
  payload text NOT NULL,
  version integer DEFAULT 1 NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY NOT NULL,
  payload text NOT NULL
);
CREATE INDEX IF NOT EXISTS settings_id_c ON settings (id COLLATE "C");`;
