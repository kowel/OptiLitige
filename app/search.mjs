// Recherche dans la liste des dossiers et détection des doublons de commande.

// Champs parcourus par la barre de recherche (tous présents dans la liste allégée).
export const SEARCH_FIELDS = [
  'title',
  'ref',
  'order',
  'customer',
  'customerAccount',
  'type',
  'ticket',
  'bt',
  'creditNumber',
  'invoice',
  'carrierCaseRef',
  'productRef',
  'requester',
  'brand',
  'store',
  'carrier',
];

// Minuscules, sans accents, espaces multiples réduits.
export const fold = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Chaque mot saisi doit se retrouver dans au moins un des champs (« dpd 84752 » trouve le
// dossier transporteur DPD de la commande CMD-84752).
// Texte de recherche d'un dossier, calculé une fois puis gardé tant que le dossier ne change
// pas (un dossier modifié est un nouvel objet) : la recherche reste rapide à chaque lettre tapée
const searchText = new WeakMap();
function textOf(record) {
  let text = searchText.get(record);
  if (text === undefined) {
    text = SEARCH_FIELDS.map((f) => fold(record?.[f])).join(' | ');
    searchText.set(record, text);
  }
  return text;
}
export function matchesSearch(record, query) {
  const words = fold(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const text = record && typeof record === 'object' ? textOf(record) : '';
  return words.every((w) => text.includes(w));
}

// N° de commande comparable : sans espaces ni tirets, en majuscules.
export const orderKey = (v) =>
  String(v ?? '')
    .toUpperCase()
    .replace(/[\s\-_.]/g, '');

// Dossiers existants pour la même commande (hors valeurs « Non renseigné » des imports).
export function sameOrderRecords(records, order, excludeId) {
  const key = orderKey(order);
  if (key.length < 3 || /^NONRENSEIGNE/.test(orderKey(fold(order)))) return [];
  return (records || []).filter((r) => r.id !== excludeId && orderKey(r.order) === key);
}
