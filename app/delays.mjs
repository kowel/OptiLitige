// Les trois délais d'un litige (20/11/2026) :
// - client : ouverture du dossier → solution client établie, définitive (étape client finale) ;
// - transporteur : ouverture du dossier transporteur (transmission) → dossier transporteur clos ;
// - commun : ouverture → clôture du dossier.
// Les dates de fin client et transporteur sont posées par le serveur au moment où l'étape est
// atteinte (stampMilestones) ; un dossier qui en ressort perd la date.

const DAY = 86400000;

/** Étapes client qui valent solution définitive */
export const FINAL_CLIENT_STAGES = [
  'Solution apportée',
  'Remboursement',
  'Avoir - nouvelle commande client',
];

/** Pose ou retire les dates de fin client et transporteur d'un dossier (modifié en place) */
export function stampMilestones(r, now) {
  if (FINAL_CLIENT_STAGES.includes(r.clientStage)) r.clientSolvedAt = r.clientSolvedAt || now;
  else r.clientSolvedAt = null;
  if (r.carrierStatus === 'Clos') r.carrierClosedAt = r.carrierClosedAt || now;
  else r.carrierClosedAt = null;
  return r;
}

const span = (from, to) => {
  const a = Date.parse(from),
    b = Date.parse(to);
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? (b - a) / DAY : null;
};

// Dossiers repris de SharePoint : l'étape y était déjà atteinte, sans date. Fin estimée : la
// clôture du dossier (ou, côté transporteur, sa réponse si le dossier est encore ouvert).
const imported = (r) => !!r.importedAt;
const closedAt = (r) => (r.status === 'Résolu' && r.closed ? r.closed : null);
/** Fin de la solution client : date posée par l'outil, sinon estimée pour un dossier repris */
export const clientEnd = (r) =>
  r.clientSolvedAt ||
  (imported(r) && FINAL_CLIENT_STAGES.includes(r.clientStage) ? closedAt(r) : null);
/** Fin du dossier transporteur : date posée par l'outil, sinon estimée pour un dossier repris */
export const carrierEnd = (r) =>
  r.carrierClosedAt ||
  (imported(r) && r.carrierStatus === 'Clos' ? closedAt(r) || r.carrierReplyAt || null : null);
/** Délai client (jours) : ouverture → solution client définitive */
export const clientDays = (r) => {
  const end = clientEnd(r);
  return end ? span(r.created, end) : null;
};
/** Délai transporteur (jours) : transmission au transporteur → dossier transporteur clos */
export const carrierDays = (r) => {
  const end = carrierEnd(r);
  return end && r.carrierSentAt ? span(r.carrierSentAt, end) : null;
};
/** Délai commun (jours) : ouverture → clôture du dossier */
export const commonDays = (r) =>
  r.status === 'Résolu' && r.closed ? span(r.created, r.closed) : null;

const average = (list) => {
  const v = list.filter((x) => x !== null);
  return { days: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, count: v.length };
};

/** Moyennes des trois délais : { client, carrier, common } = { days (ou null), count } */
export function delayAverages(records) {
  return {
    client: average(records.map(clientDays)),
    carrier: average(records.map(carrierDays)),
    common: average(records.map(commonDays)),
  };
}
