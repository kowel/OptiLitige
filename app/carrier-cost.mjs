// Coût des litiges imputables au transporteur (négociations de contrat) : ce que nous
// remboursons au client, ce que le transporteur nous indemnise, et la différence qui reste à
// notre charge. Exemple : PC de 3 000 € perdu par le transporteur, avoir de 3 000 € au client,
// indemnisation forfaitaire de 250 € → 2 750 € à notre charge.
//
// Périmètre : dossiers d'origine Transport dont la faute revient au transporteur (ni imputés
// Interne ou Autre, ni décision « Ne concerne pas le transporteur » : noCarrierClaimFor).
// Utilisé par l'écran Analyses (app/carrier-cost-panel.tsx) et les statistiques (app/stats.mjs).
import { noCarrierClaimFor } from './carrier-tracking.mjs';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v) => Math.round(v * 100) / 100;

/** Le dossier compte-t-il dans le coût transporteur ? */
export const carrierFault = (r) => r?.origin === 'Transport' && !noCarrierClaimFor(r);

/**
 * Montants d'un dossier : remboursé au client (avoirs émis, champ « Avoir » du dossier, qui
 * cumule aussi les avoirs du circuit des demandes), indemnisé par le transporteur, reste à notre
 * charge (jamais négatif : une indemnisation supérieure à l'avoir ne « rapporte » rien ici).
 */
export function carrierCostOf(r) {
  // Avoirs émis par le circuit des demandes, au cas où le champ du dossier serait en retard
  const issued = (r?.credits || [])
    .filter((c) => c.status === 'issued')
    .reduce((n, c) => n + num(c.approvedAmount ?? c.amount), 0);
  const refunded = Math.max(r?.creditIssued ? num(r.credit) : 0, issued);
  const compensated = num(r?.compensation);
  return {
    refunded: round2(refunded),
    compensated: round2(compensated),
    netLoss: round2(Math.max(0, refunded - compensated)),
    value: round2(num(r?.disputeValue)),
  };
}

function empty(key) {
  return {
    key,
    dossiers: 0, // dossiers imputables au transporteur
    refundedCount: 0, // dont avec un avoir au client
    compensatedCount: 0, // dont indemnisés par le transporteur
    value: 0, // valeur des litiges (marchandise perdue ou abîmée)
    refunded: 0,
    compensated: 0,
    covered: 0, // indemnisations des seuls dossiers remboursés (même périmètre que refunded)
    netLoss: 0,
  };
}
function add(g, r) {
  const c = carrierCostOf(r);
  g.dossiers++;
  if (c.refunded > 0) g.refundedCount++;
  if (c.compensated > 0) g.compensatedCount++;
  g.value += c.value;
  g.refunded += c.refunded;
  g.compensated += c.compensated;
  g.netLoss += c.netLoss;
  if (c.refunded > 0) g.covered += c.compensated;
}
function finish(g) {
  return {
    ...g,
    value: round2(g.value),
    refunded: round2(g.refunded),
    compensated: round2(g.compensated),
    netLoss: round2(g.netLoss),
    // Part de nos remboursements couverte par le transporteur
    // (indemnisations et avoirs pris sur les mêmes dossiers)
    coverageRate: g.refunded ? Math.round((g.covered / g.refunded) * 100) : null,
    // Indemnisation moyenne par dossier indemnisé (forfaits pratiqués)
    avgCompensation: g.compensatedCount ? round2(g.compensated / g.compensatedCount) : null,
    // Reste à charge moyen par dossier remboursé
    avgNetLoss: g.refundedCount ? round2(g.netLoss / g.refundedCount) : null,
  };
}

/**
 * Coût par transporteur : { rows, total, top } — rows triées par reste à charge décroissant,
 * top = les dossiers au plus fort reste à charge (limit, 10 par défaut).
 */
export function carrierCostStats(records, { limit = 10 } = {}) {
  const groups = new Map();
  const all = empty('Total');
  const top = [];
  for (const r of records || []) {
    if (!carrierFault(r)) continue;
    const key = String(r.carrier || '').trim() || 'Non renseigné';
    if (!groups.has(key)) groups.set(key, empty(key));
    add(groups.get(key), r);
    add(all, r);
    const c = carrierCostOf(r);
    if (c.netLoss > 0) top.push({ record: r, ...c });
  }
  top.sort((a, b) => b.netLoss - a.netLoss);
  return {
    rows: [...groups.values()]
      .map(finish)
      .sort((a, b) => b.netLoss - a.netLoss || b.dossiers - a.dossiers),
    total: finish(all),
    top: top.slice(0, limit),
  };
}
