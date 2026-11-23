// Modification des informations d'un dossier par un responsable (montant, n° de commande,
// client, enseigne…), par exemple pour corriger les erreurs reprises de SharePoint.
// Partagé par l'API (action « edit-info ») et la démonstration. Chaque changement est noté dans
// l'historique du dossier (« Montant commande : 243 497,00 € → 2 434,97 € »).

export const STORE_BRAND = 'MAGASIN';

// [clé, libellé, nature, longueur maximale, obligatoire]
/** @type {[string, string, string, number, boolean][]} */
export const EDITABLE_FIELDS = [
  ['title', 'Objet du litige', 'text', 200, true],
  ['order', 'Référence commande', 'text', 100, true],
  ['disputeValue', 'Montant concerné par le litige', 'amount', 0, true],
  // Compte client : obligatoire à la création, facultatif ici (anciens dossiers repris sans)
  ['customerAccount', 'Numéro de compte client', 'text', 60, false],
  ['customer', 'Nom du client', 'text', 150, false],
  ['brand', 'Enseigne', 'text', 120, true],
  ['store', 'Magasin', 'text', 120, false],
  ['productType', 'Type de produit', 'text', 120, true],
  ['productRef', 'Référence produit', 'text', 200, false],
  ['ticket', 'Numéro de ticket', 'text', 200, false],
  ['bt', 'BT', 'text', 200, false],
  ['requester', 'Demandeur', 'text', 200, false],
  ['origin', 'Origine', 'origin', 0, true],
  ['carrier', 'Transporteur', 'text', 100, false],
  ['type', 'Type à l’ouverture', 'text', 100, true],
  ['priority', 'Priorité', 'priority', 0, true],
  ['description', 'Description', 'text', 10000, true],
];

const euros = (v) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(v) || 0);
const shown = (kind, v) =>
  kind === 'amount' ? euros(v) : String(v ?? '').trim() === '' ? '(vide)' : String(v);

/**
 * Applique les informations saisies sur une copie du dossier.
 * @param {object} record dossier actuel
 * @param {object} input valeurs saisies (seuls les champs de EDITABLE_FIELDS sont lus)
 * @returns {{ error?: string, values?: object, changes?: { key: string, label: string, before: string, after: string }[] }}
 */
export function applyInfoEdit(record, input) {
  const values = {};
  for (const [key, label, kind, max, required] of EDITABLE_FIELDS) {
    if (!(key in (input || {}))) continue;
    let v = input[key];
    if (kind === 'amount') {
      const n = Number(String(v ?? '').replace(',', '.'));
      if (String(v ?? '').trim() === '' || !Number.isFinite(n) || n < 0 || n > 10_000_000)
        return { error: label + ' invalide.' };
      v = Math.round(n * 100) / 100;
    } else if (kind === 'origin') {
      if (!['Transport', 'Interne'].includes(v)) return { error: 'Origine invalide.' };
    } else if (kind === 'priority') {
      if (!['Normale', 'Haute'].includes(v)) return { error: 'Priorité invalide.' };
    } else {
      v = String(v ?? '').trim();
      if (v.length > max) return { error: label + ' : ' + max + ' caractères au maximum.' };
      if (required && !v) return { error: label + ' est obligatoire.' };
    }
    values[key] = v;
  }
  const brand = values.brand ?? record.brand;
  if (brand === STORE_BRAND && !String(values.store ?? record.store ?? '').trim())
    return { error: 'Choisissez le magasin concerné.' };
  if (brand !== STORE_BRAND && 'brand' in values) values.store = '';
  const changes = [];
  for (const [key, label, kind] of EDITABLE_FIELDS) {
    if (!(key in values)) continue;
    const before = record[key] ?? '';
    if (kind === 'amount' ? Number(before) === values[key] : String(before) === String(values[key]))
      continue;
    changes.push({
      key,
      label,
      // Description : trop longue pour l'historique, seul le fait qu'elle a changé est noté
      before: key === 'description' ? '…' : shown(kind, before),
      after: key === 'description' ? 'modifiée' : shown(kind, values[key]),
    });
  }
  return { values, changes };
}

// Texte de l'historique : « Informations modifiées : Montant commande : 243 497,00 € → 2 434,97 € ; … »
export const changesText = (changes) =>
  'Informations modifiées : ' +
  changes.map((c) => c.label + ' : ' + c.before + ' → ' + c.after).join(' ; ');
