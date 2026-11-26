// Formulaires de réclamation des transporteurs (Paramètres → Transporteurs → Formulaires de
// réclamation) : pour chaque transporteur, l'adresse du formulaire du service client (ou de
// l'espace professionnel), le n° de compte client Cybertek et une consigne pour l'équipe.
// Séparé des API de suivi des colis (app/tracking-providers.mjs) : ce ne sont ni les mêmes
// accès ni les mêmes services. Aucun transporteur ne propose aujourd'hui d'API publique de
// réclamation : la demande se fait sur leur formulaire, ouvert depuis l'onglet Transporteur du
// dossier (app/carrier-platform.tsx). Les mots de passe ne sont jamais enregistrés ici.

export const CLAIM_FORMS_KEY = 'claim-forms';

const key = (carrier) =>
  String(carrier || '')
    .trim()
    .toUpperCase()
    .slice(0, 80);
const clean = (v, max) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/**
 * Contrôle les réglages envoyés par un admin ; renvoie { forms } ou { error }.
 * @param {unknown} input { [transporteur]: { url, account, note } }
 */
export function normalizeClaimForms(input) {
  /** @type {Record<string, { url: string, account: string, note: string }>} */
  const forms = {};
  const entries = Object.entries(input && typeof input === 'object' ? input : {});
  if (entries.length > 60) return { error: 'Trop de transporteurs.' };
  for (const [carrier, raw] of entries) {
    const k = key(carrier);
    if (!k || !raw || typeof raw !== 'object') continue;
    const url = String(raw.url ?? '').trim();
    const account = clean(raw.account, 80);
    const note = String(raw.note ?? '')
      .trim()
      .slice(0, 500);
    if (url) {
      if (url.length > 500) return { error: 'Adresse trop longue pour ' + k + '.' };
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return { error: 'Adresse du formulaire invalide pour ' + k + '.' };
      }
      if (parsed.protocol !== 'https:')
        return { error: 'L’adresse du formulaire de ' + k + ' doit commencer par https://' };
    }
    if (url || account || note) forms[k] = { url, account, note };
  }
  return { forms };
}

/** Réglage du transporteur d'un dossier (ou null) */
export function claimFormFor(forms, carrier) {
  const f = forms?.[key(carrier)];
  return f && (f.url || f.account || f.note) ? f : null;
}

const euros = (v) => (Number(v) ? Number(v).toFixed(2).replace('.', ',') + ' €' : '');

/** Résumé du litige à coller dans le formulaire du transporteur */
export function claimSummary(r) {
  return [
    ['Référence Cybertek', r?.ref],
    ['N° de commande', r?.order],
    ['N° de suivi', r?.bt],
    ['Client', r?.customer && !/^non renseign/i.test(r.customer) ? r.customer : ''],
    ['Type de litige', r?.type],
    ['Valeur', euros(r?.disputeValue || r?.amount)],
    ['Description', String(r?.description || '').trim()],
  ]
    .filter(([, v]) => String(v ?? '').trim())
    .map(([l, v]) => l + ' : ' + v)
    .join('\n');
}
