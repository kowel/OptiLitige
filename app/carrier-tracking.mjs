// Suivi de bout en bout d'un litige, côté client et côté transporteur (comme l'ancien tableau
// Excel 2025) : décision du transporteur, écart d'indemnisation, avoir anticipé, prochaine
// étape, et nombre d'expéditions par transporteur et par mois (ratio litiges / expéditions).
import { csvCell } from './csv.mjs';

// Décision du transporteur sur la réclamation. « Ne concerne pas le transporteur » : litige qui
// ne relève pas de lui (colis remis au mauvais transporteur, erreur de préparation…), aucune
// réclamation ni décision à attendre
export const NOT_CARRIER = 'Ne concerne pas le transporteur';
export const CARRIER_DECISIONS = ['Accepté', 'Partiel', 'Refusé', NOT_CARRIER];

// Rien à attendre ni à réclamer au transporteur : litige d'origine interne, imputé Interne ou
// Autre, ou décision « Ne concerne pas le transporteur ». Une seule règle pour tout l'outil :
// délais, relances, suivi de bout en bout, écart d'indemnisation, avoir anticipé, étapes.
export function noCarrierClaimFor(r) {
  return (
    (!!r?.origin && r.origin !== 'Transport') ||
    r?.imputation === 'Interne' ||
    r?.imputation === 'Autre' ||
    r?.carrierDecision === NOT_CARRIER
  );
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const day = (v) => (v ? String(v).slice(0, 10) : '');
const fr = (d) => (d ? d.split('-').reverse().join('/') : '');

// Statut côté client, comme la colonne « statut client » du fichier Excel
export const clientSide = (r) => (r.status === 'Résolu' ? 'Terminé' : 'En cours');

// Statut côté transporteur : « Accepté », « Partiel », « Refusé » une fois la décision connue,
// sinon « En cours » (ou « À transmettre » tant que rien n'a été envoyé)
export function carrierSide(r) {
  if (noCarrierClaimFor(r)) return 'Sans objet';
  if (CARRIER_DECISIONS.includes(r.carrierDecision)) return r.carrierDecision;
  if (!r.carrierSentAt && (!r.carrierStatus || r.carrierStatus === 'À transmettre'))
    return 'À transmettre';
  return 'En cours';
}

// Écart d'indemnisation : valeur du litige TTC moins l'indemnisation reçue du transporteur
// (null quand la valeur du litige n'est pas renseignée, ou quand le litige n'est pas imputé au
// transporteur : Interne, la faute est de notre côté ; Autre, un tiers comme un point relais)
export function indemnityGap(r) {
  if (noCarrierClaimFor(r)) return null;
  const value = num(r.disputeValue);
  if (value <= 0) return null;
  return Math.round((value - num(r.compensation)) * 100) / 100;
}

// Date d'émission de l'avoir (circuit des demandes d'avoir, sinon suivi financier)
function creditDay(r) {
  const issued = (r.credits || [])
    .filter((c) => c.status === 'issued')
    .map((c) => day(c.issue?.date || c.issue?.at || c.statusAt))
    .filter(Boolean)
    .sort();
  if (issued.length) return issued[0];
  if (r.creditIssued || r.creditNumber) return day(r.creditCreated);
  return '';
}

// Avoir anticipé : l'avoir client a été émis avant la réponse du transporteur (ou sans réponse
// à ce jour), comme les « avoir anticipé car hors délai » du fichier Excel
export function isAnticipatedCredit(r) {
  if (r.origin && r.origin !== 'Transport') return false;
  // Rien à attendre du transporteur (faute interne, tiers, ou décision « ne le concerne pas ») :
  // l'avoir n'anticipe aucune réponse
  if (noCarrierClaimFor(r)) return false;
  const credit = creditDay(r);
  if (!credit) return false;
  const reply = day(r.carrierReplyAt);
  return !reply || credit < reply;
}

// Prochaine étape côté transporteur, comme la colonne « raison » du fichier Excel
export function nextCarrierStep(r) {
  if (noCarrierClaimFor(r)) return '';
  if (CARRIER_DECISIONS.includes(r.carrierDecision))
    return 'Décision : ' + r.carrierDecision.toLowerCase();
  if (r.carrierReplyAt) return 'Réponse reçue le ' + fr(day(r.carrierReplyAt));
  if (r.carrierFollowupAt) return 'Relance le ' + fr(day(r.carrierFollowupAt));
  if (r.carrierResponseDue) return 'Réponse prévue le ' + fr(day(r.carrierResponseDue));
  if (r.carrierSentAt) return 'Transmis le ' + fr(day(r.carrierSentAt));
  return 'À transmettre';
}

// Colonnes de la vue « Suivi de bout en bout » et de son export (ordre du fichier Excel)
export const TRACKING_COLUMNS = [
  ['order', 'N° de commande'],
  ['brand', 'Enseigne (BU)'],
  ['ticket', 'N° de ticket'],
  ['carrier', 'Transporteur'],
  ['bt', 'BT'],
  ['type', 'Typologie'],
  ['created', 'Déclaration'],
  ['clientSide', 'Statut client'],
  ['clientStage', 'Étape client'],
  ['carrierSide', 'Statut transporteur'],
  ['nextStep', 'Prochaine étape transporteur'],
  ['disputeValue', 'Valeur litige TTC'],
  ['compensation', 'Indemnisation'],
  ['gap', 'Écart'],
  ['creditDate', 'Date avoir'],
  ['invoice', 'N° facture'],
  ['creditNumber', 'N° avoir'],
  ['anticipated', 'Avoir anticipé'],
  ['ref', 'Dossier'],
];

export function trackingRow(r) {
  return {
    order: r.order || '',
    brand: (r.brand || '') + (r.store ? ' · ' + r.store : ''),
    ticket: r.ticket || '',
    carrier: r.origin === 'Transport' ? r.carrier || '' : 'Interne',
    bt: r.bt || '',
    type: r.type || '',
    created: day(r.created),
    clientSide: clientSide(r),
    clientStage: r.status === 'Résolu' ? '' : r.clientStage || '',
    carrierSide: carrierSide(r),
    nextStep: nextCarrierStep(r),
    disputeValue: num(r.disputeValue) || null,
    compensation: num(r.compensation) || null,
    gap: indemnityGap(r),
    creditDate: creditDay(r),
    invoice: r.invoice || '',
    creditNumber: r.creditNumber || '',
    anticipated: isAnticipatedCredit(r),
    ref: r.ref || '',
  };
}

// --- Expéditions ---------------------------------------------------------------------------
// Nombre d'expéditions par mois et par transporteur, reçu de l'outil d'expédition
// (POST /api/shipments) ou saisi par un responsable : { '2026-11': { COLISSIMO: 1234 } }.

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const carrierKey = (name) =>
  String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();

// Contrôle et nettoie des comptes reçus ; renvoie { months } ou { error }
/**
 * @param {unknown} input
 * @returns {{ months?: Record<string, Record<string, number>>, error?: string }}
 */
export function normalizeShipments(input) {
  /** @type {Record<string, Record<string, number>>} */
  const months = {};
  const entries = Array.isArray(input)
    ? input
    : Object.entries(input || {}).flatMap(([month, counts]) =>
        Object.entries(counts || {}).map(([carrier, count]) => ({ month, carrier, count })),
      );
  if (entries.length > 5000) return { error: 'Trop de lignes (5 000 au maximum).' };
  for (const e of entries) {
    const month = String(e?.month || '');
    const carrier = carrierKey(e?.carrier);
    const count = Number(e?.count);
    if (!MONTH.test(month)) return { error: 'Mois invalide : ' + month + ' (format AAAA-MM).' };
    if (!carrier || carrier.length > 80) return { error: 'Transporteur invalide.' };
    if (!Number.isInteger(count) || count < 0 || count > 10_000_000)
      return { error: 'Nombre d’expéditions invalide pour ' + carrier + ' (' + month + ').' };
    (months[month] ||= {})[carrier] = count;
  }
  return { months };
}

// Fusionne de nouveaux comptes dans les mois existants (un mois reçu remplace ses valeurs
// transporteur par transporteur)
export function mergeShipments(previous, months) {
  const out = { ...(previous || {}) };
  for (const [month, counts] of Object.entries(months))
    out[month] = { ...(out[month] || {}), ...counts };
  return out;
}

// Expéditions d'un transporteur (ou de tous) sur les mois retenus par `keepMonth(month)`
export function shipmentsFor(months, carrier, keepMonth = () => true) {
  const key = carrier ? carrierKey(carrier) : '';
  let total = 0,
    found = false;
  for (const [month, counts] of Object.entries(months || {})) {
    if (!keepMonth(month)) continue;
    for (const [c, n] of Object.entries(counts || {}))
      if (!key || c === key) {
        total += n;
        found = true;
      }
  }
  return found ? total : null;
}

// Export CSV (Excel) de la vue « Suivi de bout en bout »
export function trackingCsv(records) {
  const cell = csvCell;
  const fmt = (k, v) =>
    v === null || v === undefined
      ? ''
      : typeof v === 'boolean'
        ? v
          ? 'Oui'
          : 'Non'
        : typeof v === 'number'
          ? String(v).replace('.', ',')
          : ['created', 'creditDate'].includes(k)
            ? fr(v)
            : v;
  const lines = [
    TRACKING_COLUMNS.map(([, l]) => l),
    ...(records || []).map((r) => {
      const row = trackingRow(r);
      return TRACKING_COLUMNS.map(([k]) => fmt(k, row[k]));
    }),
  ];
  return '﻿' + lines.map((l) => l.map(cell).join(';')).join('\r\n');
}
