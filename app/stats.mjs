// Statistiques par transporteur, enseigne, agent, type ou résultat (page « Analyses & rapports »).
// Calculées dans le navigateur à partir de la liste allégée des dossiers.

export const STAT_DIMENSIONS = {
  carrier: 'Transporteur',
  brand: 'Enseigne',
  store: 'Magasin',
  assignee: 'Agent litige',
  type: 'Type à l’ouverture',
  outcome: 'Résultat du litige',
};

import {
  indemnityGap,
  isAnticipatedCredit,
  noCarrierClaimFor,
  shipmentsFor,
} from './carrier-tracking.mjs';
import { csvCell } from './csv.mjs';
import { stakeOf } from './advanced-filters.mjs';
import { carrierDays, clientDays, commonDays } from './delays.mjs';

const DAY = 86400000;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round = (v, d = 1) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);
const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

// Délai de réponse attendu du transporteur : règle SLA « réponse du transporteur » si elle est
// active, sinon 15 jours.
export function carrierLimitHours(rules) {
  const rule = (rules || []).find((r) => r.kind === 'carrier' && r.enabled !== false);
  return rule ? rule.hours : 15 * 24;
}

function emptyGroup(key) {
  return {
    key,
    total: 0,
    open: 0,
    resolved: 0,
    founded: 0, // avérés
    unfounded: 0, // non avérés
    resolutionDays: [],
    sent: 0,
    replied: 0,
    replyDays: [],
    due: 0, // réponses dont on peut juger le délai (reçues, ou attendues et déjà en retard)
    lateReplies: 0,
    recovered: 0, // indemnisations des dossiers ayant un avoir imputé au transporteur
    compensation: 0,
    disputeValue: 0,
    credits: 0, // avoirs émis (tous)
    carrierCredits: 0, // avoirs émis imputés au transporteur (circuit des demandes d'avoir)
    accepted: 0, // décision du transporteur : accepté
    partial: 0, // accepté en partie
    refused: 0, // refusé
    gap: 0, // écart d'indemnisation (valeur du litige − indemnisation)
    anticipated: 0, // avoirs émis avant la réponse du transporteur
    shipments: null, // expéditions sur la période (outil d'expédition)
    transport: 0, // dossiers d'origine Transport
    stake: 0, // montant en jeu des dossiers (stakeOf)
    clientDays: [], // délai client : ouverture → solution client définitive
    carrierDays: [], // délai transporteur : transmission → dossier transporteur clos
    types: new Map(), // types de litige, pour le type le plus fréquent
  };
}

const decided = (g) => g.accepted + g.partial + g.refused;

function finish(g, grandTotal) {
  const qualified = g.founded + g.unfounded;
  const [topType, topCount] = [...g.types].sort((a, b) => b[1] - a[1])[0] || ['', 0];
  return {
    key: g.key,
    total: g.total,
    share: grandTotal ? round((g.total / grandTotal) * 100, 1) : null,
    stake: round(g.stake, 2),
    avgStake: g.total ? round(g.stake / g.total, 2) : null,
    topType: topType ? topType + ' (' + round((topCount / g.total) * 100, 0) + ' %)' : '',
    avgClientDays: round(avg(g.clientDays)),
    avgCarrierDays: round(avg(g.carrierDays)),
    noReply: g.sent - g.replied,
    // Reste à notre charge : avoirs imputés au transporteur non couverts par l'indemnisation
    netLoss: round(g.carrierCredits - g.recovered, 2),
    open: g.open,
    resolved: g.resolved,
    founded: g.founded,
    unfounded: g.unfounded,
    foundedRate: qualified ? round((g.founded / qualified) * 100, 0) : null,
    avgResolutionDays: round(avg(g.resolutionDays)),
    sent: g.sent,
    replied: g.replied,
    avgReplyDays: round(avg(g.replyDays)),
    lateReplies: g.lateReplies,
    // Les dossiers encore dans le délai, sans réponse, ne comptent ni à l'heure ni en retard
    onTimeRate: g.due ? round(((g.due - g.lateReplies) / g.due) * 100, 0) : null,
    compensation: round(g.compensation, 2),
    disputeValue: round(g.disputeValue, 2),
    credits: round(g.credits, 2),
    carrierCredits: round(g.carrierCredits, 2),
    // Même périmètre des deux côtés : les dossiers du circuit des demandes d'avoir
    recoveryRate: g.carrierCredits ? round((g.recovered / g.carrierCredits) * 100, 0) : null,
    accepted: g.accepted,
    partial: g.partial,
    refused: g.refused,
    acceptedRate: decided(g) ? round(((g.accepted + g.partial) / decided(g)) * 100, 0) : null,
    refusedRate: decided(g) ? round((g.refused / decided(g)) * 100, 0) : null,
    gap: round(g.gap, 2),
    anticipated: g.anticipated,
    shipments: g.shipments,
    // Part des expéditions qui donnent un litige (dossiers d'origine Transport)
    disputeRate: g.shipments ? round((g.transport / g.shipments) * 100, 2) : null,
  };
}

function add(g, r, limitHours, now) {
  g.total++;
  g.stake += stakeOf(r);
  const type = String(r.type || 'Non renseigné');
  g.types.set(type, (g.types.get(type) || 0) + 1);
  const cd = clientDays(r);
  if (cd !== null) g.clientDays.push(cd);
  const td = carrierDays(r);
  if (td !== null) g.carrierDays.push(td);
  if (r.origin === 'Transport') g.transport++;
  if (r.carrierDecision === 'Accepté') g.accepted++;
  if (r.carrierDecision === 'Partiel') g.partial++;
  if (r.carrierDecision === 'Refusé') g.refused++;
  const gap = indemnityGap(r);
  if (gap !== null) g.gap += gap;
  if (isAnticipatedCredit(r)) g.anticipated++;
  if (r.status === 'Résolu') g.resolved++;
  else g.open++;
  if (r.resolution?.verdict === 'Avéré') g.founded++;
  if (r.resolution?.verdict === 'Non avéré') g.unfounded++;
  const common = commonDays(r);
  if (common !== null) g.resolutionDays.push(common);
  const sent = Date.parse(r.carrierSentAt);
  // Délais de réponse : seulement quand une réponse du transporteur est attendue
  if (Number.isFinite(sent) && !noCarrierClaimFor(r)) {
    g.sent++;
    const reply = Date.parse(r.carrierReplyAt);
    if (Number.isFinite(reply) && reply >= sent) {
      g.replied++;
      g.due++;
      g.replyDays.push((reply - sent) / DAY);
      if ((reply - sent) / 3600000 > limitHours) g.lateReplies++;
    } else if (r.status !== 'Résolu' && (now - sent) / 3600000 > limitHours) {
      g.due++;
      g.lateReplies++;
    }
  }
  g.compensation += num(r.compensation);
  g.disputeValue += num(r.disputeValue);
  if (r.creditIssued) g.credits += num(r.credit);
  let carrierCredit = 0;
  for (const c of r.credits || [])
    if (c.status === 'issued' && c.imputation === 'Transporteur')
      carrierCredit += num(c.approvedAmount ?? c.amount);
  if (carrierCredit > 0) {
    g.carrierCredits += carrierCredit;
    g.recovered += num(r.compensation);
  }
}

// Statistiques regroupées. Par transporteur, seuls les dossiers d'origine « Transport » sont
// pris en compte. Renvoie { rows, total } ; rows triées par nombre de dossiers décroissant.
/**
 * @param {object[]} records
 * @param {string} by
 * @param {{ rules?: object[], now?: number, label?: (k: string) => string,
 *   shipments?: Record<string, Record<string, number>> | null,
 *   keepMonth?: (month: string) => boolean }} [options]
 */
export function groupStats(
  records,
  by,
  { rules = [], now = Date.now(), label = (k) => k, shipments = null, keepMonth } = {},
) {
  const limit = carrierLimitHours(rules);
  const groups = new Map();
  const all = emptyGroup('Total');
  for (const r of records || []) {
    if (by === 'carrier' && r.origin !== 'Transport') continue;
    // Par magasin : seuls les dossiers de l'enseigne « MAGASIN »
    if (by === 'store' && r.brand !== 'MAGASIN') continue;
    const raw =
      by === 'carrier'
        ? r.carrier
        : by === 'brand'
          ? r.brand
          : by === 'store'
            ? r.store
            : by === 'type'
              ? r.type
              : by === 'outcome'
                ? r.outcome
                : r.assignee;
    const key = raw
      ? label(String(raw))
      : by === 'assignee'
        ? 'Non attribué'
        : by === 'outcome'
          ? 'À qualifier'
          : 'Non renseigné';
    if (!groups.has(key)) groups.set(key, emptyGroup(key));
    add(groups.get(key), r, limit, now);
    add(all, r, limit, now);
  }
  // Expéditions (par transporteur, ou au total) : nécessaires au ratio litiges / expéditions
  if (shipments) {
    if (by === 'carrier')
      for (const g of groups.values()) g.shipments = shipmentsFor(shipments, g.key, keepMonth);
    all.shipments = shipmentsFor(shipments, '', keepMonth);
  }
  return {
    rows: [...groups.values()]
      .map((g) => finish(g, all.total))
      .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key)),
    total: finish(all, all.total),
  };
}

// Colonnes du tableau et de l'export CSV
// Pensé pour les négociations de contrat transporteur : volume et poids, sinistralité,
// argent en jeu et récupéré, comportement du transporteur, délais.
export const STAT_COLUMNS = [
  // Volume et poids
  ['total', 'Dossiers'],
  ['share', 'Part des dossiers (%)'],
  ['open', 'En cours'],
  ['shipments', 'Expéditions'],
  ['disputeRate', 'Litiges / expéditions (%)'],
  ['topType', 'Type de litige principal'],
  ['foundedRate', 'Avérés (%)'],
  // Argent en jeu et récupéré
  ['stake', 'Montant en jeu (€)'],
  ['avgStake', 'Montant moyen par dossier (€)'],
  ['credits', 'Avoirs émis (€)'],
  ['carrierCredits', 'Avoirs imputés au transporteur (€)'],
  ['compensation', 'Indemnisations obtenues (€)'],
  ['recoveryRate', 'Taux de récupération (%)'],
  ['netLoss', 'Reste à notre charge (€)'],
  ['gap', 'Écart d’indemnisation (€)'],
  ['anticipated', 'Avoirs anticipés'],
  // Comportement du transporteur
  ['sent', 'Dossiers transmis au transporteur'],
  ['noReply', 'Dossiers sans réponse'],
  ['acceptedRate', 'Acceptés par le transporteur (%)'],
  ['refusedRate', 'Refusés par le transporteur (%)'],
  ['avgReplyDays', 'Délai moyen de réponse transporteur (j)'],
  ['onTimeRate', 'Réponses dans le délai (%)'],
  // Délais
  ['avgCarrierDays', 'Délai transporteur (j)'],
  ['avgClientDays', 'Délai client (j)'],
  ['avgResolutionDays', 'Délai dossier (j)'],
];

export function statsCsv(result, dimensionLabel) {
  const cell = csvCell;
  const fmt = (v) => (v === null || v === undefined ? '' : String(v).replace('.', ','));
  const lines = [
    [dimensionLabel, ...STAT_COLUMNS.map(([, l]) => l)],
    ...[...result.rows, result.total].map((row) => [
      row.key,
      ...STAT_COLUMNS.map(([k]) => fmt(row[k])),
    ]),
  ];
  return '﻿' + lines.map((l) => l.map(cell).join(';')).join('\r\n');
}
