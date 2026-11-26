// Welcometrack (API v6, https://api.welcometrack.io/v6.0) : plateforme de suivi où Cybertek
// déclare toutes ses expéditions, quel que soit le transporteur. OptiLitige ne fait QUE LIRE
// (requêtes GET) ; aucune requête d'écriture (commandes, colis, étiquettes…) n'est utilisée.
//   - Suivi d'un colis : GET /deliveries/get (n° de suivi + transporteur Welcometrack), ou
//     GET /orders/get (n° de commande) quand le transporteur n'est pas reconnu.
//   - Liste des transporteurs : GET /carriers/get (pour trouver l'identifiant Welcometrack).
//   - Nombre d'expéditions : GET /alerts/get, résultat d'une « alerte interne » créée dans
//     Welcometrack (colonnes : transporteur et date d'expédition), compté par mois.
// Authentification : en-tête « xapikey » (clé réglée par un admin dans Paramètres).

export const WT_BASE = 'https://api.welcometrack.io/v6.0';
export const WT_CARRIERS_KEY = 'welcometrack-carriers';
export const WT_SHIPMENTS_KEY = 'welcometrack-shipments';
export const WT_CARRIERS_DAYS = 7;

const text = (v, max = 200) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
// Nom comparable : majuscules, sans accents ni ponctuation (« Kuehne + Nagel » = « KUEHNENAGEL »)
const compact = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

/** Lecture seule : GET uniquement, clé dans l'en-tête xapikey */
export async function wtGet(path, params, key, fetcher = fetch) {
  const url = new URL(WT_BASE + path);
  for (const [k, v] of Object.entries(params || {}))
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const res = await fetcher(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json', xapikey: key },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

/** « 16/05/2023 » + « 17:34:00 » → « 2023-05-16T17:34:00 » (heure locale de l'événement) */
export function wtDate(date, hour = '') {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(date || '').trim());
  if (!m) return '';
  const h = /^\d{2}:\d{2}(:\d{2})?$/.test(String(hour || '').trim()) ? hour.trim() : '00:00:00';
  return m[3] + '-' + m[2] + '-' + m[1] + 'T' + (h.length === 5 ? h + ':00' : h);
}

// Étape de la frise (0 à 5, voir STEPS de tracking-providers.mjs) d'après le dernier message
function stepOf(label, delivered, hasEvents) {
  if (delivered) return 5;
  const l = compact(label);
  if (/ENCOURSDELIVRAISON|MISEENDISTRIBUTION|ENLIVRAISON|POINTDERETRAIT|DISPONIBLE/.test(l))
    return 4;
  if (/ACHEMINEMENT|TRI|TRANSIT|AGENCE|HUB|PLATEFORME/.test(l)) return 3;
  if (/PRISENCHARGE|PRISEENCHARGE|EXPEDIE|DEPOSE/.test(l)) return 2;
  return hasEvents ? 1 : 0;
}

/** Réponse de /deliveries/get (ou une expédition de /orders/get) → forme commune du suivi */
export function parseWelcometrack(json) {
  if (!json || typeof json !== 'object')
    return { status: 'error', message: 'Réponse inattendue de Welcometrack.' };
  const code = Number(json.errorcode ?? json.ErrorCode ?? 0);
  if (code === 8 || (code && !json.traces && !json.provider_name))
    return {
      status: 'not-found',
      message: text(json.ErrorMsg || json.errormsg) || 'Colis inconnu de Welcometrack.',
    };
  const traces = Array.isArray(json.traces) ? json.traces : json.tracking || [];
  const events = traces
    .map((t) => ({
      date: wtDate(t.date, t.hour),
      label: text(t.message),
      place: text(t.location, 120),
    }))
    .filter((e) => e.label)
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
    .slice(0, 60);
  const delivered = !!json.delivery_delivered;
  const deliveredAt = delivered ? wtDate(json.delivery_date, json.delivery_hour) : '';
  const issue = json.delivery_damaged
    ? 'Avarie signalée'
    : json.delivery_carrierreturn
      ? 'Retour déclenché par le transporteur'
      : json.delivery_customerreturn
        ? 'Refusé par le client'
        : json.delivery_addressproblem
          ? 'Problème d’adresse'
          : json.delivery_pending
            ? 'En instance (point de retrait)'
            : '';
  return {
    status: 'ok',
    events,
    label: events[0]?.label || (delivered ? 'Colis livré' : ''),
    final: delivered || !!json.delivery_carrierreturn || !!json.delivery_customerreturn,
    delivered,
    deliveredAt: deliveredAt || (delivered ? events[0]?.date || '' : ''),
    step: stepOf(events[0]?.label, delivered, events.length > 0),
    carrierName: text(json.provider_name, 80),
    shippedAt: wtDate(json.delivery_shipmentdate, json.delivery_shipmenthour),
    issue,
    via: 'welcometrack',
  };
}

/** Liste /carriers/get (toutes les pages) → [{ id, name }] */
export async function fetchWtCarriers(key, fetcher = fetch) {
  const list = [];
  for (let page = 1; page <= 20; page++) {
    const { status, json } = await wtGet('/carriers/get', { page }, key, fetcher);
    if (status !== 200) break;
    for (const c of json.carriers || [])
      if (c?.id && c?.name) list.push({ id: Number(c.id), name: text(c.name, 80) });
    if (!json.nbpage || page >= Number(json.nbpage)) break;
  }
  return list;
}

/** Identifiant Welcometrack du transporteur d'un dossier (« TNT FRANCE » → « TNT »), ou 0 */
export function wtCarrierId(wtCarriers, carrier) {
  const ours = compact(carrier);
  if (!ours) return 0;
  const list = (wtCarriers || []).map((c) => ({ ...c, key: compact(c.name) })).filter((c) => c.key);
  const exact = list.find((c) => c.key === ours);
  if (exact) return exact.id;
  // Le plus long nom contenu dans l'autre (« CHRONOPOST » avant « CHRONO »)
  const close = list
    .filter((c) => ours.includes(c.key) || c.key.includes(ours))
    .sort((a, b) => b.key.length - a.key.length)[0];
  return close?.id || 0;
}

/**
 * Suivi d'un colis : par n° de suivi et transporteur ; sinon par n° de commande (colis dont le
 * lien de suivi contient le numéro, ou le seul colis de la commande).
 */
export async function fetchWtTracking(
  { number, carrier, order, key, wtCarriers },
  fetcher = fetch,
) {
  if (!key) return { status: 'not-configured' };
  const carrierid = wtCarrierId(wtCarriers, carrier);
  if (carrierid) {
    const { status, json } = await wtGet(
      '/deliveries/get',
      { delivery_reference: number, carrierid, language: 'FR', timeline: 'M', traces: 1 },
      key,
      fetcher,
    );
    if (status === 401 || status === 403)
      return {
        status: 'error',
        message: 'Clé Welcometrack refusée : vérifiez-la dans Paramètres.',
      };
    if (status === 200) return parseWelcometrack(json);
    if (!order) return parseWelcometrack({ errorcode: 8, ...json });
  }
  if (!order)
    return {
      status: 'not-found',
      message: 'Transporteur inconnu de Welcometrack et pas de n° de commande dans le dossier.',
    };
  const { status, json } = await wtGet(
    '/orders/get',
    { order_reference: order, language: 'FR', timeline: 'M', traces: 1 },
    key,
    fetcher,
  );
  if (status === 401 || status === 403)
    return { status: 'error', message: 'Clé Welcometrack refusée : vérifiez-la dans Paramètres.' };
  if (status !== 200) return parseWelcometrack({ errorcode: 8, ...json });
  const packages = (json.packages || []).filter((p) => p?.deliveries);
  const wanted = compact(number);
  const pick =
    packages.find((p) => wanted && compact(p.deliveries.delivery_trackingurl).includes(wanted)) ||
    packages.find((p) => wanted && compact(p.package_reference).includes(wanted)) ||
    (packages.length === 1 ? packages[0] : null);
  if (!pick)
    return {
      status: 'not-found',
      message: 'Commande trouvée dans Welcometrack, mais pas ce colis (' + number + ').',
    };
  return parseWelcometrack({ ...pick.deliveries, traces: pick.tracking || pick.deliveries.traces });
}

/** Test de la clé : la liste des transporteurs répond-elle ? */
export async function testWelcometrack(key, fetcher = fetch) {
  try {
    const { status } = await wtGet('/carriers/get', { page: 1 }, key, fetcher);
    if (status === 401 || status === 403)
      return { ok: false, message: 'Clé refusée par Welcometrack.' };
    if (status >= 500 || status === 0)
      return { ok: false, message: 'Welcometrack ne répond pas pour le moment.' };
    return {
      ok: status === 200,
      message:
        status === 200
          ? 'Connexion à Welcometrack réussie.'
          : 'Réponse inattendue de Welcometrack (' + status + ').',
    };
  } catch {
    return { ok: false, message: 'Welcometrack injoignable pour le moment.' };
  }
}

// Colonnes de l'export d'alerte : leur nom dépend du paramétrage dans Welcometrack
const CARRIER_COLUMN = /PROVIDER|CARRIER|TRANSPORT/;
const DATE_COLUMN = /SHIPMENTDATE|SHIPPINGDATE|EXPEDITION|DATEEXP/;
function columns(row) {
  const keys = Object.keys(row || {});
  const carrierCol =
    keys.find((k) => /^PROVIDERNAME$|^CARRIERNAME$|^TRANSPORTEUR$/.test(compact(k))) ||
    keys.find(
      (k) =>
        CARRIER_COLUMN.test(compact(k)) &&
        typeof row[k] === 'string' &&
        !/ID$|URL/.test(compact(k)),
    );
  const dateCol =
    keys.find((k) => DATE_COLUMN.test(compact(k)) && wtDate(row[k])) ||
    keys.find((k) => /DATE/.test(compact(k)) && wtDate(row[k]));
  return { carrierCol, dateCol };
}

/**
 * Lignes de l'alerte → { months: { '2026-11': { CHRONOPOST: 1234 } }, skipped }.
 * Le nom Welcometrack est ramené au nom du transporteur dans OptiLitige quand il y ressemble.
 */
export function countShipments(rows, ourCarriers = []) {
  /** @type {Record<string, Record<string, number>>} */
  const months = {};
  let skipped = 0;
  const ours = ourCarriers.map((c) => ({ name: String(c).trim().toUpperCase(), key: compact(c) }));
  const nameOf = (wt) => {
    const k = compact(wt);
    const hit =
      ours.find((o) => o.key === k) ||
      ours
        .filter((o) => o.key && k && (o.key.includes(k) || k.includes(o.key)))
        .sort((a, b) => b.key.length - a.key.length)[0];
    return hit?.name || text(wt, 80).toUpperCase();
  };
  let cols = null;
  for (const row of rows || []) {
    cols = cols?.carrierCol && cols?.dateCol ? cols : columns(row);
    const carrier = cols.carrierCol ? text(row[cols.carrierCol], 80) : '';
    const date = cols.dateCol ? wtDate(row[cols.dateCol]) : '';
    if (!carrier || !date) {
      skipped++;
      continue;
    }
    const month = date.slice(0, 7);
    const name = nameOf(carrier);
    months[month] ||= {};
    months[month][name] = (months[month][name] || 0) + 1;
  }
  return { months, skipped };
}

/** Toutes les pages de l'alerte (500 pages au plus) → lignes */
export async function fetchAlertRows(alertId, key, fetcher = fetch, maxPages = 500) {
  const rows = [];
  for (let page = 1; page <= maxPages; page++) {
    const { status, json } = await wtGet('/alerts/get', { alertid: alertId, page }, key, fetcher);
    if (status === 401 || status === 403) return { error: 'Clé refusée par Welcometrack.' };
    if (status === 404) break;
    if (status !== 200)
      return { error: 'Welcometrack a répondu ' + status + ' (alerte ' + alertId + ').' };
    rows.push(...(json.deliveries || []));
    if (!json.nbpage || page >= Number(json.nbpage)) break;
  }
  return { rows };
}

/** Réglage de l'alerte : n° entier positif */
export function normalizeAlertId(v) {
  const s = String(v ?? '').trim();
  if (!s) return { alertId: '' };
  if (!/^\d{1,12}$/.test(s)) return { error: 'Le n° de l’alerte Welcometrack est un nombre.' };
  return { alertId: s };
}
