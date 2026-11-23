import type { Dossier } from './types';
import { noCarrierClaimFor } from './carrier-tracking.mjs';

export const carrierStages = [
  'À transmettre',
  'Envoyé au transporteur',
  'En attente réponse',
  'Réponse reçue',
  'Indemnisation attendue',
  'Clos',
];
export const clientStages = [
  'En attente réponse transporteur',
  'À contacter',
  'Retour à organiser',
  'Retour demandé',
  'Produit reçu',
  'Solution à valider',
  // Un avoir est toujours fait avant un remboursement : « Avoir - nouvelle commande client »
  // distingue le client qui repasse commande de celui qui veut être remboursé
  'Avoir - nouvelle commande client',
  'Remboursement',
  'Solution apportée',
];
// « Prochaine action client » : la colonne SharePoint « Assurer un suivi » était une case à
// cocher (Vrai / False…) ; ces valeurs ne sont pas une action et ne s'affichent pas
export function followUpText(value: unknown) {
  const v = String(value ?? '').trim();
  return /^(vrai|faux|true|false|oui|non|yes|no|0|1)$/i.test(v) ? '' : v;
}
// Imputation du litige à la clôture : qui en porte la responsabilité
// (Autre : ni nous ni le transporteur, par exemple un point relais qui renvoie le colis trop tôt)
export const imputations = ['Interne', 'Transporteur', 'Autre'];
// Imputations sans écart d'indemnisation à réclamer au transporteur
export const noCarrierClaim = ['Interne', 'Autre'];
export function waitingCarrier(r: Dossier) {
  return (
    r.status !== 'Résolu' &&
    !noCarrierClaimFor(r) &&
    (
      ['Envoyé au transporteur', 'En attente réponse', 'Indemnisation attendue'] as (
        string | undefined
      )[]
    ).includes(r.carrierStatus)
  );
}
export function overdueCarrier(r: Dossier) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const val = (t: string) => parts.find((p) => p.type === t)?.value;
  const today = [val('year'), val('month'), val('day')].join('-');
  return (
    r.status !== 'Résolu' &&
    r.carrierStatus !== 'Clos' &&
    r.carrierStatus !== 'Réponse reçue' &&
    !noCarrierClaimFor(r) &&
    !!r.carrierFollowupAt &&
    r.carrierFollowupAt.slice(0, 10) <= today
  );
}
