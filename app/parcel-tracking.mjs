// Suivi du colis depuis un dossier : le numéro de suivi est le champ « BT » (repris de la
// colonne BT de SharePoint). Chaque transporteur a une adresse de suivi où {numero} est
// remplacé par le numéro ; les responsables peuvent la corriger dans Paramètres → Liens de suivi.

// Adresses vérifiées le 12/11/2026 avec de vrais numéros (Chronopost et TNT affichent les étapes
// en direct ; La Poste est la page officielle de suivi Colissimo). Pas d'adresse sûre trouvée
// pour GEODIS, FRANCE EXPRESS et KUEHNE NAGEL : à renseigner dans Paramètres.
/** @type {Record<string, string>} */
export const DEFAULT_TRACKING_LINKS = {
  CHRONOPOST: 'https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT={numero}',
  COLISSIMO: 'https://www.laposte.fr/outils/suivre-vos-envois?code={numero}',
  TNT: 'https://www.tnt.fr/public/suivi_colis/recherche/visubontransport.do?bonTransport={numero}',
  FEDEX: 'https://www.fedex.com/fedextrack/?trknbr={numero}',
};

const key = (carrier) =>
  String(carrier || '')
    .trim()
    .toUpperCase();

// Contrôle les adresses envoyées par un responsable ; renvoie { links } ou { error }
export function normalizeTrackingLinks(input) {
  /** @type {Record<string, string>} */
  const links = {};
  const entries = Object.entries(input || {});
  if (entries.length > 60) return { error: 'Trop de transporteurs.' };
  for (const [carrier, raw] of entries) {
    const k = key(carrier).slice(0, 80);
    const url = String(raw ?? '').trim();
    if (!k || !url) continue;
    if (url.length > 500) return { error: 'Adresse trop longue pour ' + k + '.' };
    let parsed;
    try {
      parsed = new URL(url.replace('{numero}', 'X'));
    } catch {
      return { error: 'Adresse invalide pour ' + k + '.' };
    }
    if (parsed.protocol !== 'https:')
      return { error: 'L’adresse de ' + k + ' doit commencer par https://' };
    if (!url.includes('{numero}'))
      return { error: 'L’adresse de ' + k + ' doit contenir {numero} à la place du numéro.' };
    links[k] = url;
  }
  return { links };
}

// Numéros de suivi contenus dans le champ BT. Il en contient parfois plusieurs
// (« XN… // XN… », « 6C… / 6C… », « XN… annulé mais parti par TNT 5948… »).
export function trackingNumbers(bt) {
  const found = String(bt || '').match(/[A-Z0-9]{8,30}/gi) || [];
  return [...new Set(found.filter((n) => /\d/.test(n)).map((n) => n.toUpperCase()))];
}

// Transporteur probable d'un numéro d'après sa forme (sinon celui du dossier)
export function guessCarrier(number, fallback = '') {
  if (/^X[A-Z]\d{9}[A-Z]{2}$/.test(number)) return 'CHRONOPOST';
  if (/^\d[A-Z]\d{11}$/.test(number)) return 'COLISSIMO';
  if (/^\d{16}$/.test(number) && key(fallback) !== 'FEDEX') return 'TNT';
  return key(fallback);
}

// Liens de suivi d'un dossier : [{ number, carrier, url }] (url vide si pas d'adresse connue)
/** @param {any} record @param {Record<string, string>} links */
export function trackingLinksFor(record, links = DEFAULT_TRACKING_LINKS) {
  return trackingNumbers(record?.bt).map((number) => {
    const carrier = guessCarrier(number, record?.carrier);
    const template = links[carrier];
    return {
      number,
      carrier,
      url: template ? template.replace('{numero}', encodeURIComponent(number)) : '',
    };
  });
}
