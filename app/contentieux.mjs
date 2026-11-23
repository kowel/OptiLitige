// Espace Contentieux (responsables) : les recours formels des clients (PayPal, opposition
// bancaire, médiation, courrier recommandé, Signal Conso / DGCCRF), suivis à part des dossiers
// litiges. Chaque contentieux peut être relié au dossier litige de la même commande.
// Partagé par l'API (actions « contentieux-… ») et la démonstration.
// Listes reprises du fichier « Contentieux 2026 » de l'encadrement RC (onglets Lexique et Feuil2).

/**
 * Types de contentieux, du moins au plus risqué (lexique) : niveau de risque, gravité et délai
 * légal de réponse en jours. Pour une fourchette (10-15 j, 15-30 j), la borne basse est retenue.
 */
export const CONTENTIEUX_KINDS = [
  { id: 'Opposition bancaire', risk: 1, gravity: 'Faible', days: 10 },
  { id: 'Demande PayPal', risk: 2, gravity: 'Modéré', days: 14 },
  { id: 'Réclamation PayPal', risk: 3, gravity: 'Modéré-Élevé', days: 10 },
  { id: 'Médiation', risk: 4, gravity: 'Élevé', days: 21 },
  { id: 'Courrier recommandé', risk: 5, gravity: 'Très élevé', days: 15 },
  { id: 'Signal Conso (DGCCRF)', risk: 6, gravity: 'Très élevé', days: 30 },
];
/** Gravité affichée selon le niveau de risque (lexique) */
export const GRAVITY = [
  '',
  'Faible',
  'Modéré',
  'Modéré-Élevé',
  'Élevé',
  'Très élevé',
  'Très élevé',
];
/** Type de contentieux d'après les listes réglées (Paramètres → Contentieux), avec sa gravité */
export function kindOf(id, settings) {
  const k = (settings || DEFAULT_CONTENTIEUX_SETTINGS).kinds.find((x) => x.id === id);
  return k ? { ...k, gravity: GRAVITY[k.risk] || '' } : null;
}
/** Sous-sujets d'un sujet */
export const subsOf = (subject, settings) =>
  (settings || DEFAULT_CONTENTIEUX_SETTINGS).subjects.find((s) => s.name === subject)?.subs || [];

/** Sujet interne du contentieux et ses sous-sujets (le sous-sujet dépend du sujet) */
export const CONTENTIEUX_SUBJECTS = {
  'SAV PC': [
    'Délai SAV trop long',
    'Litige diagnostic (client conteste)',
    'PC reçu non conforme (mauvais modèle/config)',
    'Refus de prise en charge (hors garantie)',
    'Panne au déballage',
    'Refus de prise en charge : garantie légale de conformité',
  ],
  'SAV pièce détachée': [
    'Pièce défectueuse à réception',
    'Pièce défectueuse après réparation',
    'Mauvaise référence renvoyée',
    'Refus de prise en charge : pièce endommagée à réception',
    'Refus de prise en charge : produit incomplet (câbles/vis/accessoires)',
    'Refus de garantie',
    'Test OK chez nous - retour client contesté',
    'Demande remboursement',
    'Demande échange',
    'Délai SAV trop long',
    'Refus de prise en charge : garantie légale de conformité',
  ],
  Transporteur: [
    'Colis perdu',
    'Colis livré non reçu',
    'Colis livré à mauvaise adresse',
    'Colis endommagé',
    'Colis ouvert / vol présumé',
    'Retard de livraison important',
    'Suivi bloqué / tracking incohérent',
    'Avis de passage non effectué',
    'Point relais incorrect / indisponible',
    'Retour transporteur injustifié',
    'Litige preuve de livraison (signature/photo)',
  ],
  'Litige VPC interne': [
    'Erreur préparation commande',
    'Produit manquant dans le colis',
    'Mauvais produit envoyé',
    'Mauvaise quantité envoyée',
    'Annulation non prise en compte',
    'Commande expédiée malgré annulation',
    'Problème facturation',
    'Remboursement retardé / oublié',
    'Avoir non émis / non utilisé',
    'Mauvaise information donnée au client',
    'Doublon de commande/paiement',
    'Geste commercial contesté',
  ],
  'Commande BAD': ['Annulation cde BAD'],
  'Site web': [
    'Erreur prix affiché',
    'Promo non appliquée',
    'Code promo invalide / bug',
    'Paiement impossible / bug checkout',
    'Panier qui se vide / erreur panier',
    'Compte client inaccessible',
    'Erreur de stock affiché',
    'Problème choix livraison / relais',
    'Commande validée non enregistrée',
    'Mail confirmation non reçu',
    'Fiche produit erronée',
    'Bug espace client / suivi commande',
  ],
  Rétractation: [
    'Demande hors délai',
    'Retour non reçu / perdu',
    'Retour incomplet',
    'Produit retourné endommagé',
    'Rétractation refusée (produit exclu)',
    'Frais de retour contestés',
    'Remboursement retardé / hors délai',
    'Remboursement partiel contesté (décote)',
    'Rétractation + échange demandé',
    'Litige sur état du produit au retour',
  ],
};

/** Décisions prises (reprises des décisions déjà notées dans le fichier) */
export const CONTENTIEUX_DECISIONS = [
  'Non avérée - refusé',
  'Maintien du refus',
  'Remboursement',
  'Remboursement + majoration',
  'Remboursement frais de port',
  'Avoir',
  'Échange',
  'Renvoi produit',
  'Réparation',
  'Prise en charge SAV',
  'Solco',
  'Rectification site',
];

/**
 * Listes de l'espace Contentieux réglables par les responsables (Paramètres → Contentieux) :
 * types (niveau de risque 1 à 6, délai légal en jours), sujets et leurs sous-sujets, décisions.
 */
export const DEFAULT_CONTENTIEUX_SETTINGS = {
  kinds: CONTENTIEUX_KINDS.map(({ id, risk, days }) => ({ id, risk, days })),
  subjects: Object.entries(CONTENTIEUX_SUBJECTS).map(([name, subs]) => ({ name, subs })),
  decisions: CONTENTIEUX_DECISIONS,
};

/** À traiter → Répondu (réponse envoyée dans le délai légal) → Clos */
export const CONTENTIEUX_STATUSES = ['À traiter', 'Répondu', 'Clos'];

// [clé, libellé, nature] des champs saisis ; nature : text (longueur max), amount, date, list
const FIELDS = [
  ['receivedAt', 'Date de réception', 'date'],
  ['kind', 'Type de contentieux', 'kind'],
  ['status', 'Statut', 'status'],
  ['brand', 'Enseigne', 120],
  ['customerAccount', 'Client (n° de compte)', 60],
  ['order', 'N° de commande', 100],
  ['productRef', 'Réf. produit', 200],
  ['amount', 'Montant concerné', 'amount'],
  ['subject', 'Sujet', 'subject'],
  ['subSubject', 'Sous-sujet', 'subSubject'],
  ['decision', 'Décision', 'decision'],
  ['refund', 'Montant remboursé / avoir', 'amount'],
  ['surcharge', 'Montant majoration', 'amount'],
  ['fees', 'Montant frais', 'amount'],
  ['returnedProductRef', 'Réf. produit renvoyé', 200],
  ['priceGap', 'Écart de prix', 'signed'],
  ['customerMessage', 'Message client', 20000],
  ['customerReply', 'Réponse apportée au client', 20000],
  ['comment', 'Commentaire', 5000],
];
export const CONTENTIEUX_FIELDS = FIELDS;

const validDay = (d) => {
  const t = new Date(d + 'T00:00:00.000Z');
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    !Number.isNaN(t.getTime()) &&
    t.toISOString().slice(0, 10) === d
  );
};
const frDay = (d) => (d ? String(d).split('-').reverse().join('/') : '');
const euros = (v) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(v) || 0);

/**
 * Vérifie et nettoie un contentieux saisi.
 * @param {Record<string, unknown>} input champs saisis
 * @param {string} today date du jour (AAAA-MM-JJ, heure de Paris)
 * @param {any} [settings] listes réglées (Paramètres → Contentieux)
 * @param {any} [current] contentieux modifié : ses valeurs retirées depuis des listes restent acceptées
 * @returns {{ error?: string, values?: Record<string, string | number | null> }}
 */
export function checkContentieux(input, today, settings, current) {
  const x = input || {};
  const values = {};
  const cfg = settings || DEFAULT_CONTENTIEUX_SETTINGS;
  const kept = (key, s) => !!current && s === current[key];
  for (const [key, label, kind] of FIELDS) {
    const raw = x[key];
    const s = String(raw ?? '').trim();
    if (kind === 'date') {
      if (!validDay(s)) return { error: 'Indiquez la date de réception du contentieux.' };
      if (today && s > today)
        return { error: 'La date de réception ne peut pas être dans le futur.' };
      values[key] = s;
    } else if (kind === 'kind') {
      const k = kindOf(s, cfg);
      if (!k && !(s && kept('kind', s))) return { error: 'Choisissez le type de contentieux.' };
      values[key] = s;
      // Délai légal et niveau de risque retenus à l'enregistrement : un délai changé ensuite dans
      // les Paramètres ne déplace pas la date limite d'un contentieux déjà reçu
      values.legalDays =
        k && !(current && s === current.kind && current.legalDays)
          ? k.days
          : (current?.legalDays ?? null);
      values.risk = k ? k.risk : (current?.risk ?? null);
    } else if (kind === 'status') {
      values[key] = CONTENTIEUX_STATUSES.includes(s) ? s : 'À traiter';
    } else if (kind === 'subject') {
      if (s && !cfg.subjects.some((x) => x.name === s) && !kept('subject', s))
        return { error: 'Sujet inconnu.' };
      values[key] = s;
    } else if (kind === 'subSubject') {
      const ok =
        subsOf(values.subject, cfg).includes(s) ||
        (kept('subSubject', s) && values.subject === current.subject);
      if (s && !ok)
        return { error: 'Choisissez un sous-sujet du sujet « ' + values.subject + ' ».' };
      values[key] = values.subject ? s : '';
    } else if (kind === 'decision') {
      if (s && !cfg.decisions.includes(s) && !kept('decision', s))
        return { error: 'Décision inconnue.' };
      values[key] = s;
    } else if (kind === 'amount' || kind === 'signed') {
      if (!s) {
        values[key] = null;
        continue;
      }
      const n = Number(s.replace(/\s/g, '').replace(',', '.'));
      if (!Number.isFinite(n) || Math.abs(n) > 10_000_000 || (kind === 'amount' && n < 0))
        return { error: label + ' invalide.' };
      values[key] = Math.round(n * 100) / 100;
    } else {
      if (s.length > kind) return { error: label + ' : ' + kind + ' caractères au maximum.' };
      values[key] = s;
    }
  }
  if (!values.customerAccount && !values.order)
    return { error: 'Indiquez au moins le n° de compte client ou le n° de commande.' };
  if (values.status === 'Clos' && !values.decision)
    return { error: 'Indiquez la décision prise avant de clore le contentieux.' };
  return { values };
}

/** Délai légal d'un contentieux : celui retenu à l'enregistrement, sinon celui de son type */
export const legalDaysOf = (c, settings) =>
  Number(c?.legalDays) || kindOf(c?.kind, settings)?.days || 0;

/** Date limite de réponse : date de réception + délai légal du type */
export function dueDate(c, settings) {
  const days = legalDaysOf(c, settings);
  if (!days || !validDay(String(c?.receivedAt || ''))) return '';
  const t = new Date(c.receivedAt + 'T00:00:00.000Z');
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/**
 * Échéance d'un contentieux à traiter : jours restants avant la date limite (négatif = dépassée).
 * null une fois répondu ou clos.
 */
export function daysLeft(c, today, settings) {
  if (c?.status && c.status !== 'À traiter') return null;
  const due = dueDate(c, settings);
  if (!due || !today) return null;
  return Math.round(
    (new Date(due + 'T00:00:00.000Z').getTime() - new Date(today + 'T00:00:00.000Z').getTime()) /
      86400000,
  );
}

/** Coût du contentieux : remboursé / avoir + majoration + frais */
export const costOf = (c) =>
  Math.round(
    ((Number(c?.refund) || 0) + (Number(c?.surcharge) || 0) + (Number(c?.fees) || 0)) * 100,
  ) / 100;

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Indemnisation transporteur du dossier litige relié (champ « Indemnisation » du traitement,
 * celui des statistiques transporteurs). 0 sans dossier relié.
 */
export function compensationOf(c, records) {
  if (!c?.dossierId) return 0;
  const r = (records || []).find((x) => x.id === c.dossierId);
  return Number(r?.compensation) || 0;
}

/**
 * Ce que le contentieux a réellement coûté : remboursé / avoir + majoration + frais, moins
 * l'indemnisation obtenue du transporteur sur le dossier litige relié (jamais en dessous de 0).
 * @returns {{ cost: number, compensation: number, deducted: number, loss: number }}
 */
export function lossOf(c, records) {
  const cost = costOf(c);
  const compensation = compensationOf(c, records);
  const deducted = round2(Math.min(compensation, cost));
  return { cost, compensation, deducted, loss: round2(cost - deducted) };
}

// Textes longs : l'historique indique seulement qu'ils ont été modifiés
const LONG_TEXT = ['customerMessage', 'customerReply', 'comment'];
const shown = (key, v) => {
  if (v === null || v === undefined || String(v).trim() === '') return '(vide)';
  if (['amount', 'refund', 'surcharge', 'fees', 'priceGap'].includes(key)) return euros(v);
  if (key === 'receivedAt') return frDay(v);
  if (LONG_TEXT.includes(key)) return '…';
  return String(v);
};

/** Changements entre deux versions, pour l'historique (« Statut : À traiter → Répondu ») */
export function contentieuxChanges(before, after) {
  const out = [];
  for (const [key, label] of FIELDS) {
    const a = before?.[key] ?? '';
    const b = after?.[key] ?? '';
    if (String(a) === String(b)) continue;
    out.push(
      label + ' : ' + shown(key, a) + ' → ' + (LONG_TEXT.includes(key) ? 'modifié' : shown(key, b)),
    );
  }
  return out;
}

/** N° de commande comparable : sans espaces ni préfixe « CMD », en majuscules */
export const orderKey = (s) =>
  String(s ?? '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^(CDE|CMD)[-_:]?/, '');

/**
 * Dossiers litiges de la même commande, à proposer en liaison : ni déjà reliés, ni refusés.
 * @template {{ id: string, order?: string }} T
 * @param {{ order?: string, dossierId?: string, declined?: string[] }} c
 * @param {T[]} records
 * @returns {T[]}
 */
export function matchingDossiers(c, records) {
  const key = orderKey(c?.order);
  if (!key || c?.dossierId) return [];
  const declined = new Set(c?.declined || []);
  return (records || []).filter((r) => orderKey(r.order) === key && !declined.has(r.id));
}

/** N° de compte client comparable (sans espaces, zéros de tête ignorés) */
export const accountKey = (s) =>
  String(s ?? '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/^0+(?=.)/, '');

/**
 * Autres contentieux du même client (même n° de compte, ou même commande si le compte manque),
 * du plus récent au plus ancien. `same` : ceux du même type sur la même commande (doublon
 * probable ou nouveau recours sur le même problème).
 * @template {{ id: string, customerAccount?: string, order?: string, kind?: string, receivedAt?: string }} T
 * @param {{ id?: string, customerAccount?: string, order?: string, kind?: string }} c
 * @param {T[]} list
 * @returns {{ others: T[], same: T[] }}
 */
export function sameCustomer(c, list) {
  const acc = accountKey(c?.customerAccount);
  const ord = orderKey(c?.order);
  if (!acc && !ord) return { others: [], same: [] };
  const others = (list || [])
    .filter((x) => x.id !== c?.id)
    .filter((x) => (acc ? accountKey(x.customerAccount) === acc : ord && orderKey(x.order) === ord))
    .sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
  const same = others.filter((x) => x.kind === c?.kind && ord && orderKey(x.order) === ord);
  return { others, same };
}

/** Nombre de contentieux par client (n° de compte), pour repérer les clients récidivistes */
export function countByCustomer(list) {
  const m = new Map();
  for (const c of list || []) {
    const k = accountKey(c.customerAccount);
    if (k) m.set(k, (m.get(k) || 0) + 1);
  }
  return (c) => m.get(accountKey(c?.customerAccount)) || 0;
}

/** Résumé d'un contentieux pour le dossier relié : « Médiation · reçu le 12/11/2026 · Répondu » */
export const contentieuxSummary = (c) =>
  [c.kind, 'reçu le ' + frDay(c.receivedAt), c.status, c.decision].filter(Boolean).join(' · ');

const CONFLICT = {
  error: 'Un autre admin a modifié ce contentieux. Actualisez avant de réessayer.',
  status: 409,
};

/**
 * Applique une action de l'espace Contentieux (serveur et démonstration).
 *  - contentieux-save : création (current null) ou modification ; dossierId à la création
 *    = contentieux ouvert depuis un dossier litige, relié d'office
 *  - contentieux-link / contentieux-decline : liaison au dossier litige proposé, acceptée ou refusée
 *  - contentieux-unlink : liaison retirée (le dossier n'est plus proposé ensuite)
 * @param {any} current contentieux actuel, ou null
 * @param {any} b action reçue
 * @param {{ now: string, today: string, author: string, newId: string, dossier?: { id: string, ref: string } | null, settings?: any }} ctx
 * @returns {{ error?: string, status?: number, item?: any, unchanged?: boolean, message?: string }}
 */
export function applyContentieuxAction(current, b, ctx) {
  const log = (item, text) => item.history.push({ date: ctx.now, text, author: ctx.author });
  if (b.action === 'contentieux-save') {
    const { error, values } = checkContentieux(b.contentieux, ctx.today, ctx.settings, current);
    if (error) return { error, status: 400 };
    if (!current) {
      const item = {
        id: ctx.newId,
        ref: 'CT-' + ctx.now.slice(0, 4) + '-' + ctx.newId.slice(0, 6).toUpperCase(),
        version: 1,
        ...values,
        // Dossiers proposés et refusés pendant la saisie
        declined: Array.isArray(b.declined)
          ? [...new Set(b.declined.map(String))].slice(0, 50)
          : [],
        createdAt: ctx.now,
        createdBy: ctx.author,
        history: [],
      };
      log(item, 'Contentieux enregistré');
      if (ctx.dossier) {
        item.dossierId = ctx.dossier.id;
        item.dossierRef = ctx.dossier.ref;
        log(item, 'Relié au dossier litige ' + ctx.dossier.ref);
      }
      return { item, message: 'Contentieux enregistré' };
    }
    if (Number(b.version) !== current.version) return CONFLICT;
    const changes = contentieuxChanges(current, values);
    if (!changes.length) return { item: current, unchanged: true, message: 'Aucune modification' };
    const item = { ...structuredClone(current), ...values, version: current.version + 1 };
    log(item, 'Modifié : ' + changes.join(' ; '));
    return { item, message: 'Contentieux enregistré' };
  }
  if (!current) return { error: 'Contentieux introuvable.', status: 404 };
  if (b.version !== undefined && Number(b.version) !== current.version) return CONFLICT;
  const item = {
    ...structuredClone(current),
    version: current.version + 1,
    declined: [...(current.declined || [])],
  };
  if (b.action === 'contentieux-link') {
    if (!ctx.dossier) return { error: 'Dossier litige introuvable.', status: 404 };
    item.dossierId = ctx.dossier.id;
    item.dossierRef = ctx.dossier.ref;
    item.declined = item.declined.filter((x) => x !== ctx.dossier.id);
    log(item, 'Relié au dossier litige ' + ctx.dossier.ref);
    return { item, message: 'Contentieux relié au dossier ' + ctx.dossier.ref };
  }
  if (b.action === 'contentieux-decline') {
    const id = String(b.dossierId || '');
    if (!id) return { error: 'Dossier litige manquant.', status: 400 };
    if (!item.declined.includes(id)) item.declined.push(id);
    log(item, 'Liaison au dossier litige ' + (ctx.dossier?.ref || id) + ' refusée');
    return { item, message: 'Liaison refusée : ce dossier ne sera plus proposé' };
  }
  if (b.action === 'contentieux-unlink') {
    if (!item.dossierId)
      return { error: 'Ce contentieux n’est relié à aucun dossier.', status: 400 };
    log(item, 'Liaison au dossier litige ' + item.dossierRef + ' retirée');
    if (!item.declined.includes(item.dossierId)) item.declined.push(item.dossierId);
    delete item.dossierId;
    delete item.dossierRef;
    return { item, message: 'Liaison retirée' };
  }
  return { error: 'Action inconnue.', status: 400 };
}

/** Chiffres de l'en-tête de l'espace */
export function contentieuxStats(list, today, settings, records) {
  const open = list.filter((c) => c.status === 'À traiter');
  const left = open.map((c) => daysLeft(c, today, settings)).filter((d) => d !== null);
  const cost = list.reduce((s, c) => s + costOf(c), 0);
  // Indemnisation d'un dossier relié à plusieurs contentieux : déduite une seule fois
  const byDossier = new Map();
  for (const c of list) {
    if (!c.dossierId) continue;
    byDossier.set(c.dossierId, (byDossier.get(c.dossierId) || 0) + costOf(c));
  }
  let deducted = 0;
  for (const [id, linkedCost] of byDossier) {
    const r = (records || []).find((x) => x.id === id);
    deducted += Math.min(Number(r?.compensation) || 0, linkedCost);
  }
  return {
    total: list.length,
    open: open.length,
    late: left.filter((d) => d < 0).length,
    soon: left.filter((d) => d >= 0 && d <= 3).length,
    refund: list.reduce((s, c) => s + (Number(c.refund) || 0), 0),
    extra: list.reduce((s, c) => s + (Number(c.surcharge) || 0) + (Number(c.fees) || 0), 0),
    cost: round2(cost),
    deducted: round2(deducted),
    loss: round2(cost - deducted),
  };
}

/** Lignes de l'export CSV (même colonnes que le fichier Excel, plus la référence et le lien) */
export function contentieuxRows(list, settings, records) {
  const headers = [
    'Référence',
    'Date de réception',
    'Type de contentieux',
    'Niveau de risque',
    'Délai légal de réponse',
    'Date limite de réponse',
    'Enseigne',
    'Client',
    'N° CDE',
    'Réf produit',
    'Montant concerné',
    'Statut',
    'Sujet',
    'Sous sujet',
    'Décision',
    'Montant remboursé / avoir',
    'Montant majoration',
    'Montant frais',
    'Réf produit renvoyé',
    'Écart de prix',
    'Message client',
    'Réponse apportée au client',
    'Commentaire',
    'Dossier litige relié',
    'Coût du contentieux',
    'Indemnisation transporteur déduite',
    'Perte réelle',
  ];
  const rows = list.map((c) => {
    const k = kindOf(c.kind, settings);
    const l = lossOf(c, records);
    return [
      c.ref,
      c.receivedAt,
      c.kind,
      k?.risk ?? c.risk ?? '',
      legalDaysOf(c, settings) ? legalDaysOf(c, settings) + ' jours' : '',
      dueDate(c, settings),
      c.brand,
      c.customerAccount,
      c.order,
      c.productRef,
      c.amount,
      c.status,
      c.subject,
      c.subSubject,
      c.decision,
      c.refund,
      c.surcharge,
      c.fees,
      c.returnedProductRef,
      c.priceGap,
      c.customerMessage || '',
      c.customerReply || '',
      c.comment,
      c.dossierRef || '',
      l.cost,
      l.deducted,
      l.loss,
    ];
  });
  return { headers, rows };
}

/**
 * Vérifie les listes réglées dans Paramètres → Contentieux.
 * @param {any} input { kinds: [{ id, risk, days }], subjects: [{ name, subs }], decisions }
 * @returns {{ error?: string, settings?: typeof DEFAULT_CONTENTIEUX_SETTINGS }}
 */
export function normalizeContentieuxSettings(input) {
  const text = (v, max) =>
    String(v ?? '')
      .trim()
      .slice(0, max);
  const unique = (list) => new Set(list.map((x) => x.toLowerCase())).size === list.length;
  const kinds = (Array.isArray(input?.kinds) ? input.kinds : []).slice(0, 30).map((k) => ({
    id: text(k?.id, 80),
    risk: Math.round(Number(k?.risk)),
    days: Math.round(Number(k?.days)),
  }));
  if (!kinds.length) return { error: 'Gardez au moins un type de contentieux.' };
  for (const k of kinds) {
    if (!k.id) return { error: 'Chaque type de contentieux doit avoir un nom.' };
    if (!(k.risk >= 1 && k.risk <= 6))
      return { error: 'Niveau de risque de « ' + k.id + ' » : de 1 à 6.' };
    if (!(k.days >= 1 && k.days <= 365))
      return { error: 'Délai légal de « ' + k.id + ' » : de 1 à 365 jours.' };
  }
  if (!unique(kinds.map((k) => k.id)))
    return { error: 'Deux types de contentieux ont le même nom.' };
  const subjects = (Array.isArray(input?.subjects) ? input.subjects : []).slice(0, 50).map((s) => ({
    name: text(s?.name, 80),
    subs: (Array.isArray(s?.subs) ? s.subs : [])
      .map((x) => text(x, 150))
      .filter(Boolean)
      .slice(0, 80),
  }));
  if (subjects.some((s) => !s.name)) return { error: 'Chaque sujet doit avoir un nom.' };
  if (!unique(subjects.map((s) => s.name))) return { error: 'Deux sujets ont le même nom.' };
  const twice = subjects.find((s) => !unique(s.subs));
  if (twice) return { error: 'Deux sous-sujets identiques dans « ' + twice.name + ' ».' };
  const decisions = (Array.isArray(input?.decisions) ? input.decisions : [])
    .map((x) => text(x, 120))
    .filter(Boolean)
    .slice(0, 80);
  if (!unique(decisions)) return { error: 'Deux décisions ont le même nom.' };
  return { settings: { kinds, subjects, decisions } };
}

const RENAME_LABELS = {
  kind: 'Type de contentieux',
  subject: 'Sujet',
  subSubject: 'Sous-sujet',
  decision: 'Décision',
};
/**
 * Renommages faits dans les Paramètres, appliqués aux contentieux existants.
 * @param {any[]} list contentieux
 * @param {{ field: string, from: string, to: string, subject?: string }[]} renames
 *   (subject : sujet du sous-sujet renommé)
 * @param {{ now: string, author: string }} ctx
 * @returns {any[]} contentieux modifiés (version + 1, ligne d'historique)
 */
export function applyContentieuxRenames(list, renames, ctx) {
  const valid = (Array.isArray(renames) ? renames : []).filter(
    (r) => RENAME_LABELS[r?.field] && r.from && r.to && r.from !== r.to,
  );
  const changed = [];
  for (const c of list || []) {
    const notes = [];
    const next = { ...c };
    for (const r of valid) {
      if (next[r.field] !== r.from) continue;
      if (r.field === 'subSubject' && next.subject !== r.subject) continue;
      next[r.field] = r.to;
      notes.push(RENAME_LABELS[r.field] + ' : ' + r.from + ' → ' + r.to);
    }
    if (!notes.length) continue;
    next.version = (c.version || 1) + 1;
    next.history = [
      ...(c.history || []),
      {
        date: ctx.now,
        text: 'Renommé dans les Paramètres : ' + notes.join(' ; '),
        author: ctx.author,
      },
    ];
    changed.push(next);
  }
  return changed;
}

/** Couleur de chaque type dans les graphiques (même ordre que les pastilles de la liste) */
export const KIND_COLORS = [
  '#1f9e82',
  '#3a7fd1',
  '#6a55d8',
  '#d9930f',
  '#e0662a',
  '#d6455a',
  '#3f9a3b',
  '#7a7f93',
];
export const kindColor = (kind, settings) => {
  const i = (settings || DEFAULT_CONTENTIEUX_SETTINGS).kinds.findIndex((k) => k.id === kind);
  return KIND_COLORS[i < 0 ? 7 : i % 8];
};

const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

/**
 * Tableau de bord des contentieux (Analyses contentieux, responsables) : volumes par type, sujet,
 * sous-sujet, enseigne et décision, montants et perte réelle par type, évolution par mois
 * (12 derniers mois) et par année.
 * @param {any[]} list contentieux retenus (période et filtres déjà appliqués)
 * @param {any[]} records dossiers litiges (indemnisation des dossiers reliés)
 * @param {any} [settings] listes réglées
 * @param {string} today date du jour (AAAA-MM-JJ)
 */
export function contentieuxDashboard(list, records, settings, today) {
  const cfg = settings || DEFAULT_CONTENTIEUX_SETTINGS;
  const count = (pick, color) => {
    const m = new Map();
    for (const c of list) {
      const k = String(pick(c) || '').trim() || 'Non renseigné';
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m]
      .map(([label, value]) => ({ label, value, ...(color ? { color: color(label) } : {}) }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'fr'));
  };
  const stats = contentieuxStats(list, today, cfg, records);
  // Par type : nombre, montants, perte réelle
  const kinds = [...new Set([...cfg.kinds.map((k) => k.id), ...list.map((c) => c.kind)])];
  const byKindMoney = kinds
    .map((kind) => {
      const of = list.filter((c) => c.kind === kind);
      const sum = (f) => round2(of.reduce((s, c) => s + (Number(c[f]) || 0), 0));
      return {
        kind,
        color: kindColor(kind, cfg),
        count: of.length,
        refund: sum('refund'),
        surcharge: sum('surcharge'),
        fees: sum('fees'),
        priceGap: sum('priceGap'),
        cost: round2(of.reduce((s, c) => s + costOf(c), 0)),
        loss: contentieuxStats(of, today, cfg, records).loss,
      };
    })
    .filter((r) => r.count);
  // 12 derniers mois (date de réception), par type
  const months = [];
  const [y, m] = String(today).split('-').map(Number);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    months.push({
      key,
      label:
        MONTHS[d.getUTCMonth()] +
        (d.getUTCMonth() === 0 || i === 11 ? ' ' + d.getUTCFullYear() : ''),
      byKind: /** @type {Record<string, number>} */ ({}),
      total: 0,
    });
  }
  for (const c of list) {
    const month = months.find((x) => x.key === String(c.receivedAt).slice(0, 7));
    if (!month) continue;
    month.byKind[c.kind] = (month.byKind[c.kind] || 0) + 1;
    month.total++;
  }
  // Par année et par type (comparatif annuel)
  const years = [...new Set(list.map((c) => String(c.receivedAt).slice(0, 4)).filter(Boolean))]
    .sort()
    .reverse();
  const byYear = kinds
    .map((kind) => ({
      kind,
      color: kindColor(kind, cfg),
      years: Object.fromEntries(
        years.map((yr) => [
          yr,
          list.filter((c) => c.kind === kind && String(c.receivedAt).startsWith(yr)).length,
        ]),
      ),
    }))
    .filter((r) => years.some((yr) => r.years[yr]));
  return {
    ...stats,
    priceGap: round2(list.reduce((s, c) => s + (Number(c.priceGap) || 0), 0)),
    byKind: count(
      (c) => c.kind,
      (label) => kindColor(label, cfg),
    ),
    bySubject: count((c) => c.subject),
    bySubSubject: count(
      (c) => (c.subject ? c.subject + ' › ' : '') + (c.subSubject || 'Non renseigné'),
    )
      .filter((r) => !r.label.endsWith('Non renseigné'))
      .slice(0, 10),
    byBrand: count((c) => c.brand),
    byDecision: count((c) => c.decision),
    byStatus: count((c) => c.status),
    byKindMoney,
    months,
    years,
    byYear,
    linked: list.filter((c) => c.dossierId).length,
  };
}

// --- Rapport PDF des contentieux (Analyses contentieux → Rapport (PDF)) -------------------
// Même présentation que le rapport des litiges (app/report-view.tsx, app/report-pdf.mjs) :
// une période (mois ou dates) comparée à la précédente, 9 indicateurs et 4 classements.

/** Chiffres des contentieux reçus pendant la période p ({ from, to exclu }) */
export function contentieuxPeriodFigures(list, records, p, settings, today) {
  const of = list.filter((c) => {
    const d = String(c.receivedAt || '');
    return d >= p.from && d < p.to;
  });
  const stats = contentieuxStats(of, today, settings, records);
  const rank = (pick, n = 8) => {
    const m = new Map();
    for (const c of of) {
      const k = String(pick(c) || '').trim();
      if (k) m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')).slice(0, n);
  };
  const treated = of.filter((c) => c.status !== 'À traiter').length;
  return {
    received: of.length,
    highRisk: of.filter((c) => (kindOf(c.kind, settings)?.risk ?? c.risk ?? 0) >= 4).length,
    treatedRate: of.length ? Math.round((treated / of.length) * 100) : 0,
    late: stats.late,
    cost: stats.cost,
    refund: round2(stats.refund),
    extra: round2(stats.extra),
    deducted: stats.deducted,
    loss: stats.loss,
    byKind: rank((c) => c.kind),
    bySubject: rank((c) => c.subject),
    bySubSubject: rank((c) => (c.subSubject ? c.subSubject : ''), 8),
    byDecision: rank((c) => c.decision),
  };
}

/**
 * Rapport des contentieux d'une période comparée à la précédente.
 * @param {any[]} list contentieux (filtres de l'écran déjà appliqués)
 * @param {any} period période (monthPeriod / rangePeriod de app/reports.mjs)
 * @param {any} previous période précédente (previousPeriod)
 * @param {string[]} filters libellés des filtres choisis
 */
export function contentieuxReport(list, records, period, previous, filters, settings, today) {
  return {
    period,
    previous,
    filters,
    now: contentieuxPeriodFigures(list, records, period, settings, today),
    before: contentieuxPeriodFigures(list, records, previous, settings, today),
  };
}

const eur0 = (n) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n || 0);
// Évolution par rapport à la période précédente (même calcul que les litiges)
function trend(now, before, good, unit = '') {
  const diff = now - before;
  if (!before && !now) return { dir: '', text: '—', tone: '' };
  if (Math.abs(diff) < 0.05) return { dir: '', text: '= stable', tone: '' };
  const better = good === 'up' ? diff > 0 : diff < 0;
  const pct = before && unit !== '%' ? Math.round((diff / before) * 100) : null;
  const text =
    pct !== null
      ? Math.abs(pct) + ' %'
      : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.abs(diff)) +
        (unit === '%' ? ' pts' : '');
  return { dir: diff > 0 ? 'up' : 'down', text, tone: better ? 'better' : 'worse' };
}

/** Les 9 indicateurs du rapport des contentieux */
export function contentieuxReportTiles(data) {
  const n = data.now,
    b = data.before;
  return [
    {
      label: 'Contentieux reçus',
      value: String(n.received),
      delta: trend(n.received, b.received, 'down'),
    },
    {
      label: 'Dont risque élevé (niveau 4 à 6)',
      value: String(n.highRisk),
      delta: trend(n.highRisk, b.highRisk, 'down'),
    },
    {
      label: 'Répondus ou clos',
      value: n.treatedRate + ' %',
      delta: trend(n.treatedRate, b.treatedRate, 'up', '%'),
    },
    {
      label: 'Délai légal dépassé (à traiter)',
      value: String(n.late),
      delta: trend(n.late, b.late, 'down'),
    },
    { label: 'Coût des contentieux', value: eur0(n.cost), delta: trend(n.cost, b.cost, 'down') },
    {
      label: 'Remboursé / avoirs',
      value: eur0(n.refund),
      delta: trend(n.refund, b.refund, 'down'),
    },
    { label: 'Frais et majorations', value: eur0(n.extra), delta: trend(n.extra, b.extra, 'down') },
    {
      label: 'Indemnisations transporteur déduites',
      value: eur0(n.deducted),
      delta: trend(n.deducted, b.deducted, 'up'),
    },
    { label: 'Perte réelle', value: eur0(n.loss), delta: trend(n.loss, b.loss, 'down') },
  ];
}

/** Les 4 classements du rapport des contentieux */
export function contentieuxReportRanks(data) {
  const n = data.now;
  return [
    { title: 'Contentieux par type', rows: n.byKind, total: n.received },
    { title: 'Contentieux par sujet', rows: n.bySubject, total: n.received },
    { title: 'Sous-sujets les plus fréquents', rows: n.bySubSubject, total: n.received },
    { title: 'Décisions prises', rows: n.byDecision, total: n.received },
  ];
}

export const CONTENTIEUX_REPORT_NOTE =
  'Contentieux reçus pendant la période (date de réception). Statut et délai dépassé : état actuel de ces contentieux. Coût = remboursé / avoir + majorations + frais ; perte réelle = coût moins l’indemnisation transporteur des dossiers litiges reliés. Flèches : évolution par rapport à la période précédente (vert = favorable).';
