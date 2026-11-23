// « Qui fait quoi, et quand » dans le panneau Traitement d'un dossier : les étapes d'un litige
// dans l'ordre, le service qui s'en charge, le moment, et où en est ce dossier.
import { noCarrierClaimFor } from './carrier-tracking.mjs';

export const SERVICE_LABELS = {
  'Service Litige': 'Service Litige',
  RC: 'Relation client',
  SAV: 'SAV',
  Responsable: 'Responsable',
  Admin: 'Admin',
};

/**
 * Étapes du dossier : [{ id, title, who: [rôles], when, what, state: 'done'|'current'|'todo'|'skip' }]
 * @param {any} r
 */
export function treatmentSteps(r) {
  // Étapes transporteur sans objet : litige interne, ou décision « Ne concerne pas le transporteur »
  const transport = r?.origin === 'Transport' && !noCarrierClaimFor(r);
  const resolved = r?.status === 'Résolu';
  const waitingRc = r?.status === 'En attente RC';
  const hasCredit =
    !!r?.creditIssued ||
    !!String(r?.creditNumber || '').trim() ||
    (r?.credits || []).some((c) => c.status === 'issued');
  const steps = [
    {
      id: 'take',
      title: 'Prise en charge',
      who: ['Service Litige'],
      when: 'Dès l’arrivée du dossier (délai : 24 h)',
      what: 'Statut « Pris en charge », et « Suivi par » si un agent s’en occupe.',
      done: !!r && r.status !== 'Nouveau',
    },
    {
      id: 'carrier',
      title: 'Réclamation au transporteur',
      who: ['Service Litige'],
      when: 'Juste après la prise en charge (litiges transport), puis à chaque relance',
      what: 'Envoyer la réclamation (modèles dans l’onglet Transporteur), puis noter l’état, la référence, la valeur du litige et la date de transmission : la prochaine relance et la réponse attendue se remplissent seules. À la date de relance : relancer, puis « Relance faite ».',
      done: !!r?.carrierSentAt,
      skip: !transport,
    },
    {
      id: 'reply',
      title: 'Réponse du transporteur',
      who: ['Service Litige'],
      when: 'À réception de la réponse du transporteur',
      what: 'Date de réponse, décision (accepté, en partie, refusé) et indemnisation reçue.',
      done: !!r?.carrierReplyAt || !!r?.carrierDecision,
      skip: !transport,
    },
    {
      id: 'client',
      title: 'Solution pour le client',
      who: ['Service Litige', 'RC', 'SAV'],
      when: 'Dès que la solution est décidée (sans attendre le transporteur si besoin)',
      what: 'Étape côté client et, s’il y en a un, l’avoir (numéro, montant, date, facture) : la RC, le SAV ou le Service Litige le demande dans l’onglet Avoirs, le Service Litige le fait dans l’ERP et note son numéro.',
      done:
        hasCredit ||
        [
          'Solution apportée',
          'Avoir - nouvelle commande client',
          'Remboursement',
          'Produit reçu',
        ].includes(r?.clientStage),
    },
    {
      id: 'close',
      title: 'Clôture',
      who: ['Service Litige'],
      when: 'Quand le client a sa solution',
      what: '« Clôturer le dossier » : résultat du litige et imputation (proposée selon le résultat). La conclusion avéré / non avéré en est déduite.',
      done: resolved,
    },
  ];
  let current = resolved ? -1 : steps.findIndex((s) => !s.done && !s.skip);
  const list = steps.map((s, i) => ({
    ...s,
    state: s.skip ? 'skip' : s.done ? 'done' : i === current ? 'current' : 'todo',
  }));
  // Le Service Litige attend une information de la RC : c'est l'étape en cours
  if (waitingRc && !resolved) {
    list.forEach((s) => {
      if (s.state === 'current') s.state = 'todo';
    });
    list.splice(Math.max(current, 0), 0, {
      id: 'rc',
      title: 'Réponse de la Relation client',
      who: ['RC', 'SAV'],
      when: 'Maintenant : le Service Litige attend une information',
      what: 'Répondre dans l’onglet Échanges, puis repasser le statut à « Pris en charge ».',
      done: false,
      state: 'current',
    });
    current = Math.max(current, 0);
  }
  return list;
}

// Étape en cours et est-ce à ce service de la faire ?
export function nextStep(r, role) {
  const step = treatmentSteps(r).find((s) => s.state === 'current') || null;
  const mine =
    !!step &&
    (step.who.includes(role) ||
      ((role === 'Admin' || role === 'Responsable') && step.who.includes('Service Litige')));
  return { step, mine };
}
