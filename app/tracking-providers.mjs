// Suivi détaillé des colis (côté serveur) : tout passe par Welcometrack (API v6, lecture seule,
// app/welcometrack.mjs), où Cybertek déclare toutes ses expéditions, quel que soit le
// transporteur (Colissimo, Chronopost, TNT, FedEx, GEODIS, France Express, Kuehne+Nagel…).
// Les connexions directes aux API La Poste et FedEx ont été retirées le 26/11/2026.
//  La clé se règle dans Paramètres → Transporteurs → API de suivi des colis (admins), ou comme
//  secret du serveur WELCOMETRACK_API_KEY (informatique) ; la valeur de l'outil passe en premier.
// Le résultat de chaque numéro est gardé 30 minutes (7 jours une fois le colis livré).

import { fetchWtTracking, testWelcometrack } from './welcometrack.mjs';

export const PROVIDERS = {
  welcometrack: { label: 'Welcometrack (tous les transporteurs)' },
};

// Un seul fournisseur pour tous les transporteurs
/** @param {string} [_carrier] */
export const providerFor = (_carrier) => 'welcometrack';
/** @param {string} [_carrier] @param {Record<string, string>} [_secrets] */
export const trackingProvider = (_carrier, _secrets) => 'welcometrack';

export const CACHE_MINUTES = 30;
export const FINAL_CACHE_DAYS = 7;
export const NOT_FOUND_CACHE_HOURS = 6;

// Le résultat gardé est-il encore valable ?
export function cacheFresh(entry, now = Date.now()) {
  if (!entry?.fetchedAt || !entry.result) return false;
  const age = now - Date.parse(entry.fetchedAt);
  const max = entry.result.final
    ? FINAL_CACHE_DAYS * 86400e3
    : entry.result.status === 'not-found'
      ? NOT_FOUND_CACHE_HOURS * 3600e3
      : CACHE_MINUTES * 60e3;
  return age >= 0 && age < max;
}

// Étapes affichées dans la frise
export const STEPS = [
  'Préparé par l’expéditeur',
  'Pris en charge',
  'En acheminement',
  'En livraison',
  'Livré',
];

// Forme commune d'un suivi : { status, label, final, delivered, deliveredAt, step (0-5),
// events: [{ date, label, place }] (le plus récent d'abord) }
const time = (d) => Date.parse(d) || 0;
const newest = (events) =>
  events
    .filter((e) => e.label)
    .sort((a, b) => time(b.date) - time(a.date))
    .slice(0, 60);

// Interroge Welcometrack. `fetcher` = fetch (remplaçable dans les tests) ; `ctx` = { carrier,
// order, wtCarriers } du dossier (transporteur, n° de commande, transporteurs Welcometrack).
export async function fetchTracking(provider, number, secrets, fetcher = fetch, ctx = {}) {
  if (provider !== 'welcometrack') return { status: 'unsupported' };
  return fetchWtTracking(
    { ...ctx, number, key: String(secrets?.WELCOMETRACK_API_KEY || '').trim() },
    fetcher,
  );
}

// Suivi simulé pour le mode démonstration (aucun appel extérieur)
export function demoTracking(number, created) {
  const start = Date.parse(created || '') || Date.now() - 4 * 86400e3;
  const at = (h) => new Date(start + h * 3600e3).toISOString();
  const delivered = number.length % 2 === 0;
  const events = [
    {
      date: at(2),
      label: 'Votre colis est en cours de préparation chez l’expéditeur.',
      place: 'Bordeaux',
    },
    {
      date: at(9),
      label: 'Votre colis a été pris en charge par le transporteur.',
      place: 'Bordeaux',
    },
    {
      date: at(20),
      label: 'Votre colis est en cours d’acheminement.',
      place: 'Plateforme de Chilly-Mazarin',
    },
    {
      date: at(31),
      label: 'Votre colis est en cours de livraison.',
      place: 'Agence de destination',
    },
  ];
  if (delivered)
    events.push({ date: at(36), label: 'Votre colis a été livré.', place: 'Point relais' });
  return {
    status: 'ok',
    events: newest(events),
    label: events[events.length - 1].label,
    final: delivered,
    delivered,
    deliveredAt: delivered ? at(36) : '',
    step: delivered ? 5 : 4,
    demo: true,
  };
}

// Connexion à l'API, réglée par les admins (Paramètres → Transporteurs) et rangée dans la base
// (settings « carrier-api-keys »). Une valeur de l'outil passe avant le secret du serveur du
// même nom. Les valeurs ne repartent jamais vers le navigateur : « configuré » et 4 caractères.
export const CARRIER_API_KEY = 'carrier-api-keys';
export const API_FIELDS = {
  welcometrack: [{ name: 'WELCOMETRACK_API_KEY', label: 'Clé API (en-tête xapikey)' }],
};

/** Contrôle des valeurs saisies pour un fournisseur ; renvoie { values } ou { error } */
export function normalizeApiKeys(provider, input) {
  const fields = API_FIELDS[provider];
  if (!fields) return { error: 'Connexion inconnue.' };
  const values = {};
  for (const f of fields) {
    const v = String(input?.[f.name] ?? '').trim();
    if (!v) return { error: 'Renseignez « ' + f.label + ' ».' };
    if (v.length > 300 || /\s/.test(v))
      return { error: '« ' + f.label + ' » invalide (sans espace, 300 caractères au plus).' };
    values[f.name] = v;
  }
  return { values };
}

const fieldsOf = () => Object.values(API_FIELDS).flat();

/** Secrets utilisés pour interroger l'API : valeur de l'outil, sinon secret du serveur */
export function mergeSecrets(env, stored) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const { name } of fieldsOf()) {
    const fromTool = Object.values(stored || {}).find((p) => p?.values?.[name])?.values?.[name];
    out[name] = String(fromTool || env?.[name] || '').trim();
  }
  return out;
}

/** État de la connexion pour l'écran des admins (aucune valeur secrète) */
export function apiStatus(env, stored) {
  const status = {};
  for (const [provider, fields] of Object.entries(API_FIELDS)) {
    const saved = stored?.[provider];
    const inTool = fields.every((f) => saved?.values?.[f.name]);
    const onServer = fields.every((f) => String(env?.[f.name] || '').trim());
    const first = inTool ? saved.values[fields[0].name] : '';
    status[provider] = {
      label: PROVIDERS[provider].label,
      configured: inTool || onServer,
      source: inTool ? 'outil' : onServer ? 'serveur' : '',
      hint: first ? '…' + first.slice(-4) : '',
      savedAt: inTool ? saved.savedAt || '' : '',
      savedBy: inTool ? saved.savedBy || '' : '',
    };
  }
  return status;
}

/** Test de connexion : la clé est-elle acceptée par Welcometrack ? */
export async function testConnection(provider, secrets, fetcher = fetch) {
  const fields = API_FIELDS[provider];
  if (!fields) return { ok: false, message: 'Connexion inconnue.' };
  if (!fields.every((f) => secrets?.[f.name]))
    return { ok: false, message: 'Connexion non configurée.' };
  return testWelcometrack(secrets.WELCOMETRACK_API_KEY, fetcher);
}
