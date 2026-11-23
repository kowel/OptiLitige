// Tâche planifiée Vercel (vercel.json → crons, chaque nuit) : vide la corbeille des pièces
// jointes, SEULEMENT si un admin l'a choisi dans Paramètres → Corbeille des pièces jointes.
// Par défaut, rien n'est effacé. Une pièce supprimée est rangée sous « corbeille/<date>/… »
// (app/server/file-store.ts) ; avec le vidage activé, elle est effacée après le délai choisi.
//
// Appel réservé à Vercel : en-tête « Authorization: Bearer <CRON_SECRET> » (variable à créer dans
// Vercel ; sans elle, la route reste fermée).
import { env } from '../../../server/env';
import { TRASH_SETTINGS_KEY, normalizeTrashSettings } from '../../../trash-settings.mjs';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (secret.length < 16) return Response.json({ error: 'Tâche non configurée.' }, { status: 503 });
  if (req.headers.get('authorization') !== 'Bearer ' + secret)
    return Response.json({ error: 'Accès refusé.' }, { status: 401 });
  const row = await env.DB.prepare('SELECT payload FROM settings WHERE id=?')
    .bind(TRASH_SETTINGS_KEY)
    .first<{ payload: string }>();
  const settings = normalizeTrashSettings(JSON.parse(row?.payload || 'null'));
  if (!settings.autoPurge) return Response.json({ ok: true, removed: 0, autoPurge: false });
  const store = env.BUCKET;
  if (!store?.move) return Response.json({ error: 'Stockage Supabase absent.' }, { status: 503 });
  const bucketId = process.env.SUPABASE_BUCKET?.trim() || 'pieces-jointes';
  const limit = new Date(Date.now() - settings.days * 86400e3).toISOString().slice(0, 10);
  // Liste lue dans la table du stockage Supabase (schéma « storage »), par lots
  let removed = 0;
  for (let round = 0; round < 20; round++) {
    const { results } = await env.DB.prepare(
      `SELECT name FROM storage.objects
        WHERE bucket_id = ? AND name ~ '^corbeille/[0-9]{4}-[0-9]{2}-[0-9]{2}/'
          AND substr(name, 11, 10) < ?
        ORDER BY name LIMIT 500`,
    )
      .bind(bucketId, limit)
      .all<{ name: string }>();
    if (!results.length) break;
    for (const { name } of results) await store.delete(name);
    removed += results.length;
    if (results.length < 500) break;
  }
  return Response.json({ ok: true, removed, before: limit });
}
