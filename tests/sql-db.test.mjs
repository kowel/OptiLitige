import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { SCHEMA, sqlDatabase, toPostgres } from '../app/server/sql-db.ts';

test('paramètres « ? » et « ?N » traduits en $N, hors chaînes et commentaires', () => {
  assert.equal(toPostgres('SELECT ? , ?'), 'SELECT $1 , $2');
  assert.equal(
    toPostgres('WHERE a = ?1 OR b = ?1 AND c = ?2'),
    'WHERE a = $1 OR b = $1 AND c = $2',
  );
  assert.equal(toPostgres("SELECT '?' , ?"), "SELECT '?' , $1");
  assert.equal(toPostgres("-- l'agent ?\nSELECT ?"), "-- l'agent ?\nSELECT $1");
});

test('base PostgreSQL : first, all, run (lignes modifiées) et batch en transaction', async () => {
  const pg = new PGlite();
  await pg.exec(SCHEMA);
  const runner = (q) => async (text, params) => {
    const r = await q.query(text, params);
    return { rows: r.rows, changes: r.affectedRows ?? 0 };
  };
  const db = sqlDatabase({
    run: runner(pg),
    transaction: (work) => pg.transaction((tx) => work(runner(tx))),
  });
  const ins = await db
    .prepare('INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT (id) DO NOTHING')
    .bind('a', '{"x":1}')
    .run();
  assert.equal(ins.meta.changes, 1);
  const again = await db
    .prepare('INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT (id) DO NOTHING')
    .bind('a', '{}')
    .run();
  assert.equal(again.meta.changes, 0);
  assert.deepEqual(await db.prepare('SELECT payload FROM settings WHERE id=?').bind('a').first(), {
    payload: '{"x":1}',
  });
  assert.equal(await db.prepare('SELECT payload FROM settings WHERE id=?').bind('b').first(), null);
  await db.batch([
    db.prepare('INSERT INTO members(email,name,role) VALUES (?,?,?)').bind('a@x.fr', 'A', 'RC'),
    db.prepare('INSERT INTO members(email,name,role) VALUES (?,?,?)').bind('b@x.fr', 'B', 'SAV'),
  ]);
  assert.equal((await db.prepare('SELECT * FROM members').all()).results.length, 2);
  // Une requête en échec annule tout le lot
  await assert.rejects(
    db.batch([
      db.prepare('INSERT INTO members(email,name,role) VALUES (?,?,?)').bind('c@x.fr', 'C', 'RC'),
      db.prepare('INSERT INTO members(email,name,role) VALUES (?,?,?)').bind('a@x.fr', 'A', 'RC'),
    ]),
  );
  assert.equal((await db.prepare('SELECT * FROM members').all()).results.length, 2);
  await pg.close();
});

test('cleanText : caractère nul et moitiés d’emoji isolées rendus acceptables par PostgreSQL', async () => {
  const { cleanText } = await import('../app/server/sql-db.ts');
  // Emoji entier et barre oblique saisie par l'agent : intacts
  const ok = JSON.stringify({ t: 'Colis 📦 abîmé \\u0000 \\ud83d C:\\dossier' });
  assert.equal(cleanText(ok), ok);
  // Caractère nul (brut ou échappé) retiré, moitié d'emoji isolée remplacée
  assert.equal(cleanText('a\u0000b'), 'ab');
  const bad = JSON.stringify({ t: 'x\u0000y' + '📦'.slice(0, 1) + 'z' + '📦'.slice(1) });
  const pg = new PGlite();
  const cleaned = cleanText(bad);
  const r = await pg.query('SELECT ($1::text)::jsonb->>\'t\' AS t', [cleaned]);
  assert.equal(r.rows[0].t, 'xy\ufffdz\ufffd');
  await pg.close();
});
