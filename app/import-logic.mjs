import { followUpText } from './followup.ts';
export const fields = [
  ['carrierCaseRef', 'Référence réclamation transporteur'],
  ['carrierSentAt', 'Transmission au transporteur'],
  ['carrierResponseDue', 'Réponse transporteur attendue'],
  ['carrierReplyAt', 'Réponse transporteur reçue'],
  ['carrierFollowupAt', 'Prochaine relance transporteur'],
  ['clientStage', 'Étape côté client'],
  ['brand', 'Enseigne'],
  ['store', 'Magasin'],
  ['productType', 'Type produit'],
  ['productRef', 'Réf PDT'],
  ['requester', 'Demandeur'],
  ['ticket', 'N° de ticket'],
  ['bt', 'BT'],
  ['outcome', 'Résultat Litige'],
  ['creditNumber', 'N° d’avoir'],
  ['creditCreated', 'Création de l’avoir'],
  ['invoice', 'N° de facture'],
  ['takenAt', 'Prise en charge'],
  ['carrierStatus', 'Statut dossier transporteur'],
  ['rcCheck', 'Check RC'],
  ['rcManager', 'Suivi d’un responsable RC'],
  ['followUp', 'Assurer un suivi'],
  ['solco', 'Solco'],
  ['solution', 'Solution'],
  ['disputeValue', 'Valeur Litige TTC'],
  ['indemTps', 'Indem tps'],
  ['compensationState', 'Indemnisation (état)'],
  ['externalId', 'Identifiant Microsoft Lists'],
  ['title', 'Objet du litige'],
  ['customer', 'Client'],
  ['order', 'Commande'],
  ['amount', 'Montant commande'],
  ['status', 'Statut'],
  ['origin', 'Origine'],
  ['type', 'Type à l’ouverture'],
  ['created', 'Date d’ouverture'],
  ['closed', 'Date de clôture'],
  ['reopened', 'Date(s) de réouverture'],
  ['creditIssued', 'Avoir généré'],
  ['credit', 'Montant avoir'],
  ['compensation', 'Indemnisation transporteur'],
  ['verdict', 'Qualification à la clôture'],
  ['reason', 'Type confirmé / raison de clôture'],
  ['carrier', 'Transporteur'],
  ['assignee', 'Agent (e-mail)'],
  ['description', 'Description'],
  ['notes', 'Commentaires historiques'],
  ['priority', 'Urgence / priorité'],
];
export const normalize = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const aliases = {
  carrierCaseRef: ['referencereclamationtransporteur', 'refreclamationtransporteur'],
  carrierSentAt: ['transmissionautransporteur', 'datetransmissiontransporteur'],
  carrierResponseDue: ['reponsetransporteurattendue'],
  carrierReplyAt: ['reponsetransporteurrecue'],
  carrierFollowupAt: ['prochainerelancetransporteur', 'prochainerelance'],
  clientStage: ['etapecoteclient', 'etapeclient'],
  brand: ['enseigne'],
  store: ['magasin'],
  productType: ['typeproduit', 'typedeproduit', 'typeproduitconcerne'],
  productRef: ['refpdt', 'referenceproduit', 'refproduit'],
  requester: ['demandeur'],
  ticket: ['ndeticket', 'nticket', 'numerodeticket'],
  bt: ['bt'],
  outcome: ['resultatlitige', 'resultatdulitige'],
  creditNumber: ['ndavoir', 'numerodavoir', 'numeroavoir'],
  creditCreated: [
    'creationdelavoir',
    'datecreationavoir',
    'datedemissiondelavoir',
    'dateemissionavoir',
    'creationdelavoirle',
  ],
  invoice: ['ndefacture', 'numerodefacture'],
  takenAt: ['priseencharge', 'datedepriseencharge'],
  carrierStatus: ['statutdossiertransporteur'],
  rcCheck: ['checkrc'],
  rcManager: ['suividunresponsablerc'],
  followUp: ['assurerunsuivi'],
  solco: ['solco'],
  solution: ['solution'],
  disputeValue: ['valeurlitigettc', 'valeurlitige'],
  indemTps: ['indemtps'],
  compensationState: ['indemnisation'],
  externalId: ['id', 'identifiant', 'identifiantmicrosoftlists'],
  title: ['titre', 'title', 'objet', 'objetdulitige', 'nomdulitige'],
  customer: ['client', 'nomclient', 'nomduclient', 'customer'],
  order: [
    'commande',
    'numerocommande',
    'ncommande',
    'ndecde',
    'ncde',
    'referencecommande',
    'order',
  ],
  amount: [
    'montantcommande',
    'montantdelacommande',
    'montantttc',
    'montantcde',
    'montant',
    'valeurcommande',
  ],
  status: ['statut', 'statutclient', 'status', 'etat', 'avancement', 'etape'],
  origin: ['origine', 'originedulitige', 'interneexterne', 'interneoutransport'],
  type: ['type', 'typelitige', 'typedelitige', 'motif', 'motifouverture', 'typealouverture'],
  created: [
    'datedouverture',
    'dateouverture',
    'created',
    'cree',
    'creation',
    'datedecreation',
    'datecreation',
    'datedeclaration',
  ],
  closed: ['datedecloture', 'datecloture', 'cloture', 'datefermeture', 'datederesolution'],
  reopened: [
    'datedereouverture',
    'datereouverture',
    'datedereouverte',
    'datedereouverture',
    'reouverture',
  ],
  creditIssued: ['avoirgenere', 'avoircree', 'avoir'],
  credit: ['montantavoir', 'montantdelavoir'],
  compensation: [
    'valeursindemnisation',
    'valeurindemnisation',
    'indemnisationtransporteur',
    'montantindemnisation',
    'montantindemnise',
  ],
  verdict: [
    'litigeaveree',
    'litigeavere',
    'avere',
    'qualification',
    'conclusion',
    'verdict',
    'qualificationcloture',
  ],
  reason: [
    'motifcloture',
    'raisoncloture',
    'typeresolution',
    'typeconfirme',
    'raison',
    'motifresolution',
  ],
  carrier: ['transporteur', 'carrier'],
  assignee: ['agent', 'assigne', 'assignea', 'gestionnaire', 'charge', 'responsable'],
  description: ['description', 'descriptiondulitige', 'details', 'signalement'],
  notes: ['commentaires', 'commentaire', 'notes', 'historique'],
  priority: ['urgence', 'priorite', 'priority'],
};
export function guess(headers) {
  return Object.fromEntries(
    fields.map(([k]) => [k, headers.find((h) => (aliases[k] || []).includes(normalize(h))) || '']),
  );
}
// Fautes de frappe connues dans les types de la liste SharePoint
const TYPE_FIXES = {
  livraisonendomage: 'Livraison endommagé',
  livraisonendommagee: 'Livraison endommagé',
};

// Statut du dossier transporteur dans SharePoint (« Ouvert », « En cours », « Résolus ») et
// colonne « Indemnisation » (Oui / Non) → étapes et décision du transporteur de l'outil.
// La décision n'est connue que pour un dossier transporteur résolu.
export function carrierFollowup(status, indemnity) {
  const s = normalize(status);
  const stage =
    s === 'ouvert'
      ? 'Envoyé au transporteur'
      : s === 'encours'
        ? 'En attente réponse'
        : ['resolu', 'resolus', 'clos', 'cloture'].includes(s)
          ? 'Clos'
          : String(status || '').trim();
  const i = normalize(indemnity);
  const carrierDecision =
    stage === 'Clos' && ['oui', 'vrai', 'true'].includes(i)
      ? 'Accepté'
      : stage === 'Clos' && ['non', 'faux', 'false'].includes(i)
        ? 'Refusé'
        : '';
  return { carrierStatus: stage, carrierDecision };
}

export function statusGuess(value) {
  // « En cours / Lydia » : seule la partie avant « / » ou « ( » désigne le statut
  const s = normalize(String(value ?? '').split(/[/(]/)[0]);
  if (['nouveau', 'nouvelle', 'new', 'ouvert', 'atransmettre', 'nontraite'].includes(s))
    return 'Nouveau';
  if (
    [
      'encours',
      'encoursdetraitement',
      'prisencharge',
      'prisenchargeservicelitige',
      'traitementencours',
    ].includes(s)
  )
    return 'Pris en charge';
  if (['enattenterc', 'attenterc', 'attenterelationclient'].includes(s)) return 'En attente RC';
  if (
    [
      'resolu',
      'resolus',
      'resolue',
      'traite',
      'traitee',
      'clos',
      'cloture',
      'cloturee',
      'termine',
      'terminee',
      'ferme',
      'fermee',
    ].includes(s)
  )
    return 'Résolu';
  if (['reouvert', 'reouverte'].includes(s)) return 'Réouvert';
  return '';
}
export function numberValue(v) {
  if (v === null || v === undefined || v === '') return null;
  // Virgule et point présents : le dernier des deux est le séparateur décimal
  // (« 1,205.99 € » export SharePoint en anglais, « 1.205,99 € » en français)
  if (typeof v === 'string' && v.includes(',') && v.includes('.')) {
    const decimal = v.lastIndexOf(',') > v.lastIndexOf('.') ? ',' : '.';
    v = v.replace(decimal === '.' ? /,/g : /\./g, '').replace(',', '.');
  }
  const s =
    typeof v === 'number'
      ? v
      : Number(
          String(v)
            .replace(/[\s\u00a0\u202f€]/g, '')
            .replace(/\.(?=\d{3}(?:\D|$))/g, '')
            .replace(',', '.'),
        );
  return Number.isFinite(s) && s >= 0 ? s : NaN;
}
// Convention des dates importées : la date et l'heure lues dans le fichier sont enregistrées
// telles quelles en UTC (« 02/04/2025 » → 2025-04-02T00:00:00Z), qu'elles viennent d'un texte,
// d'un numéro de série Excel ou d'une vraie cellule date. Le lecteur Excel (SheetJS) renvoie
// ces dernières à l'heure locale du navigateur : on reprend donc leurs composantes locales.
export function excelDate(d) {
  return new Date(
    Date.UTC(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      d.getSeconds(),
    ),
  );
}
export function dateValue(v, format = 'fr') {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(+v) ? false : excelDate(v).toISOString();
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return isNaN(+d) ? false : d.toISOString();
  }
  const s = String(v).trim();
  const m = s.match(
    /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (m) {
    const month = format === 'us' ? +m[1] : +m[2],
      day = format === 'us' ? +m[2] : +m[1];
    const d = new Date(Date.UTC(+m[3], month - 1, day, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
    return d.getUTCDate() === day && d.getUTCMonth() === month - 1 ? d.toISOString() : false;
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return false;
  const d = new Date(s);
  return isNaN(+d) ? false : d.toISOString();
}
export function transform(rows, map, statusMap, defaults) {
  return rows.map((raw, index) => {
    const get = (k) => (map[k] ? raw[map[k]] : undefined),
      text = (k) => String(get(k) ?? '').trim(),
      errors = [],
      warnings = [];
    const status = statusMap[text('status')] || defaults.status;
    const created = dateValue(get('created'), defaults.dateFormat),
      closed = dateValue(get('closed'), defaults.dateFormat);
    if (!created) errors.push('Date d’ouverture manquante ou invalide');
    if (get('closed') && !closed) errors.push('Date de clôture invalide');
    if (!status) errors.push('Statut non reconnu');
    let title = text('title');
    if (!title) {
      if (!text('order') && !text('externalId'))
        errors.push('Objet absent : associez une commande ou un identifiant source');
      else {
        title =
          (TYPE_FIXES[normalize(text('type'))] || text('type') || 'Litige') +
          (text('order')
            ? ' · commande ' + text('order')
            : ' · dossier source ' + text('externalId'));
        warnings.push('Objet généré depuis le type et la référence source');
      }
    }
    if (status === 'Résolu' && !closed)
      warnings.push('Date de clôture absente : dossier résolu conservé, exclu du délai moyen');
    // Clôture saisie avant l'ouverture (erreur de saisie dans la source) : date ignorée
    let closedOk = closed;
    if (closed && created && closed < created) {
      closedOk = null;
      warnings.push('Date de clôture antérieure à l’ouverture : ignorée');
    }
    let amount = numberValue(get('amount')),
      credit = numberValue(get('credit')),
      compensation = numberValue(get('compensation'));
    for (const [k, v] of [
      ['commande', amount],
      ['avoir', credit],
      ['indemnisation', compensation],
    ])
      if (Number.isNaN(v)) errors.push('Montant ' + k + ' invalide');
    // Montant inhabituel (séparateur décimal oublié dans la source ? « 243497 » pour 2 434,97 €)
    if (amount >= 10000)
      warnings.push('Montant commande inhabituel (' + amount + ' €) : à vérifier dans la source');
    if (amount === null) {
      amount = 0;
      warnings.push('Montant commande absent → 0 €');
    }
    credit = credit ?? 0;
    compensation = compensation ?? 0;
    const yes = ['oui', 'true', 'vrai', '1', 'yes'].includes(normalize(text('creditIssued')));
    const creditIssued = yes || credit > 0 || !!text('creditNumber');
    const origin = normalize(text('origin'));
    if (origin && !['transport', 'interne'].includes(origin))
      errors.push('Origine non reconnue : ' + text('origin'));
    let reopened = [];
    if (text('reopened')) {
      reopened =
        get('reopened') instanceof Date || typeof get('reopened') === 'number'
          ? [dateValue(get('reopened'), defaults.dateFormat)]
          : text('reopened')
              .split(/[;|]/)
              .map((v) => dateValue(v, defaults.dateFormat));
      if (reopened.some((v) => !v)) errors.push('Date de réouverture invalide');
      if (reopened.some((v) => created && v < created))
        errors.push('Réouverture antérieure à l’ouverture');
    }
    if (status === 'Réouvert' && !reopened.length) errors.push('Date de réouverture requise');
    if (!text('customer')) warnings.push('Client absent');
    if (!text('order')) warnings.push('Commande absente');
    const verdict = normalize(text('verdict'));
    let resolution = null;
    // Qualification (avéré / non avéré) : seulement pour un dossier résolu
    if (status === 'Résolu') {
      const v = ['oui', 'avere', 'true', 'vrai', '1'].includes(verdict)
        ? 'Avéré'
        : ['non', 'nonavere', 'false', 'faux', '0'].includes(verdict)
          ? 'Non avéré'
          : null;
      resolution = {
        verdict: v || 'Non renseigné (import)',
        reason: text('reason') || 'Non renseigné dans la source',
      };
      if (!v || !text('reason'))
        warnings.push('Qualification historique incomplète, conservée comme non renseignée');
    }
    const extraDates = {
      carrierSentAt: dateValue(get('carrierSentAt'), defaults.dateFormat),
      carrierResponseDue: dateValue(get('carrierResponseDue'), defaults.dateFormat),
      carrierReplyAt: dateValue(get('carrierReplyAt'), defaults.dateFormat),
      carrierFollowupAt: dateValue(get('carrierFollowupAt'), defaults.dateFormat),
      creditCreated: dateValue(get('creditCreated'), defaults.dateFormat),
      takenAt: dateValue(get('takenAt'), defaults.dateFormat),
    };
    for (const [key, value] of Object.entries(extraDates))
      if (get(key) && !value) errors.push('Date invalide : ' + key);
    const extraAmounts = {
      disputeValue: numberValue(get('disputeValue')) ?? 0,
      indemTps: numberValue(get('indemTps')) ?? 0,
    };
    for (const [key, value] of Object.entries(extraAmounts))
      if (Number.isNaN(value)) errors.push('Montant invalide : ' + key);
    if (!text('brand')) warnings.push('Enseigne absente');
    if (!text('productType')) warnings.push('Type produit absent');
    if (!text('origin') && !map.carrier) warnings.push('Origine absente → ' + defaults.origin);
    if (!text('type')) warnings.push('Type absent → ' + defaults.type);
    const sourceData = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [
        k,
        v instanceof Date && !isNaN(+v) ? excelDate(v).toISOString() : v,
      ]),
    );
    return {
      line: index + 2,
      errors,
      warnings,
      record: {
        ...extraDates,
        ...extraAmounts,
        ...Object.fromEntries(
          [
            'carrierCaseRef',
            'clientStage',
            'brand',
            'store',
            'productType',
            'productRef',
            'requester',
            'ticket',
            'bt',
            'outcome',
            'creditNumber',
            'invoice',
            'carrierStatus',
            'rcCheck',
            'rcManager',
            'solco',
            'solution',
            'compensationState',
          ].map((k) => [k, text(k)]),
        ),
        // « Assurer un suivi » (case à cocher SharePoint) : seul un vrai texte est gardé
        followUp: followUpText(text('followUp')),
        externalId: text('externalId'),
        title,
        customer: text('customer') || 'Non renseigné (import)',
        order: text('order') || 'Non renseigné (import)',
        amount,
        credit,
        creditIssued,
        compensation,
        status,
        // « 0 » = pas de ticket
        ticket: text('ticket') === '0' ? '' : text('ticket'),
        // Sans colonne « Origine » : un dossier sans transporteur est un litige interne
        origin:
          origin === 'interne'
            ? 'Interne'
            : origin === 'transport'
              ? 'Transport'
              : !text('origin') && map.carrier && !text('carrier')
                ? 'Interne'
                : defaults.origin,
        type: TYPE_FIXES[normalize(text('type'))] || text('type') || defaults.type,
        created,
        closed: status === 'Résolu' ? closedOk : null,
        reopened,
        assignee: text('assignee'),
        description: text('description') || 'Dossier repris depuis Microsoft Lists.',
        // Transporteurs en majuscules, comme la liste de l'outil (« Chronopost » → CHRONOPOST)
        carrier: text('carrier').toUpperCase(),
        priority: ['urgent', 'haute', 'oui', 'vrai', 'true'].includes(normalize(text('priority')))
          ? 'Haute'
          : 'Normale',
        ...carrierFollowup(text('carrierStatus'), text('compensationState')),
        resolution,
        sourceData,
        sourceList: defaults.sourceList,
        sourceRow: index + 2,
        importedClosed: closedOk || null,
        historicalNotes: text('notes'),
      },
    };
  });
}
