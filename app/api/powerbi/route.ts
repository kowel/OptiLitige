import { env } from '../../server/env';
import { out, outStream } from '../context';
import {
  POWERBI_KEY,
  POWERBI_TABLES,
  expeditionRows,
  hashToken,
  litigeRows,
} from '../../powerbi.mjs';
import type { SettingRow } from '../../types';
export const dynamic = 'force-dynamic';

// Données pour Power BI, en lecture seule :
//
//   GET /api/powerbi?table=litiges      → une ligne par litige (volet transport compris)
//   GET /api/powerbi?table=expeditions  → une ligne par mois et par transporteur
//   Authorization: Bearer <jeton créé dans Paramètres → Power BI>
//
// Le jeton Power BI suffit : il n'y a pas de Cloudflare Access devant cette version (Vercel).

// Comparaison en temps constant des empreintes
function same(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function GET(req: Request) {
  const db = env.DB;
  if (!db) return out({ error: 'Base de données indisponible.' }, 503);
  const row = await db
    .prepare('SELECT payload FROM settings WHERE id=?')
    .bind(POWERBI_KEY)
    .first<SettingRow>();
  const saved = row ? JSON.parse(row.payload) : null;
  if (!saved?.hash) return out({ error: 'Connexion Power BI non activée.' }, 503);
  const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!given || !same(await hashToken(given), saved.hash))
    return out({ error: 'Jeton invalide.' }, 401);
  const table = new URL(req.url).searchParams.get('table') || 'litiges';
  if (!POWERBI_TABLES.includes(table))
    return out({ error: 'Table inconnue : litiges ou expeditions.' }, 400);
  // Dernière lecture, visible des responsables (au plus une écriture par heure)
  const now = new Date().toISOString();
  if (!saved.lastUsedAt || Date.parse(now) - Date.parse(saved.lastUsedAt) > 3600e3)
    // Seulement si le jeton n'a pas changé entre-temps : un jeton régénéré par un admin ne doit
    // jamais être remplacé par l'ancien
    await db
      .prepare('UPDATE settings SET payload=? WHERE id=? AND payload=?')
      .bind(JSON.stringify({ ...saved, lastUsedAt: now }), POWERBI_KEY, row!.payload)
      .run();
  if (table === 'expeditions') {
    const s = await db
      .prepare('SELECT payload FROM settings WHERE id=?')
      .bind('shipments')
      .first<SettingRow>();
    return out(expeditionRows(s ? JSON.parse(s.payload) : {}));
  }
  // Sans les parties lourdes inutiles à Power BI (historique, messages, pièces, données d'origine)
  const records = await db
    .prepare(
      "SELECT (payload::jsonb - 'sourceData' - 'history' - 'comments' - 'transportMessages' - 'description' - 'attachments')::text AS payload FROM records",
    )
    .all<{ payload: string }>();
  return outStream(litigeRows(records.results.map((r) => JSON.parse(r.payload))));
}
