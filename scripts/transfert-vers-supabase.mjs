// Copie la base de la version Cloudflare (fichier SQLite de D1) vers PostgreSQL :
// la base Supabase (DATABASE_URL), ou la base locale de cette version (PGlite, .donnees-locales).
// Les pièces jointes suivent vers Supabase Storage, lues au choix :
//   --r2-local "<dossier .wrangler/state/v3/r2 du poste>" : directement dans le stockage local du
//        poste projet (pnpm dev de la version Cloudflare) ; seules les pièces encore rattachées
//        à un dossier ou à un contentieux sont envoyées ;
//   --fichiers "<dossier pieces-jointes>" : dans une sauvegarde (« pnpm run sauvegarde »).
//   --liste-seulement : compte les pièces et leur taille, sans rien envoyer.
//
//   node scripts/transfert-vers-supabase.mjs --source "<fichier .sqlite ou base.sql>"
//        [--r2-local "<dossier r2>" | --fichiers "<dossier pieces-jointes>"] [--remplacer]
//
//   Sans DATABASE_URL : base locale (.donnees-locales/base). Avec DATABASE_URL, SUPABASE_URL et
//   SUPABASE_SERVICE_ROLE_KEY : Supabase. --remplacer vide d'abord les tables de destination.
//   Relançable : une ligne déjà présente est remplacée par celle de la source.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { contentTypeOf } from '../app/attachment-rules.mjs';
import { cleanText } from '../app/server/sql-db.ts';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : '';
};
const source = opt('source');
const files = opt('fichiers');
const r2local = opt('r2-local');
const listOnly = args.includes('--liste-seulement');
if (!source || !existsSync(source)) {
  console.error('Indiquez la base source : --source "<fichier .sqlite de D1>"');
  process.exit(1);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS members (email text PRIMARY KEY NOT NULL, name text NOT NULL, role text NOT NULL);
CREATE TABLE IF NOT EXISTS records (id text PRIMARY KEY NOT NULL, payload text NOT NULL, version integer DEFAULT 1 NOT NULL);
CREATE TABLE IF NOT EXISTS settings (id text PRIMARY KEY NOT NULL, payload text NOT NULL);
CREATE INDEX IF NOT EXISTS settings_id_c ON settings (id COLLATE "C");`;

// Source : fichier SQLite de D1, ou export SQL (base.sql de « pnpm run sauvegarde »)
let src;
if (/.sql$/i.test(source)) {
  src = new DatabaseSync(':memory:');
  src.exec(readFileSync(source, 'utf8'));
} else src = new DatabaseSync(source, { readOnly: true });
// --liste-seulement : aucune écriture dans la base
if (!listOnly) {
// Destination : Supabase (postgres) ou PGlite local
const url = process.env.DATABASE_URL?.trim();
let run, close;
if (url) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    connectionString: url,
    ssl: /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  run = async (text, params = []) => (await client.query(text, params)).rows;
  close = () => client.end();
  console.log('Destination : base Supabase (DATABASE_URL)');
} else {
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = join(process.env.OPTILITIGE_ETAT || '.donnees-locales', 'base');
  mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir);
  run = async (text, params = []) => (await pg.query(text, params)).rows;
  close = () => pg.close();
  console.log('Destination : base locale (' + dir + ')');
}
for (const stmt of SCHEMA.split(';').filter((s) => s.trim())) await run(stmt);
if (args.includes('--remplacer')) {
  await run('DELETE FROM records');
  await run('DELETE FROM settings');
  await run('DELETE FROM members');
}

// Compte de test du poste projet (connexion simulée seedy@sites.test, identifiant local_seedy) :
// jamais repris en ligne. Le propriétaire en ligne vient de OWNER_EMAIL, pas de la ligne « owner ».
const TEST_ACCOUNT = /local_seedy|@sites\.test/i;
const keep = {
  members: (row) => !TEST_ACCOUNT.test(row.email),
  records: () => true,
  settings: (row) =>
    !TEST_ACCOUNT.test(row.id) && !(row.id === 'owner' && TEST_ACCOUNT.test(row.payload)),
};
const copy = async (table, cols, conflict) => {
  const all = src.prepare('SELECT ' + cols.join(',') + ' FROM ' + table).all();
  const rows = all.filter(keep[table]);
  if (rows.length < all.length)
    console.log(table + ' : ' + (all.length - rows.length) + ' ligne(s) du compte de test écartée(s)');
  const marks = cols.map((_, i) => '$' + (i + 1)).join(',');
  const update = cols
    .filter((c) => c !== conflict)
    .map((c) => c + '=excluded.' + c)
    .join(',');
  for (const row of rows)
    await run(
      `INSERT INTO ${table}(${cols.join(',')}) VALUES (${marks}) ON CONFLICT (${conflict}) DO UPDATE SET ${update}`,
      // Même nettoyage que l'outil (caractère nul, moitiés d'emoji : refusés par PostgreSQL)
      cols.map((c) => (typeof row[c] === 'string' ? cleanText(row[c]) : row[c])),
    );
  console.log(table + ' : ' + rows.length + ' ligne(s)');
};
await copy('members', ['email', 'name', 'role'], 'email');
await copy('records', ['id', 'payload', 'version'], 'id');
await copy('settings', ['id', 'payload'], 'id');
// Contrôle : chaque dossier et chaque réglage doit se lire comme JSON dans PostgreSQL
const unreadable = await run(
  `SELECT id FROM records WHERE NOT (payload::jsonb IS NOT NULL)
   UNION ALL SELECT id FROM settings WHERE left(payload, 1) IN ('{', '[') AND NOT (payload::jsonb IS NOT NULL)`,
);
console.log('Contrôle JSON : ' + (unreadable.length ? unreadable.length + ' ligne(s) illisible(s)' : 'tout est lisible'));
await close();
}

// Pièces jointes du stockage local de la version Cloudflare (Miniflare) : index SQLite
// (clé → fichier) et fichiers dans <bucket>/blobs. Liste tirée des dossiers et contentieux repris.
function fromLocalR2(dir) {
  const metaDir = join(dir, 'miniflare-R2BucketObject');
  const index = readdirSync(metaDir)
    .filter((n) => /^[0-9a-f]{64}[.]sqlite$/.test(n))
    .map((n) => join(metaDir, n))
    .sort((a, b) => statSync(b).size - statSync(a).size)[0];
  if (!index) throw new Error('Index du stockage local introuvable dans ' + metaDir);
  const blobs = join(dir, opt('r2-bucket') || 'rclient-local', 'blobs');
  const blobOf = new DatabaseSync(index, { readOnly: true }).prepare(
    'SELECT blob_id FROM _mf_objects WHERE key=?',
  );
  const list = [];
  let missing = 0;
  const add = (key, name) => {
    const b = blobOf.get(key);
    if (!b?.blob_id || !existsSync(join(blobs, b.blob_id))) return missing++;
    list.push({ file: join(blobs, b.blob_id), key, name });
  };
  for (const r of src.prepare('SELECT id, payload FROM records').all())
    for (const a of JSON.parse(r.payload).attachments || []) add('attachments/' + r.id + '/' + a.id, a.name);
  for (const r of src.prepare("SELECT id, payload FROM settings WHERE id LIKE 'contentieux:%'").all())
    for (const a of JSON.parse(r.payload).attachments || [])
      add('contentieux/' + r.id.slice('contentieux:'.length) + '/' + a.id, a.name);
  if (missing) console.log('  ' + missing + ' pièce(s) jointe(s) absente(s) du stockage local : non envoyée(s)');
  return list;
}

// Pièces jointes : chaque fichier garde sa clé (attachments/<dossier>/<pièce>, contentieux/…)
if (files || r2local) {
  // Sauvegarde de la version Cloudflare : index.json donne la pièce de chaque fichier
  // (fichier « <dossier>/<pièce> - <nom> » → clé attachments/<dossier>/<pièce>) ; sinon les
  // fichiers sont rangés directement sous leur clé
  const indexFile = join(files, 'index.json');
  const walk = (dir) =>
    readdirSync(dir).flatMap((n) =>
      statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)],
    );
  const list = r2local
    ? fromLocalR2(r2local)
    : existsSync(indexFile)
    ? JSON.parse(readFileSync(indexFile, 'utf8')).map((e) => ({
        file: join(files, '..', e.fichier),
        key: 'attachments/' + e.dossier + '/' + e.piece,
        name: e.nom,
      }))
    : walk(files).map((file) => ({ file, key: relative(files, file).split(sep).join('/'), name: file }));
  const total = list.reduce((n, f) => n + statSync(f.file).size, 0);
  console.log('Pièces jointes : ' + list.length + ' fichier(s), ' + (total / 1073741824).toFixed(2) + ' Go');
  if (listOnly) process.exit(0);
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !key) {
    console.error('Pièces jointes : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont nécessaires.');
    process.exit(1);
  }
  const { createClient } = await import('@supabase/supabase-js');
  const storage = createClient(supabaseUrl, key, { auth: { persistSession: false } }).storage.from(
    process.env.SUPABASE_BUCKET?.trim() || 'pieces-jointes',
  );
  // Relançable : un fichier déjà présent avec la même taille n'est pas renvoyé (liste lue une
  // fois par dossier) ; chaque envoi est retenté 3 fois avant d'être signalé.
  const present = new Map();
  const sizesIn = async (dir) => {
    if (!present.has(dir)) {
      const sizes = new Map();
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await storage.list(dir, { limit: 1000, offset });
        if (error || !data?.length) break;
        for (const o of data) sizes.set(o.name, o.metadata?.size ?? -1);
        if (data.length < 1000) break;
      }
      present.set(dir, sizes);
    }
    return present.get(dir);
  };
  let sent = 0,
    skipped = 0;
  const failed = [];
  for (const { file, key: k, name } of list) {
    const dir = k.slice(0, k.lastIndexOf('/'));
    const size = statSync(file).size;
    if ((await sizesIn(dir)).get(k.slice(dir.length + 1)) === size) {
      skipped++;
      continue;
    }
    let error = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      ({ error } = await storage.upload(k, readFileSync(file), {
        upsert: true,
        // Type déduit du nom, comme pour les envois depuis l'outil (affichage des photos)
        contentType: contentTypeOf(name),
      }));
      if (!error) break;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
    if (error) {
      failed.push(k);
      console.error('  ' + k + ' (' + (size / 1048576).toFixed(1) + ' Mo) : ' + error.message);
    } else if (++sent % 100 === 0) console.log('  ' + sent + ' fichier(s) envoyé(s)…');
  }
  console.log(
    'Pièces jointes : ' +
      sent +
      ' envoyée(s), ' +
      skipped +
      ' déjà présente(s), ' +
      failed.length +
      ' en échec' +
      (failed.length ? ' (relancer la commande ; au-delà de 50 Mo, relever la limite dans Storage → Settings)' : ''),
  );
  if (failed.length) process.exitCode = 1;
}
