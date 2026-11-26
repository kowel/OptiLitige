// Suivi détaillé des colis (côté serveur).
//  1. Welcometrack (API v6, lecture seule, app/welcometrack.mjs) : TOUS les transporteurs
//     déclarés par Cybertek → clé WELCOMETRACK_API_KEY. Toujours interrogé en premier.
//  2. En secours, quand Welcometrack ne trouve pas le colis :
//     - La Poste « Suivi v2 » (Okapi) pour Colissimo et Chronopost → LAPOSTE_OKAPI_KEY
//       (clé gratuite sur developer.laposte.fr) ;
//     - FedEx « Track API » pour FedEx et TNT (TNT appartient à FedEx) → FEDEX_CLIENT_ID et
//       FEDEX_CLIENT_SECRET (compte développeur FedEx).
//  Les clés se règlent dans Paramètres → Transporteurs → API de suivi des colis (admins), ou comme
//  secrets du serveur (informatique) ; la valeur de l'outil passe en premier.
// Rien trouvé nulle part : la fiche renvoie vers la page de suivi du transporteur (la lecture
// automatique des sites des transporteurs est écartée : anti-robots, conditions d'utilisation).
// Le résultat de chaque numéro est gardé 30 minutes (7 jours une fois le colis livré).

import { fetchWtTracking, testWelcometrack } from './welcometrack.mjs';

export const PROVIDERS = {
  welcometrack: { label: 'Welcometrack (tous les transporteurs)', carriers: [] },
  laposte: {
    label: 'La Poste, en secours (Colissimo, Chronopost)',
    carriers: ['COLISSIMO', 'CHRONOPOST'],
  },
  fedex: { label: 'FedEx, en secours (FedEx, TNT)', carriers: ['FEDEX', 'TNT', 'TNT FRANCE'] },
};

// Welcometrack pour tous les transporteurs
/** @param {string} [_carrier] */
export const providerFor = (_carrier) => 'welcometrack';
/** @param {string} [_carrier] @param {Record<string, string>} [_secrets] */
export const trackingProvider = (_carrier, _secrets) => 'welcometrack';

const ready = (provider, secrets) =>
  (API_FIELDS[provider] || []).every((f) => String(secrets?.[f.name] || '').trim());

/** API de secours du transporteur (clé réglée), ou '' */
export function fallbackProvider(carrier, secrets) {
  const c = String(carrier || '')
    .trim()
    .toUpperCase();
  const p = ['laposte', 'fedex'].find((k) => PROVIDERS[k].carriers.includes(c));
  return p && ready(p, secrets) ? p : '';
}

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

const text = (v, max = 200) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

// Étapes affichées dans la frise (les mêmes pour tous les transporteurs)
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
function finish(events, extra) {
  return { status: 'ok', events, ...extra };
}

// Réponse de GET https://api.laposte.fr/suivi/v2/idships/{numero}?lang=fr_FR
export function parseLaPoste(json) {
  const code = Number(json?.returnCode);
  if (code === 404 || (!json?.shipment && code >= 400))
    return {
      status: 'not-found',
      message: text(json?.returnMessage) || 'Numéro inconnu de La Poste.',
    };
  const s = json?.shipment;
  if (!s) return { status: 'error', message: 'Réponse inattendue de La Poste.' };
  const events = newest(
    (s.event || []).map((e) => ({
      date: text(e.date, 40),
      label: text(e.label),
      place: '',
      code: text(e.code, 10),
    })),
  );
  // timeline : 5 étapes La Poste (id 1 à 5), status = étape atteinte
  const reached = (s.timeline || []).filter((t) => t.status).map((t) => Number(t.id) || 0);
  const step = Math.min(5, Math.max(0, ...reached, 0));
  const delivered = !!s.isFinal && step >= 5;
  return finish(events, {
    label:
      text(events[0]?.label) || text(s.timeline?.find((t) => Number(t.id) === step)?.shortLabel),
    final: !!s.isFinal,
    delivered,
    deliveredAt: delivered ? text(s.deliveryDate, 40) || events[0]?.date || '' : '',
    step,
    product: text(s.product, 40),
    via: 'laposte',
  });
}

// Réponse de POST https://apis.fedex.com/track/v1/trackingnumbers
const FEDEX_STEP = { PU: 2, OC: 1, IT: 3, AR: 3, DP: 3, OD: 4, DL: 5 };
export function parseFedex(json) {
  const r = json?.output?.completeTrackResults?.[0]?.trackResults?.[0];
  if (!r) return { status: 'error', message: 'Réponse inattendue de FedEx.' };
  if (r.error?.code)
    return {
      status: /NOTFOUND/i.test(r.error.code) ? 'not-found' : 'error',
      message: text(r.error.message) || 'Numéro inconnu de FedEx.',
    };
  const events = newest(
    (r.scanEvents || []).map((e) => ({
      date: text(e.date, 40),
      label: text(e.eventDescription),
      place: [e.scanLocation?.city, e.scanLocation?.countryCode].filter(Boolean).join(', '),
    })),
  );
  const code = r.latestStatusDetail?.code || '';
  const delivered = code === 'DL';
  return finish(events, {
    label: text(r.latestStatusDetail?.description) || events[0]?.label || '',
    final: delivered,
    delivered,
    deliveredAt: delivered ? events[0]?.date || '' : '',
    step: FEDEX_STEP[code] ?? (events.length ? 2 : 0),
    via: 'fedex',
  });
}

async function fedexToken(secrets, fetcher) {
  const res = await fetcher('https://apis.fedex.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: secrets.FEDEX_CLIENT_ID,
      client_secret: secrets.FEDEX_CLIENT_SECRET,
    }).toString(),
  });
  return (await res.json().catch(() => ({})))?.access_token || '';
}

// Interroge l'API choisie. `fetcher` = fetch (remplaçable dans les tests) ; `ctx`
// (Welcometrack) = { carrier, order, wtCarriers } du dossier.
export async function fetchTracking(provider, number, secrets, fetcher = fetch, ctx = {}) {
  if (provider === 'welcometrack')
    return fetchWtTracking(
      { ...ctx, number, key: String(secrets?.WELCOMETRACK_API_KEY || '').trim() },
      fetcher,
    );
  if (provider === 'laposte') {
    const key = String(secrets?.LAPOSTE_OKAPI_KEY || '').trim();
    if (!key) return { status: 'not-configured' };
    const res = await fetcher(
      'https://api.laposte.fr/suivi/v2/idships/' + encodeURIComponent(number) + '?lang=fr_FR',
      { headers: { Accept: 'application/json', 'X-Okapi-Key': key } },
    );
    if (res.status === 401 || res.status === 403)
      return { status: 'error', message: 'Clé La Poste refusée : vérifiez-la dans Paramètres.' };
    return parseLaPoste(await res.json().catch(() => ({ returnCode: res.status })));
  }
  if (provider === 'fedex') {
    if (!ready('fedex', secrets)) return { status: 'not-configured' };
    const token = await fedexToken(secrets, fetcher);
    if (!token) return { status: 'error', message: 'Identifiants FedEx refusés.' };
    const res = await fetcher('https://apis.fedex.com/track/v1/trackingnumbers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        includeDetailedScans: true,
        trackingInfo: [{ trackingNumberInfo: { trackingNumber: number } }],
      }),
    });
    return parseFedex(await res.json().catch(() => ({})));
  }
  return { status: 'unsupported' };
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
  return finish(newest(events), {
    label: events[events.length - 1].label,
    final: delivered,
    delivered,
    deliveredAt: delivered ? at(36) : '',
    step: delivered ? 5 : 4,
    demo: true,
  });
}

// Connexions aux API, réglées par les admins (Paramètres → Transporteurs) et rangées dans la base
// (settings « carrier-api-keys »). Une valeur de l'outil passe avant le secret du serveur du même
// nom. Les valeurs ne repartent jamais vers le navigateur : seulement « configuré » et 4 caractères.
export const CARRIER_API_KEY = 'carrier-api-keys';
export const API_FIELDS = {
  welcometrack: [{ name: 'WELCOMETRACK_API_KEY', label: 'Clé API (en-tête xapikey)' }],
  laposte: [{ name: 'LAPOSTE_OKAPI_KEY', label: 'Clé Okapi (X-Okapi-Key)' }],
  fedex: [
    { name: 'FEDEX_CLIENT_ID', label: 'Client ID (API Key)' },
    { name: 'FEDEX_CLIENT_SECRET', label: 'Client secret (Secret Key)' },
  ],
};

/** Contrôle des valeurs saisies pour une connexion ; renvoie { values } ou { error } */
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

/** Secrets utilisés pour interroger les API : valeur de l'outil, sinon secret du serveur */
export function mergeSecrets(env, stored) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const { name } of fieldsOf()) {
    const fromTool = Object.values(stored || {}).find((p) => p?.values?.[name])?.values?.[name];
    out[name] = String(fromTool || env?.[name] || '').trim();
  }
  return out;
}

/** État des connexions pour l'écran des admins (aucune valeur secrète) */
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

/** Test de connexion : la clé est-elle acceptée ? */
export async function testConnection(provider, secrets, fetcher = fetch) {
  const fields = API_FIELDS[provider];
  if (!fields) return { ok: false, message: 'Connexion inconnue.' };
  if (!fields.every((f) => secrets?.[f.name]))
    return { ok: false, message: 'Connexion non configurée.' };
  if (provider === 'welcometrack') return testWelcometrack(secrets.WELCOMETRACK_API_KEY, fetcher);
  try {
    if (provider === 'laposte') {
      // Numéro fictif : une clé valide répond « numéro inconnu », une clé refusée 401 / 403
      const res = await fetcher(
        'https://api.laposte.fr/suivi/v2/idships/6A00000000000?lang=fr_FR',
        { headers: { Accept: 'application/json', 'X-Okapi-Key': secrets.LAPOSTE_OKAPI_KEY } },
      );
      if (res.status === 401 || res.status === 403)
        return { ok: false, message: 'Clé refusée par La Poste.' };
      if (res.status >= 500)
        return { ok: false, message: 'La Poste ne répond pas pour le moment.' };
      return { ok: true, message: 'Connexion à La Poste réussie.' };
    }
    return (await fedexToken(secrets, fetcher))
      ? { ok: true, message: 'Connexion à FedEx réussie.' }
      : { ok: false, message: 'Identifiants refusés par FedEx.' };
  } catch {
    return { ok: false, message: 'Transporteur injoignable pour le moment.' };
  }
}
