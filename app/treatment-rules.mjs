// Règles qui simplifient la saisie du traitement : ce que l'outil déduit ou remplit seul.
// Partagé par l'écran (formulaire, fenêtre « Clôturer ») et l'API (conclusion déduite).
//  - Conclusion de la clôture : déduite du résultat du litige (plus de saisie séparée).
//  - Imputation proposée selon le résultat (modifiable).
//  - Champs transporteur : « Ne concerne pas le transporteur » quand rien n'est à réclamer,
//    état « Réponse reçue » et date du jour quand une décision arrive.
import { NOT_CARRIER } from './carrier-tracking.mjs';

// Résultats qui veulent dire « litige non avéré »
const NOT_PROVEN = ['Livraison conforme'];
const isFraud = (outcome) => /^fraude/i.test(String(outcome || ''));

/** Conclusion déduite du résultat : non avéré pour une livraison conforme ou une fraude */
export function verdictOf(outcome) {
  return NOT_PROVEN.includes(outcome) || isFraud(outcome) ? 'Non avéré' : 'Avéré';
}

// Imputation certaine pour ces résultats ; les autres (colis perdu, endommagé, retards…)
// peuvent venir de chez nous comme du transporteur : l'agent choisit
const IMPUTATION_BY_OUTCOME = {
  'Contestation de livraison': 'Transporteur',
  Inversion: 'Interne',
  Montage: 'Interne',
  Logistique: 'Interne',
  'Produit d’occasion': 'Interne',
  'Livraison conforme': 'Autre',
};

/** Imputation proposée pour un résultat ('' quand elle dépend du dossier) */
export function imputationFor(outcome) {
  if (isFraud(outcome)) return 'Autre';
  return IMPUTATION_BY_OUTCOME[outcome] || '';
}

// États transporteur « en attente » : une décision ou un « ne concerne pas » les fait avancer
const WAITING = [
  '',
  'À transmettre',
  'Envoyé au transporteur',
  'En attente réponse',
  'Indemnisation attendue',
];
const REAL_DECISIONS = ['Accepté', 'Partiel', 'Refusé'];

/**
 * Applique les règles après un changement du formulaire.
 * @param {Record<string, any>} prev valeurs avant le changement
 * @param {Record<string, any>} next valeurs après le changement (modifiées sur place et renvoyées)
 * @param {string} today date du jour (AAAA-MM-JJ)
 */
export function applyTreatmentRules(prev, next, today) {
  // Résultat → imputation proposée (sauf si l'agent en a choisi une autre)
  if (next.outcome !== prev.outcome) {
    const before = imputationFor(prev.outcome);
    const after = imputationFor(next.outcome);
    if (!next.imputation || next.imputation === before) next.imputation = after || '';
  }
  // Rien à réclamer au transporteur (faute interne ou tiers) : « Ne concerne pas », dossier clos
  if (next.imputation !== prev.imputation) {
    if (['Interne', 'Autre'].includes(next.imputation) && !next.carrierDecision)
      next.carrierDecision = NOT_CARRIER;
    // Imputation qui n'est plus Interne / Autre (Transporteur, ou retirée) : la réclamation au
    // transporteur redevient à faire
    if (!['Interne', 'Autre'].includes(next.imputation) && next.carrierDecision === NOT_CARRIER)
      next.carrierDecision = '';
  }
  if (next.carrierDecision !== prev.carrierDecision) {
    if (next.carrierDecision === NOT_CARRIER && WAITING.includes(String(next.carrierStatus || '')))
      next.carrierStatus = 'Clos';
    // « Ne concerne pas » retiré : le dossier transporteur rouvre (relances et délais de nouveau suivis)
    if (
      prev.carrierDecision === NOT_CARRIER &&
      !next.carrierDecision &&
      next.carrierStatus === 'Clos'
    )
      next.carrierStatus = next.carrierSentAt ? 'En attente réponse' : 'À transmettre';
    if (REAL_DECISIONS.includes(next.carrierDecision)) {
      if (WAITING.includes(String(next.carrierStatus || ''))) next.carrierStatus = 'Réponse reçue';
      if (!next.carrierReplyAt) next.carrierReplyAt = today;
    }
  }
  return next;
}
