// Alerte « client récidiviste » : un client qui a déjà eu plusieurs litiges récemment, ou un
// litige requalifié en fraude, est signalé à la création d'un litige et dans sa fiche.
// Seuils réglables par les responsables (settings « repeat-alerts »).
import { isFraud } from './outcomes.mjs';

export const DEFAULT_REPEAT_ALERTS = { count: 3, months: 12, fraud: true };

export function normalizeRepeatAlerts(input) {
  const count = Number(input?.count ?? DEFAULT_REPEAT_ALERTS.count);
  const months = Number(input?.months ?? DEFAULT_REPEAT_ALERTS.months);
  if (!Number.isInteger(count) || count < 0 || count > 50)
    return { error: 'Nombre de litiges invalide (0 à 50, 0 = désactivé).' };
  if (!Number.isInteger(months) || months < 1 || months > 60)
    return { error: 'Période invalide (1 à 60 mois).' };
  return { alerts: { count, months, fraud: input?.fraud !== false } };
}

// Nom de client comparable : sans accents, majuscules, ponctuation ni espaces en trop.
// Les noms vides ou « Non renseigné » (dossiers repris de SharePoint) ne sont pas comparés.
export function customerKey(name) {
  const k = String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (k.length < 3 || k.startsWith('non renseign') || k === 'inconnu') return '';
  return k.split(' ').sort().join(' '); // « Durand Paul » = « Paul Durand »
}

// Clé d'un dossier : le numéro de compte client quand il est connu (obligatoire à la création),
// sinon le nom (anciens dossiers repris de SharePoint)
export function recordCustomerKey(r) {
  const account = String(r?.customerAccount || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  return account ? 'compte:' + account : customerKey(r?.customer);
}

// Dossiers regroupés par client : Map(clé client → dossiers)
export function customerIndex(records) {
  const index = new Map();
  for (const r of records || []) {
    const k = recordCustomerKey(r);
    if (!k) continue;
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(r);
  }
  return index;
}

/**
 * Autres dossiers du même client et décision d'alerte. `records` peut être la liste des dossiers
 * ou un index déjà construit (customerIndex), plus rapide quand on vérifie à chaque frappe.
 * @param {any[] | Map<string, any[]>} records
 * @param {{ customer?: string, customerAccount?: string, id?: string, created?: string }} target
 * @param {{ count: number, months: number, fraud: boolean }} settings
 */
export function repeatInfo(records, target, settings = DEFAULT_REPEAT_ALERTS, now = Date.now()) {
  const key = recordCustomerKey(target);
  if (!key) return { matches: [], recent: 0, frauds: [], alert: false, reasons: [] };
  const same =
    records instanceof Map
      ? records.get(key) || []
      : (records || []).filter((r) => recordCustomerKey(r) === key);
  const matches = same
    .filter((r) => r.id !== target.id)
    .sort((a, b) => String(b.created).localeCompare(String(a.created)));
  const since = new Date(now);
  since.setMonth(since.getMonth() - settings.months);
  const recent = matches.filter((r) => Date.parse(r.created) >= +since).length;
  const frauds = matches.filter((r) => isFraud(r.outcome));
  const reasons = [];
  // Le dossier en cours (ou en création) compte : « 3 litiges en 12 mois » = 2 précédents + lui
  if (settings.count > 0 && recent + 1 >= settings.count)
    reasons.push(recent + 1 + ' litiges en ' + settings.months + ' mois');
  if (settings.fraud && frauds.length)
    reasons.push(
      frauds.length === 1 ? 'un litige classé fraude' : frauds.length + ' litiges classés fraude',
    );
  return { matches, recent, frauds, alert: reasons.length > 0, reasons };
}
