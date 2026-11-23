import { mergeShipments } from '../carrier-tracking.mjs';
import type { SettingRow } from '../types';

// Expéditions par mois et par transporteur, conservées dans settings (id « shipments ») :
// { months: { '2026-11': { COLISSIMO: 1234 } }, info: { source, at, by } }.
// Écrites par l'outil d'expédition (POST /api/shipments) ou par un responsable.
export async function saveShipments(
  db: D1Database,
  months: Record<string, Record<string, number>>,
  info: { source: string; by?: string },
) {
  const row = await db
    .prepare('SELECT payload FROM settings WHERE id=?')
    .bind('shipments')
    .first<SettingRow>();
  const previous = row ? JSON.parse(row.payload) : {};
  const payload = {
    months: mergeShipments(previous.months, months),
    info: { ...info, at: new Date().toISOString() },
  };
  await db
    .prepare(
      'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT (id) DO UPDATE SET payload=excluded.payload',
    )
    .bind('shipments', JSON.stringify(payload))
    .run();
  return payload;
}
