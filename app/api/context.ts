import { env } from '../server/env';
import { headers } from 'next/headers';
import { getCurrentUser, signInHref } from '../auth';
import { chosenProfile, loadProfiles, profileEmail } from './profiles';
import type { Dossier, Member, RecordRow, SettingRow } from '../types';

// Fonctions communes aux routes de l'API : réponse JSON, identité de l'agent, erreurs.
export const out = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });

/**
 * Grosse réponse JSON (liste de tous les dossiers) envoyée par morceaux : sur Vercel, une réponse
 * envoyée d'un bloc est limitée à 4,5 Mo, pas une réponse diffusée en continu.
 */
export function outStream(data: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const CHUNK = 256 * 1024;
  let at = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (at >= bytes.length) return controller.close();
        controller.enqueue(bytes.subarray(at, at + CHUNK));
        at += CHUNK;
      },
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    },
  );
}
// Rôle « Responsables » renommé « Admin » (20/11/2026) : comptes, vues du service, rapports
// programmés, étapes, dispositions des graphiques. Fait une seule fois par base (repère
// « migration:role-admin ») ; le journal des accès garde l'ancien nom (historique).
let rolesMigrated = false;
// Propriétaire déjà enregistré par cette instance du serveur : pas d'écriture à chaque appel
let ownerSaved = '';

/**
 * Lignes de réglages dont l'identifiant commence par `prefix` (notifications lues, journal…).
 * Comparaison octet par octet (COLLATE "C") : l'index settings_id_c sert, au lieu de relire toute
 * la table à chaque appel. Avec `limit` : les plus récentes d'abord (identifiants datés).
 */
export function settingsByPrefix(db: D1Database, prefix: string, limit?: number) {
  const end = prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
  return db
    .prepare(
      'SELECT id, payload FROM settings WHERE id COLLATE "C" >= ? AND id COLLATE "C" < ?' +
        (limit ? ' ORDER BY id COLLATE "C" DESC LIMIT ' + Math.floor(limit) : ''),
    )
    .bind(prefix, end)
    .all<{ id: string; payload: string }>();
}
export async function migrateRoles(db: D1Database) {
  if (rolesMigrated) return;
  const done = await db
    .prepare('SELECT 1 AS ok FROM settings WHERE id=?')
    .bind('migration:role-admin')
    .first();
  if (!done)
    await db.batch([
      db.prepare("UPDATE members SET role='Admin' WHERE role='Responsables'"),
      db.prepare(
        "UPDATE settings SET id='views-role:Admin' WHERE id='views-role:Responsables' AND NOT EXISTS (SELECT 1 FROM settings WHERE id='views-role:Admin')",
      ),
      db.prepare(
        `UPDATE settings SET payload=replace(replace(payload, '"Responsables"', '"Admin"'), ':Responsables"', ':Admin"')
         WHERE (payload LIKE '%"Responsables"%' OR payload LIKE '%:Responsables"%')
           AND id NOT LIKE 'access-log:%'`,
      ),
      db
        .prepare('INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT (id) DO NOTHING')
        .bind('migration:role-admin', new Date().toISOString()),
    ]);
  rolesMigrated = true;
}

export async function context() {
  const user = await getCurrentUser();
  if (!user) throw new Error('401|Connectez-vous pour accéder aux dossiers.');
  const db = env.DB!;
  if (!db) throw new Error('503|Base de données indisponible.');
  await migrateRoles(db);
  // Propriétaire : l'adresse OWNER_EMAIL quand elle est réglée (mise en ligne), sinon le premier
  // compte connecté (base locale). Avec OWNER_EMAIL, une base importée dont le propriétaire est
  // un compte de test reste accessible, et le premier venu ne devient jamais responsable.
  const ownerEmail = String((env as { OWNER_EMAIL?: string }).OWNER_EMAIL || '')
    .trim()
    .toLowerCase();
  const email = user.email.toLowerCase();
  // En ligne, le propriétaire doit être réglé : sinon le premier agent connecté deviendrait admin
  if (!ownerEmail && process.env.NODE_ENV === 'production')
    throw new Error('503|Propriétaire de l’outil non réglé sur le serveur (OWNER_EMAIL).');
  let isOwner = false;
  if (ownerEmail) {
    isOwner = email === ownerEmail;
    if (isOwner && ownerSaved !== user.userId) {
      await db
        .prepare(
          'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        )
        .bind('owner', user.userId)
        .run();
      ownerSaved = user.userId;
    }
  } else {
    await db
      .prepare('INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT (id) DO NOTHING')
      .bind('owner', user.userId)
      .run();
    const owner = await db
      .prepare('SELECT payload FROM settings WHERE id=?')
      .bind('owner')
      .first<SettingRow>();
    isOwner = owner!.payload === user.userId;
  }
  if (isOwner) {
    const before = await db
      .prepare('SELECT name, role FROM members WHERE email=?')
      .bind(email)
      .first<{ name: string; role: string }>();
    // Le propriétaire est toujours responsable (même désactivé ou absent d'une base importée)
    if (!before || before.role !== 'Admin') {
      await db
        .prepare(
          'INSERT INTO members(email,name,role) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role',
        )
        .bind(email, before?.name || user.displayName, 'Admin')
        .run();
      await logAccess(db, {
        by: email,
        byName: user.displayName,
        email,
        before: before || null,
        after: { name: before?.name || user.displayName, role: 'Admin' },
        note: ownerEmail
          ? 'Propriétaire de l’outil (adresse réglée à la mise en ligne)'
          : 'Premier compte connecté : propriétaire de l’outil',
      });
    }
  }
  const [member, profileMap] = await Promise.all([
    db
      .prepare('SELECT * FROM members WHERE email=?')
      .bind(user.email.toLowerCase())
      .first<Member>(),
    loadProfiles(db),
  ]);
  if (!member || member.role === 'Désactivé')
    throw new Error('403|Votre compte doit être autorisé par un admin.');
  // Adresse partagée par plusieurs personnes : le profil choisi devient l'agent (nom affiché,
  // identifiant « adresse#Prénom »). Sans choix, l'écran demande « Qui êtes-vous ? ».
  const profiles = profileMap[member.email] || [];
  if (profiles.length) {
    member.account = member.email;
    member.profiles = profiles;
    const chosen = chosenProfile((await headers()).get('cookie'));
    if (profiles.includes(chosen)) {
      member.profile = chosen;
      member.name = chosen;
      member.email = profileEmail(member.email, chosen);
    }
  }
  // Lectures (notifications lues) propres à chaque profil d'une adresse partagée
  const reader = user.userId + (member.profile ? '~' + member.profile.toLowerCase() : '');
  return { db, user, member, reader, profileMap };
}
// Journal des accès : chaque ajout, changement de service ou désactivation d'un agent est
// conservé dans settings (id « access-log:<date>:<uuid> », donc trié par date).
export const ACCESS_LOG_PREFIX = 'access-log:';
export async function logAccess(db: D1Database, entry: Record<string, unknown>) {
  const date = new Date().toISOString();
  await db
    .prepare('INSERT INTO settings(id,payload) VALUES (?,?)')
    .bind(ACCESS_LOG_PREFIX + date + ':' + crypto.randomUUID(), JSON.stringify({ date, ...entry }))
    .run();
}
export function failure(e: unknown) {
  const [code, ...message] = String((e as Error).message).split('|');
  const status = Number(code) || 500;
  // Erreur imprévue : gardée dans le journal du serveur (Vercel → Logs), jamais renvoyée au navigateur
  if (!Number(code)) console.error('[OptiLitige] erreur serveur :', e);
  let signIn: string | undefined;
  if (status === 401) {
    try {
      signIn = signInHref();
    } catch {}
  }
  return out(
    {
      error: message.length ? message.join('|') : 'Erreur du serveur. Réessayez.',
      ...(signIn ? { signIn } : {}),
    },
    status,
  );
}

// Modifie un dossier en relisant sa dernière version : ajouter une pièce jointe ou faire
// avancer une demande d'avoir ne doit pas échouer parce qu'un collègue a modifié un autre
// champ du dossier entre-temps.
export async function updateRecord(
  db: D1Database,
  id: string,
  change: (r: Dossier) => Response | void,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await db
      .prepare('SELECT payload, version FROM records WHERE id=?')
      .bind(id)
      .first<RecordRow>();
    if (!row) return out({ error: 'Dossier introuvable' }, 404);
    const r: Dossier = JSON.parse(row.payload);
    const refused = change(r);
    if (refused) return refused;
    const result = await db
      .prepare('UPDATE records SET payload=?, version=version+1 WHERE id=? AND version=?')
      .bind(JSON.stringify(r), id, row.version)
      .run();
    if (result.meta.changes) return null;
  }
  return out({ error: 'Le dossier est très sollicité. Réessayez dans un instant.' }, 409);
}
