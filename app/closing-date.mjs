// Date de clôture saisie à la main (Service Litige, Responsables, admins) : dossiers repris de
// SharePoint sans date de résolution, ou clôture faite dans l'outil après coup. Sans elle, le
// délai d'un ancien dossier résolu se comptait jusqu'à aujourd'hui (ex. 464,6 jours).
import { parisDay } from './period.mjs';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Jour de clôture (AAAA-MM-JJ, heure de Paris) d'un dossier, ou '' */
export const closedDay = (r) => (r?.closed ? parisDay(r.closed) : '');

/** Date ISO enregistrée pour un jour choisi : midi, heure de Paris en hiver (11 h UTC) */
export const closedFromDay = (day) => day + 'T11:00:00.000Z';

/**
 * Motif de refus du jour choisi, ou null : format, pas avant l'ouverture, pas dans le futur.
 * @param {string} day AAAA-MM-JJ
 * @param {string} created date d'ouverture (ISO)
 * @param {string} now date ISO actuelle
 */
export function closedDayError(day, created, now) {
  if (!ISO_DAY.test(String(day || '')) || !Number.isFinite(Date.parse(day)))
    return 'Date de clôture invalide.';
  if (created && parisDay(created) && day < parisDay(created))
    return 'La date de clôture ne peut pas précéder l’ouverture du dossier.';
  if (day > parisDay(now)) return 'La date de clôture ne peut pas être dans le futur.';
  return null;
}
