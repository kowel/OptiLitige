import {
  WT_CARRIERS_DAYS,
  WT_CARRIERS_KEY,
  WT_SHIPMENTS_KEY,
  countShipments,
  fetchAlertRows,
  fetchWtCarriers,
} from '../welcometrack.mjs';
import { saveShipments } from './shipments-store';
import type { SettingRow } from '../types';

type WtCarrier = { id: number; name: string };
export type WtSync = {
  alertId: string;
  at?: string;
  by?: string;
  ok?: boolean;
  message?: string;
  rows?: number;
};

const saveSetting = (db: D1Database, id: string, payload: unknown) =>
  db
    .prepare(
      'INSERT INTO settings(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
    )
    .bind(id, JSON.stringify(payload))
    .run();

// Transporteurs Welcometrack (identifiants), relus au plus une fois par semaine
export async function wtCarriers(db: D1Database, key: string): Promise<WtCarrier[]> {
  const row = await db
    .prepare('SELECT payload FROM settings WHERE id=?')
    .bind(WT_CARRIERS_KEY)
    .first<SettingRow>();
  const saved = row ? JSON.parse(row.payload) : null;
  if (saved?.list?.length && Date.now() - Date.parse(saved.at) < WT_CARRIERS_DAYS * 86400e3)
    return saved.list;
  try {
    const list = await fetchWtCarriers(key);
    if (list.length) await saveSetting(db, WT_CARRIERS_KEY, { at: new Date().toISOString(), list });
    return list.length ? list : saved?.list || [];
  } catch {
    return saved?.list || [];
  }
}

export async function wtSyncState(db: D1Database): Promise<WtSync> {
  const row = await db
    .prepare('SELECT payload FROM settings WHERE id=?')
    .bind(WT_SHIPMENTS_KEY)
    .first<SettingRow>();
  return row ? JSON.parse(row.payload) : { alertId: '' };
}

// Expéditions lues sur l'alerte interne Welcometrack (GET /alerts/get), comptées par mois et
// par transporteur, puis rangées comme les autres sources (settings « shipments »)
export async function syncWtShipments(
  db: D1Database,
  key: string,
  ourCarriers: string[],
  by: string,
): Promise<WtSync> {
  const state = await wtSyncState(db);
  const at = new Date().toISOString();
  if (!state.alertId)
    return { ...state, ok: false, message: 'Renseignez d’abord le n° de l’alerte Welcometrack.' };
  if (!key)
    return { ...state, ok: false, message: 'Connexion Welcometrack non réglée (Paramètres).' };
  let next: WtSync;
  try {
    const { rows, error } = await fetchAlertRows(state.alertId, key);
    if (error) next = { ...state, at, by, ok: false, message: error };
    else {
      const { months, skipped } = countShipments(rows, ourCarriers);
      const total = Object.values(months).reduce(
        (n, c) => n + Object.values(c as Record<string, number>).reduce((a, b) => a + b, 0),
        0,
      );
      if (total) await saveShipments(db, months, { source: 'Welcometrack', by });
      next = {
        ...state,
        at,
        by,
        ok: !!total,
        rows: rows!.length,
        message: total
          ? total +
            ' expédition(s) comptée(s) sur ' +
            Object.keys(months).length +
            ' mois' +
            (skipped ? ' (' + skipped + ' ligne(s) sans transporteur ou date ignorée(s))' : '')
          : rows!.length
            ? 'Alerte lue, mais ses colonnes ne donnent ni transporteur ni date d’expédition : ajoutez-les à l’export de l’alerte dans Welcometrack.'
            : 'L’alerte Welcometrack ne renvoie aucune expédition.',
      };
    }
  } catch {
    next = { ...state, at, by, ok: false, message: 'Welcometrack injoignable pour le moment.' };
  }
  await saveSetting(db, WT_SHIPMENTS_KEY, next);
  return next;
}
