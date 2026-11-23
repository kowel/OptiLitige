// Cellule CSV pour Excel (séparateur « ; »). Un texte qui commence par = + @ ou - est préfixé
// d'une apostrophe pour qu'Excel ne l'exécute pas comme une formule ; un nombre négatif
// (« -12,5 ») reste un nombre, sinon il deviendrait du texte exclu des sommes.
const NUMBER = /^-?\d+(?:[.,]\d+)?$/;

/** @param {unknown} v */
export function csvCell(v) {
  const s = String(v ?? '');
  return '"' + (NUMBER.test(s) ? s : s.replace(/^[=+@-]/, "'$&")).replaceAll('"', '""') + '"';
}
