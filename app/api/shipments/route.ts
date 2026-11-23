import { env } from '../../server/env';
import { out } from '../context';
import { normalizeShipments } from '../../carrier-tracking.mjs';
import { saveShipments } from '../shipments-store';
export const dynamic = 'force-dynamic';

// Connexion avec l'outil d'expédition (ERP, logiciel transport…) : il envoie chaque jour ou
// chaque mois le nombre d'expéditions par transporteur, pour le ratio litiges / expéditions.
//
//   POST /api/shipments
//   Authorization: Bearer <SHIPMENTS_TOKEN>
//   { "source": "ERP", "entries": [ { "month": "2026-11", "carrier": "COLISSIMO", "count": 1234 } ] }
//
// Un mois envoyé remplace les valeurs précédentes de ce mois, transporteur par transporteur.
// Sans le secret SHIPMENTS_TOKEN (variable d’environnement Vercel), la connexion est
// fermée. Voir A-FINALISER-AVEC-IT.md.

// Comparaison en temps constant du jeton reçu
function sameToken(a: string, b: string) {
  const x = new TextEncoder().encode(a),
    y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function POST(req: Request) {
  const expected = String(env.SHIPMENTS_TOKEN || '').trim();
  if (expected.length < 24) return out({ error: 'Connexion des expéditions non activée.' }, 503);
  const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!sameToken(given, expected)) return out({ error: 'Jeton invalide.' }, 401);
  const db = env.DB;
  if (!db) return out({ error: 'Base de données indisponible.' }, 503);
  let body: { source?: unknown; entries?: unknown };
  try {
    body = await req.json();
  } catch {
    return out({ error: 'Corps JSON invalide.' }, 400);
  }
  const { months, error } = normalizeShipments(body.entries);
  if (error) return out({ error }, 400);
  const source = String(body.source || 'Outil d’expédition').slice(0, 80);
  const saved = await saveShipments(db, months!, { source });
  return out({ ok: true, months: Object.keys(months!).length, updatedAt: saved.info.at });
}
