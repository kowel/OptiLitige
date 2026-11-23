// Délais (SLA) : règles réglables par les responsables et détection des dossiers hors délai.
// Partagé par l'API (validation), l'écran (Paramètres, liste, détail) et les tests.
//
// Trois sortes de règles :
//  - status  : un dossier ne doit pas rester plus de N heures dans un statut
//              (ex. « Nouveau » 24 h = prise en charge par le service litige) ;
//  - carrier : le transporteur doit répondre dans les N heures après la transmission ;
//  - total   : un dossier doit être résolu dans les N heures après sa création.
// Les délais sont calendaires (week-ends et jours fériés compris).
import { noCarrierClaimFor } from './carrier-tracking.mjs';

export const SLA_STATUSES = ['Nouveau', 'Pris en charge', 'En attente RC', 'Réouvert'];
export const SLA_KINDS = {
  status: 'Temps passé dans un statut',
  carrier: 'Réponse du transporteur',
  total: 'Résolution complète du dossier',
};
export const MAX_SLA_RULES = 15;
const MAX_HOURS = 24 * 365;

export const DEFAULT_SLA = [
  {
    id: 'prise-en-charge',
    label: 'Prise en charge par le service litige',
    kind: 'status',
    status: 'Nouveau',
    hours: 24,
    enabled: true,
  },
  {
    id: 'reponse-transporteur',
    label: 'Réponse du transporteur',
    kind: 'carrier',
    hours: 15 * 24,
    enabled: true,
  },
];

// Vérifie et nettoie les règles envoyées par un responsable. Renvoie { rules } ou { error }.
export function normalizeSla(input) {
  if (!Array.isArray(input) || input.length > MAX_SLA_RULES)
    return { error: 'Entre 0 et ' + MAX_SLA_RULES + ' délais.' };
  const ids = new Set();
  const rules = [];
  for (const r of input) {
    const label = String(r?.label || '')
      .trim()
      .slice(0, 80);
    const hours = Number(r?.hours);
    if (!label) return { error: 'Donnez un nom à chaque délai.' };
    if (!SLA_KINDS[r?.kind]) return { error: 'Sorte de délai inconnue : ' + label + '.' };
    if (r.kind === 'status' && !SLA_STATUSES.includes(r.status))
      return { error: 'Choisissez le statut surveillé pour « ' + label + ' ».' };
    if (!Number.isFinite(hours) || hours < 1 || hours > MAX_HOURS)
      return { error: 'Le délai « ' + label + ' » doit être compris entre 1 heure et 365 jours.' };
    let id =
      String(r.id || '')
        .replace(/[^a-z0-9-]/gi, '')
        .slice(0, 40) || 'delai';
    while (ids.has(id)) id += '-2';
    ids.add(id);
    rules.push({
      id,
      label,
      kind: r.kind,
      ...(r.kind === 'status' ? { status: r.status } : {}),
      hours: Math.round(hours),
      enabled: r.enabled !== false,
    });
  }
  return { rules };
}

// Début du compte pour une règle, ou null si la règle ne s'applique pas au dossier.
function startOf(record, rule) {
  if (!record || record.status === 'Résolu') return null;
  if (rule.kind === 'status') {
    if (record.status !== rule.status) return null;
    // statusSince est enregistré à chaque changement de statut ; à défaut, la création
    return record.statusSince || record.created;
  }
  if (rule.kind === 'carrier') {
    // Rien à attendre du transporteur (interne, tiers, « ne concerne pas ») : pas de retard
    if (noCarrierClaimFor(record)) return null;
    if (!record.carrierSentAt || record.carrierReplyAt) return null;
    return record.carrierSentAt;
  }
  if (rule.kind === 'total') return record.created;
  return null;
}

// Règles dépassées pour un dossier : [{ rule, since, overdueHours }]
export function lateRules(record, rules, now = Date.now()) {
  const late = [];
  for (const rule of rules || []) {
    if (!rule.enabled) continue;
    const start = Date.parse(startOf(record, rule));
    if (!Number.isFinite(start)) continue;
    const overdue = (now - start) / 3600000 - rule.hours;
    if (overdue > 0)
      late.push({ rule, since: new Date(start).toISOString(), overdueHours: overdue });
  }
  return late;
}

export const isLate = (record, rules, now) => lateRules(record, rules, now).length > 0;

// « 2 j 5 h », « 6 h », « 45 min »
export function formatHours(hours) {
  if (hours < 1) return Math.max(1, Math.round(hours * 60)) + ' min';
  const h = Math.round(hours);
  if (h < 48) return h + ' h';
  const d = Math.floor(h / 24),
    rest = h % 24;
  return d + ' j' + (rest ? ' ' + rest + ' h' : '');
}

// Durée d'une règle pour l'écran : { value, unit } avec unit 'heures' ou 'jours'
export function splitDuration(hours) {
  // 24 h reste affiché « 24 heures » ; à partir de 2 jours pleins, en jours
  return hours >= 48 && hours % 24 === 0
    ? { value: hours / 24, unit: 'jours' }
    : { value: hours, unit: 'heures' };
}

// Règles qui seront dépassées dans les prochaines heures (pas encore en retard) :
// [{ rule, since, remainingHours }]
export function soonRules(record, rules, now = Date.now(), withinHours = 24) {
  const soon = [];
  for (const rule of rules || []) {
    if (!rule.enabled) continue;
    const start = Date.parse(startOf(record, rule));
    if (!Number.isFinite(start)) continue;
    const remaining = rule.hours - (now - start) / 3600000;
    if (remaining > 0 && remaining <= withinHours)
      soon.push({ rule, since: new Date(start).toISOString(), remainingHours: remaining });
  }
  return soon;
}
