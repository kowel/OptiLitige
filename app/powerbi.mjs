// Données pour Power BI (GET /api/powerbi) : une ligne par litige avec tout le volet transport,
// et une ligne par mois et par transporteur pour les expéditions. Lecture seule, protégée par un
// jeton que les responsables créent dans Paramètres → Power BI (seule son empreinte est gardée).
// Pas de donnée personnelle : ni nom ni compte du client, ni commentaires, ni pièces jointes.
import { stakeOf } from './advanced-filters.mjs';
import { indemnityGap, isAnticipatedCredit, noCarrierClaimFor } from './carrier-tracking.mjs';

export const POWERBI_KEY = 'powerbi-token';
export const POWERBI_TABLES = ['litiges', 'expeditions'];

const DAY = 86400e3;
const days = (from, to) => {
  const a = Date.parse(from || ''),
    b = Date.parse(to || '');
  return Number.isFinite(a) && Number.isFinite(b) && b >= a
    ? Math.round(((b - a) / DAY) * 10) / 10
    : null;
};
const date = (v) => (v && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v) => Math.round(v * 100) / 100;

// Montant des avoirs émis : circuit des demandes, plus un éventuel avoir saisi à l'ancienne
function creditsIssued(r) {
  const issued = (r.credits || [])
    .filter((c) => c.status === 'issued')
    .reduce((n, c) => n + num(c.approvedAmount ?? c.amount), 0);
  const legacy = r.creditIssued ? Math.max(0, num(r.credit) - issued) : 0;
  return round2(issued + legacy);
}

/** Une ligne par litige (colonnes en français, prêtes pour Power BI) */
export function litigeRows(records) {
  return (records || []).map((r) => {
    const transport = r.origin === 'Transport';
    return {
      Reference: r.ref || r.id,
      Ouverture: date(r.created),
      PriseEnCharge: date(r.takenAt),
      Cloture: date(r.closed),
      Statut: r.status || '',
      Origine: r.origin || '',
      TypeOuverture: r.type || '',
      Resultat: r.outcome || '',
      Imputation: r.imputation || '',
      Conclusion: r.resolution?.verdict || '',
      Enseigne: r.brand || '',
      Magasin: r.store || '',
      Transporteur: transport ? r.carrier || '' : '',
      ConcerneTransporteur: !noCarrierClaimFor(r),
      MontantLitige: round2(stakeOf(r)),
      EtatTransporteur: transport ? r.carrierStatus || '' : '',
      DecisionTransporteur: transport ? r.carrierDecision || '' : '',
      EnvoiTransporteur: transport ? date(r.carrierSentAt) : null,
      ReponseTransporteur: transport ? date(r.carrierReplyAt) : null,
      DelaiReponseTransporteurJours: transport ? days(r.carrierSentAt, r.carrierReplyAt) : null,
      Indemnisation: round2(num(r.compensation)),
      EcartIndemnisation: indemnityGap(r),
      AvoirsEmis: creditsIssued(r),
      AvoirAnticipe: isAnticipatedCredit(r),
      EtapeClient: r.clientStage || '',
      DelaiPriseEnChargeJours: days(r.created, r.takenAt),
      DelaiResolutionJours: days(r.created, r.closed),
      Reouvertures: (r.reopened || []).length,
    };
  });
}

/** Une ligne par mois et par transporteur (settings « shipments ») */
export function expeditionRows(shipments) {
  const rows = [];
  for (const [month, byCarrier] of Object.entries(shipments?.months || {}))
    for (const [carrier, count] of Object.entries(byCarrier || {}))
      rows.push({ Mois: month + '-01', Transporteur: carrier, Expeditions: num(count) });
  return rows.sort(
    (a, b) => a.Mois.localeCompare(b.Mois) || a.Transporteur.localeCompare(b.Transporteur),
  );
}

// Jeton : 40 caractères aléatoires ; seule son empreinte SHA-256 est enregistrée
export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(30));
  return (
    'olpbi_' +
    btoa(String.fromCharCode(...bytes)).replace(
      /[+/=]/g,
      (c) => ({ '+': '-', '/': '_', '=': '' })[c],
    )
  );
}
export async function hashToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(token)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** État du jeton pour l'écran (jamais le jeton ni son empreinte) */
export function powerbiStatus(saved) {
  return saved?.hash
    ? {
        active: true,
        createdAt: saved.createdAt || '',
        createdBy: saved.createdBy || '',
        hint: saved.hint || '',
        lastUsedAt: saved.lastUsedAt || '',
      }
    : { active: false, createdAt: '', createdBy: '', hint: '', lastUsedAt: '' };
}
