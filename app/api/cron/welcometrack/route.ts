// Tâche planifiée Vercel (vercel.json → crons, chaque nuit) : relit l'alerte interne Welcometrack
// (GET /alerts/get, lecture seule) et met à jour le nombre d'expéditions par mois et par
// transporteur (ratio litiges / expéditions). Rien ne se passe tant que la clé Welcometrack et
// le n° de l'alerte ne sont pas réglés dans Paramètres.
//
// Appel réservé à Vercel : en-tête « Authorization: Bearer <CRON_SECRET> ».
import { env } from '../../../server/env';
import { carriers } from '../../../catalogs';
import { CARRIER_API_KEY, mergeSecrets } from '../../../tracking-providers.mjs';
import { syncWtShipments, wtSyncState } from '../../welcometrack-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (secret.length < 16) return Response.json({ error: 'Tâche non configurée.' }, { status: 503 });
  if (req.headers.get('authorization') !== 'Bearer ' + secret)
    return Response.json({ error: 'Accès refusé.' }, { status: 401 });
  const db = env.DB;
  const state = await wtSyncState(db);
  const keys = await db
    .prepare('SELECT payload FROM settings WHERE id=?')
    .bind(CARRIER_API_KEY)
    .first<{ payload: string }>();
  const secrets = mergeSecrets(env, keys ? JSON.parse(keys.payload) : {});
  if (!state.alertId || !secrets.WELCOMETRACK_API_KEY)
    return Response.json({ ok: true, skipped: 'Welcometrack non réglé' });
  const catalogRow = await db
    .prepare('SELECT payload FROM settings WHERE id=?')
    .bind('catalogs')
    .first<{ payload: string }>();
  const ours = (catalogRow ? JSON.parse(catalogRow.payload).carriers : null) || carriers;
  const result = await syncWtShipments(
    db,
    secrets.WELCOMETRACK_API_KEY,
    ours,
    'Import automatique',
  );
  return Response.json({ ok: !!result.ok, message: result.message });
}
