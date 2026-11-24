// Demandes d'avoir : motifs, imputations, règles de validation et étapes du circuit.
// Partagé par l'API (app/api/data/route.ts), l'écran (app/credit-panel.tsx,
// app/credit-settings.tsx), les notifications (app/alerts.mjs) et les tests.
//
// Circuit : Demandé → (Validation admin si la règle l'exige) → Accepté → Émis
//           ou Refusé / Annulé. L'émission reporte le n° d'avoir ERP et le montant dans les
//           champs « avoir » du dossier, pour que les tableaux de bord existants en tiennent compte.

import { stakeOf } from './advanced-filters.mjs';
import { treatsDisputes } from './roles.mjs';
import { normalizeCreditNotify } from './credit-mail.mjs';
export const CREDIT_FAMILIES = {
  legal: 'Obligation légale',
  commercial: 'Geste commercial',
  fees: 'Remboursement de frais',
};

export const CREDIT_KINDS = {
  total: 'Avoir total (toute la commande)',
  partial: 'Avoir partiel',
  shipping: 'Frais de port seuls',
};

export const CREDIT_STATUSES = {
  requested: 'Demandé',
  manager: 'Validation admin',
  accepted: 'Accepté',
  issued: 'Émis',
  refused: 'Refusé',
  cancelled: 'Annulé',
};
export const OPEN_CREDIT_STATUSES = ['requested', 'manager', 'accepted'];

// Réglages par défaut, modifiables par les responsables (Paramètres → Avoirs).
// managerAbove : au-delà de ce montant, un admin doit valider (null = jamais).
// Par défaut, aucune validation : la RC, le SAV et le Service Litige sont indépendants, le
// Service Litige fait l'avoir dans l'ERP. Un seuil reste réglable dans Paramètres → Avoirs.
export const DEFAULT_CREDIT_SETTINGS = {
  reasons: {
    legal: [
      'Produit endommagé à la livraison',
      'Produit manquant / colis incomplet',
      'Colis perdu ou non livré',
      'Produit non conforme / erreur de préparation',
      'Défaut de montage',
    ],
    commercial: [
      'Retard de livraison',
      'Désagrément client (satisfaction)',
      'État du produit d’occasion',
    ],
    fees: [
      'Frais de port express non respectés',
      'Frais de retour avancés par le client',
      'Frais de port de la commande',
    ],
  },
  imputations: [
    'Transporteur',
    'Logistique / préparation',
    'Atelier / montage',
    'Fournisseur / fabricant',
    'Geste commercial (Cybertek)',
  ],
  managerAbove: { legal: null, commercial: null, fees: null },
  // Destinataire du mail « Nouvelle demande d'avoir » (app/credit-mail.mjs)
  notify: { name: 'Pierre Mazeaud', email: '' },
};

// Motif proposé d'après le type du litige (l'agent peut le changer).
const TYPE_TO_REASON = {
  'Livraison endommagé': ['legal', 'Produit endommagé à la livraison', 'Transporteur'],
  'Produit manquant': ['legal', 'Produit manquant / colis incomplet', 'Logistique / préparation'],
  'Contestation de livraison': ['legal', 'Colis perdu ou non livré', 'Transporteur'],
  Transport: ['legal', 'Colis perdu ou non livré', 'Transporteur'],
  Inversion: ['legal', 'Produit non conforme / erreur de préparation', 'Logistique / préparation'],
  'Livraison non conforme': [
    'legal',
    'Produit non conforme / erreur de préparation',
    'Logistique / préparation',
  ],
  Logistique: ['legal', 'Produit non conforme / erreur de préparation', 'Logistique / préparation'],
  Montage: ['legal', 'Défaut de montage', 'Atelier / montage'],
  'Retard de livraison classique': ['commercial', 'Retard de livraison', 'Transporteur'],
  'Produit d’occasion': ['commercial', 'État du produit d’occasion', 'Geste commercial (Cybertek)'],
  'Retard de livraison express': ['fees', 'Frais de port express non respectés', 'Transporteur'],
  'Colis prêt expéditeur': ['fees', 'Frais de port de la commande', 'Logistique / préparation'],
};
/** @param {import('./types').CreditSettingsData} [settings] */
export function suggestCredit(type, settings = DEFAULT_CREDIT_SETTINGS) {
  const [family, reason, imputation] = TYPE_TO_REASON[type] || ['commercial', '', ''];
  return {
    family,
    reason: settings.reasons[family]?.includes(reason)
      ? reason
      : settings.reasons[family]?.[0] || '',
    imputation: settings.imputations.includes(imputation)
      ? imputation
      : settings.imputations[0] || '',
  };
}

const cleanList = (list, max) =>
  Array.isArray(list)
    ? [
        ...new Set(
          list
            .map((v) =>
              String(v ?? '')
                .trim()
                .slice(0, 120),
            )
            .filter(Boolean),
        ),
      ].slice(0, max)
    : null;

// Vérifie les réglages envoyés par un responsable. Renvoie { settings } ou { error }.
export function normalizeCreditSettings(input) {
  const reasons = {};
  for (const family of Object.keys(CREDIT_FAMILIES)) {
    const list = cleanList(input?.reasons?.[family], 30);
    if (!list?.length) return { error: 'Chaque famille doit avoir au moins un motif.' };
    reasons[family] = list;
  }
  const imputations = cleanList(input?.imputations, 30);
  if (!imputations?.length) return { error: 'Indiquez au moins une imputation.' };
  const managerAbove = {};
  for (const family of Object.keys(CREDIT_FAMILIES)) {
    const v = input?.managerAbove?.[family];
    if (v === null || v === undefined || v === '') managerAbove[family] = null;
    else if (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1000000)
      managerAbove[family] = Math.round(Number(v) * 100) / 100;
    else return { error: 'Seuil de validation invalide.' };
  }
  const notify = normalizeCreditNotify(input?.notify);
  if (!notify) return { error: 'Adresse e-mail du destinataire des demandes d’avoir invalide.' };
  return { settings: { reasons, imputations, managerAbove, notify } };
}

// Un responsable doit-il valider ce montant pour cette famille ?
/** @param {import('./types').CreditSettingsData} [settings] */
export function needsManager(family, amount, settings = DEFAULT_CREDIT_SETTINGS) {
  const limit = settings.managerAbove?.[family];
  return limit !== null && limit !== undefined && Number(amount) > Number(limit);
}

// Vérifie une nouvelle demande. Renvoie un message d'erreur ou ''.
/** @param {import('./types').CreditSettingsData} [settings] */
export function checkCreditRequest(req, record, settings = DEFAULT_CREDIT_SETTINGS) {
  if (!CREDIT_FAMILIES[req?.family]) return 'Choisissez la famille du motif.';
  if (!settings.reasons[req.family]?.includes(req.reason))
    return 'Choisissez un motif de la liste.';
  if (!CREDIT_KINDS[req.kind]) return 'Choisissez le type d’avoir.';
  if (!settings.imputations.includes(req.imputation))
    return 'Choisissez une imputation de la liste.';
  const amount = Number(req.amount);
  if (!Number.isFinite(amount) || amount <= 0) return 'Indiquez un montant supérieur à zéro.';
  if (stakeOf(record) && amount > stakeOf(record) * 1.5)
    return 'Le montant dépasse largement celui concerné par le litige : vérifiez-le.';
  if (String(req.comment || '').length > 2000) return 'Commentaire trop long (2 000 caractères).';
  return '';
}

// Qui peut faire quoi sur une demande, selon son étape.
export function creditPermissions(credit, member) {
  const role = member?.role;
  const litige = treatsDisputes(role);
  const mine =
    String(credit?.requestedBy || '').toLowerCase() === String(member?.email || '').toLowerCase();
  return {
    decide:
      (credit?.status === 'requested' && litige) ||
      (credit?.status === 'manager' && role === 'Admin'),
    // Le service litige peut refuser même quand la validation revient à un responsable
    refuse: ['requested', 'manager'].includes(credit?.status) && litige,
    issue: credit?.status === 'accepted' && litige,
    cancel: ['requested', 'manager'].includes(credit?.status) && (mine || role === 'Admin'),
  };
}

// Reporte un avoir émis dans les champs « avoir » historiques du dossier (tableaux de bord).
export function applyIssuedCredit(record, amount, number, date) {
  const numbers = String(record.creditNumber || '')
    .split(' / ')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!numbers.includes(number)) numbers.push(number);
  return {
    creditIssued: true,
    creditNumber: numbers.join(' / ').slice(0, 200),
    credit:
      Math.round(((record.creditIssued ? Number(record.credit) || 0 : 0) + Number(amount)) * 100) /
      100,
    creditCreated: record.creditCreated || date,
  };
}

export const openCredits = (record) =>
  (record?.credits || []).filter((c) => OPEN_CREDIT_STATUSES.includes(c.status));

const euros = (v) => Number(v).toFixed(2).replace('.', ',') + ' €';

// Applique une action du circuit (b.action = credit-request / credit-decision / credit-issue /
// credit-cancel) au dossier `r`, en place. Utilisé par l'API et par le mode démonstration.
// Renvoie { message } en cas de succès, ou { error, status } (code HTTP) en cas de refus.
/** @param {import('./types').CreditSettingsData} [settings] */
export function applyCreditAction(r, b, member, settings = DEFAULT_CREDIT_SETTINGS, now, today) {
  r.credits = r.credits || [];
  const by = { by: member.email, byName: member.name, at: now };
  const log = (text) =>
    (r.history = [...(r.history || []), { date: now, text, author: member.name }]);
  const fail = (error, status = 400) => ({ error, status });

  if (b.action === 'credit-request') {
    const q = b.request || {};
    const problem = checkCreditRequest(q, r, settings);
    if (problem) return fail(problem);
    if (r.credits.length >= 20) return fail('Trop de demandes d’avoir sur ce dossier.');
    const amount = Math.round(Number(q.amount) * 100) / 100;
    const credit = {
      id: b.newId,
      status: needsManager(q.family, amount, settings) ? 'manager' : 'requested',
      family: q.family,
      reason: q.reason,
      kind: q.kind,
      imputation: q.imputation,
      amount,
      comment: String(q.comment || '')
        .trim()
        .slice(0, 2000),
      requestedBy: member.email,
      requestedByName: member.name,
      requestedAt: now,
      statusAt: now,
    };
    r.credits.push(credit);
    log(
      'Demande d’avoir : ' +
        euros(amount) +
        ' · ' +
        CREDIT_FAMILIES[q.family] +
        ' · ' +
        q.reason +
        (credit.status === 'manager' ? ' (validation admin requise)' : ''),
    );
    return { message: 'Demande d’avoir envoyée' };
  }

  const credit = r.credits.find((c) => c.id === b.creditId);
  if (!credit) return fail('Demande d’avoir introuvable.', 404);
  const can = creditPermissions(credit, member);

  if (b.action === 'credit-decision') {
    const comment = String(b.comment || '')
      .trim()
      .slice(0, 2000);
    if (b.decision === 'refuse') {
      if (!can.refuse) return fail('Vous ne pouvez pas refuser cette demande.', 403);
      if (!comment) return fail('Indiquez le motif du refus.');
      Object.assign(credit, { status: 'refused', statusAt: now, decision: { ...by, comment } });
      log('Avoir refusé : ' + comment);
      return { message: 'Demande refusée' };
    }
    if (b.decision !== 'accept') return fail('Décision inconnue.');
    if (!can.decide) return fail('Vous ne pouvez pas valider cette demande.', 403);
    const raw =
      b.amount === undefined || b.amount === null || b.amount === ''
        ? credit.amount
        : Number(b.amount);
    if (!Number.isFinite(raw) || raw <= 0) return fail('Montant accordé invalide.');
    const amount = Math.round(raw * 100) / 100;
    // Montant au-delà du seuil : un admin doit valider
    if (member.role !== 'Admin' && needsManager(credit.family, amount, settings)) {
      Object.assign(credit, {
        status: 'manager',
        statusAt: now,
        approvedAmount: amount,
        review: { ...by, comment },
      });
      log('Avoir transmis pour validation admin (' + euros(amount) + ')');
      return { message: 'Demande transmise à un admin' };
    }
    Object.assign(credit, {
      status: 'accepted',
      statusAt: now,
      approvedAmount: amount,
      decision: { ...by, comment },
    });
    log('Avoir accepté : ' + euros(amount) + (comment ? ' · ' + comment : ''));
    return { message: 'Demande acceptée' };
  }

  if (b.action === 'credit-issue') {
    if (!can.issue) return fail('Seul le service litige peut enregistrer l’avoir émis.', 403);
    const number = String(b.number || '')
      .trim()
      .slice(0, 60);
    if (!number) return fail('Indiquez le numéro d’avoir de l’ERP.');
    const date = String(b.date || '').slice(0, 10) || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date + 'T00:00:00Z')))
      return fail('Date d’émission invalide.');
    const amount = credit.approvedAmount ?? credit.amount;
    Object.assign(credit, { status: 'issued', statusAt: now, issue: { ...by, number, date } });
    Object.assign(r, applyIssuedCredit(r, amount, number, date));
    // Prévient la personne à qui le dossier est attribué (app/alerts.mjs)
    r.creditIssuedAt = now;
    log('Avoir émis dans l’ERP : n° ' + number + ' · ' + euros(amount));
    return { message: 'Avoir enregistré' };
  }

  if (b.action === 'credit-cancel') {
    if (!can.cancel) return fail('Vous ne pouvez pas annuler cette demande.', 403);
    Object.assign(credit, { status: 'cancelled', statusAt: now, cancel: by });
    log('Demande d’avoir annulée');
    return { message: 'Demande annulée' };
  }
  return fail('Action inconnue');
}
