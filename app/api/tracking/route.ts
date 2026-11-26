import { env } from '../../server/env';
import { context, failure, out } from '../context';
import { DEFAULT_TRACKING_LINKS, trackingLinksFor } from '../../parcel-tracking.mjs';
import {
  CARRIER_API_KEY,
  cacheFresh,
  fetchTracking,
  mergeSecrets,
  trackingProvider,
} from '../../tracking-providers.mjs';
import { wtCarriers } from '../welcometrack-store';
import type { RecordRow, SettingRow } from '../../types';
export const dynamic = 'force-dynamic';

// Suivi détaillé des colis d'un dossier, pour la fiche :
//   GET /api/tracking?id=<dossier>[&refresh=1]
// Pour chaque numéro du champ BT : étapes et événements lus sur l'API du transporteur
// (app/tracking-providers.mjs), gardés en cache dans settings (« track:<numéro> »).
export async function GET(req: Request) {
  try {
    const { db } = await context();
    const params = new URL(req.url).searchParams;
    const id = params.get('id') || '';
    if (!id || id.length > 200) return out({ error: 'Dossier invalide.' }, 400);
    const refresh = params.get('refresh') === '1';
    const row = await db
      .prepare('SELECT payload FROM records WHERE id=?')
      .bind(id)
      .first<RecordRow>();
    if (!row) return out({ error: 'Dossier introuvable' }, 404);
    const record = JSON.parse(row.payload);
    const saved = await db
      .prepare('SELECT payload FROM settings WHERE id=?')
      .bind('tracking-links')
      .first<SettingRow>();
    const links = saved ? JSON.parse(saved.payload) : DEFAULT_TRACKING_LINKS;
    // Clés réglées par les responsables (Paramètres), sinon secrets du serveur
    const apiKeys = await db
      .prepare('SELECT payload FROM settings WHERE id=?')
      .bind(CARRIER_API_KEY)
      .first<SettingRow>();
    const secrets = mergeSecrets(env, apiKeys ? JSON.parse(apiKeys.payload) : {});
    // Welcometrack : identifiants des transporteurs (liste gardée une semaine)
    let wtList: { id: number; name: string }[] | null = null;
    const wtContext = async (carrier: string) => {
      wtList ??= await wtCarriers(db, secrets.WELCOMETRACK_API_KEY);
      return { carrier, order: String(record.order || '').trim(), wtCarriers: wtList };
    };
    const items = await Promise.all(
      trackingLinksFor(record, links)
        .slice(0, 5)
        .map(async (t: { number: string; carrier: string; url: string }) => {
          const provider = trackingProvider(t.carrier, secrets);
          if (!provider) return { ...t, provider: '', result: { status: 'unsupported' } };
          const cacheId = 'track:' + t.number;
          const cached = await db
            .prepare('SELECT payload FROM settings WHERE id=?')
            .bind(cacheId)
            .first<SettingRow>();
          const entry = cached ? JSON.parse(cached.payload) : null;
          if (!refresh && cacheFresh(entry))
            return { ...t, provider, result: entry.result, fetchedAt: entry.fetchedAt };
          let result;
          try {
            result = await fetchTracking(
              provider,
              t.number,
              secrets,
              fetch,
              provider === 'welcometrack' ? await wtContext(t.carrier) : {},
            );
          } catch {
            result = { status: 'error', message: 'Transporteur injoignable pour le moment.' };
          }
          const fetchedAt = new Date().toISOString();
          if (result.status === 'ok' || result.status === 'not-found')
            await db
              .prepare(
                'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
              )
              .bind(cacheId, JSON.stringify({ fetchedAt, result }))
              .run();
          // En cas d'erreur, l'ancien suivi reste affiché s'il existe
          if (result.status === 'error' && entry?.result)
            return {
              ...t,
              provider,
              result: entry.result,
              fetchedAt: entry.fetchedAt,
              stale: true,
            };
          return { ...t, provider, result, fetchedAt };
        }),
    );
    return out({ items });
  } catch (e) {
    return failure(e);
  }
}
