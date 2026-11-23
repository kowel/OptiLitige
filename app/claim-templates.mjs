// Modèles de réclamation transporteur : textes prêts à copier, remplis avec les données du
// dossier. Le Service Litige et les responsables les modifient dans l'onglet Transporteur
// (settings « claim-templates »). Les champs entre accolades sont remplacés automatiquement.

import { stakeOf } from './advanced-filters.mjs';
export const PLACEHOLDERS = {
  transporteur: 'Transporteur',
  numero_suivi: 'Numéro de suivi (BT)',
  commande: 'N° de commande',
  reference_litige: 'Référence du litige',
  reference_reclamation: 'Réf. de réclamation transporteur',
  date_declaration: 'Date de déclaration',
  date_envoi_reclamation: 'Date d’envoi de la réclamation',
  montant: 'Montant de la commande',
  indemnisation: 'Indemnisation attendue',
  client: 'Client',
  produit: 'Type de produit',
  reference_produit: 'Référence produit',
  description: 'Description du signalement',
  agent: 'Votre nom',
};

// Formule de politesse et nom : ajoutés par la signature (Paramètres → Signatures d'e-mail)
const SIGN = `\n\nNous restons à votre disposition pour tout complément d'information.`;

// Modèles proposés au départ (à ajuster par le Service Litige à l'usage)
export const DEFAULT_CLAIM_TEMPLATES = [
  {
    id: 'perte',
    title: 'Colis perdu — déclaration',
    keywords: ['perdu', 'perte', 'non livré'],
    subject: 'Réclamation colis perdu — n° {numero_suivi} — commande {commande}',
    body: `Bonjour,

Nous vous signalons la perte du colis n° {numero_suivi}, confié à vos services pour notre commande {commande}.

Aucun mouvement n'apparaît depuis plusieurs jours sur le suivi et notre client n'a pas été livré. Nous vous remercions d'ouvrir une enquête et, si le colis n'est pas retrouvé, de procéder à son indemnisation.

Valeur de la marchandise : {montant} TTC (facture disponible sur demande).
Produit : {produit} — réf. {reference_produit}.
Notre référence de dossier : {reference_litige}.${SIGN}`,
  },
  {
    id: 'casse',
    title: 'Colis endommagé / produit cassé',
    keywords: ['cass', 'endommag', 'abîm', 'avarie', 'bris'],
    subject: 'Réclamation colis endommagé — n° {numero_suivi} — commande {commande}',
    body: `Bonjour,

Le colis n° {numero_suivi} (commande {commande}) a été livré endommagé à notre client : {description}

Les photos du colis et du produit sont jointes à ce message. Nous vous demandons la prise en charge du préjudice, d'une valeur de {montant} TTC.

Produit : {produit} — réf. {reference_produit}.
Notre référence de dossier : {reference_litige}.${SIGN}`,
  },
  {
    id: 'spoliation',
    title: 'Colis spolié / produit manquant',
    keywords: ['manquant', 'spoli', 'vide', 'incomplet', 'vol'],
    subject: 'Réclamation colis spolié — n° {numero_suivi} — commande {commande}',
    body: `Bonjour,

Notre client a reçu le colis n° {numero_suivi} (commande {commande}) incomplet : {description}

Le colis présentait des traces d'ouverture (photos et poids constaté jointes). Nous vous remercions d'ouvrir une enquête et de procéder à l'indemnisation du contenu manquant, d'une valeur de {montant} TTC.

Notre référence de dossier : {reference_litige}.${SIGN}`,
  },
  {
    id: 'contestation',
    title: 'Livré mais non reçu — contestation de livraison',
    keywords: ['contestation', 'non reçu', 'non recu', 'livré'],
    subject: 'Contestation de livraison — n° {numero_suivi} — commande {commande}',
    body: `Bonjour,

Le suivi du colis n° {numero_suivi} (commande {commande}) indique une livraison, mais notre client conteste l'avoir reçu.

Merci de nous transmettre la preuve de livraison (signature, photo, coordonnées GPS ou point relais) et, à défaut, d'ouvrir une enquête suivie d'une indemnisation de {montant} TTC.

Notre référence de dossier : {reference_litige}.${SIGN}`,
  },
  {
    id: 'retard',
    title: 'Retard de livraison',
    keywords: ['retard', 'bloqué', 'bloque', 'attente'],
    subject: 'Retard de livraison — n° {numero_suivi} — commande {commande}',
    body: `Bonjour,

Le colis n° {numero_suivi} (commande {commande}) n'est toujours pas livré à notre client et le suivi n'évolue plus.

Pouvez-vous nous indiquer où se trouve le colis et la date de livraison prévue ? Sans livraison sous 48 h, nous vous demanderons le remboursement des frais de transport, voire l'indemnisation de la marchandise ({montant} TTC).

Notre référence de dossier : {reference_litige}.${SIGN}`,
  },
  {
    id: 'erreur',
    title: 'Erreur de livraison / colis inversé',
    keywords: ['inversion', 'invers', 'erreur', 'mauvais'],
    subject: 'Erreur de livraison — n° {numero_suivi} — commande {commande}',
    body: `Bonjour,

Notre client a reçu un colis qui ne lui était pas destiné à la place du colis n° {numero_suivi} (commande {commande}) : {description}

Merci d'organiser l'enlèvement du colis livré par erreur et la livraison du bon colis, ou à défaut l'indemnisation de {montant} TTC.

Notre référence de dossier : {reference_litige}.${SIGN}`,
  },
  {
    id: 'relance',
    title: 'Relance — réclamation sans réponse',
    keywords: [],
    subject: 'Relance — réclamation {reference_reclamation} — colis n° {numero_suivi}',
    body: `Bonjour,

Sauf erreur de notre part, nous n'avons pas reçu de réponse à notre réclamation du {date_envoi_reclamation} (votre référence : {reference_reclamation}) concernant le colis n° {numero_suivi}, commande {commande}.

Nous vous remercions de nous apporter une réponse dans les meilleurs délais.

Notre référence de dossier : {reference_litige}.${SIGN}`,
  },
  {
    id: 'reglement',
    title: 'Demande de règlement de l’indemnisation',
    keywords: [],
    subject: 'Règlement de l’indemnisation — réclamation {reference_reclamation}',
    body: `Bonjour,

Suite à votre accord sur notre réclamation {reference_reclamation} (colis n° {numero_suivi}, commande {commande}), nous restons dans l'attente du règlement de l'indemnisation de {indemnisation}.

Merci de nous indiquer la date de versement ou le numéro de l'avoir correspondant.

Notre référence de dossier : {reference_litige}.${SIGN}`,
  },
  {
    id: 'refus',
    title: 'Contestation d’un refus d’indemnisation',
    keywords: [],
    subject: 'Contestation de votre refus — réclamation {reference_reclamation}',
    body: `Bonjour,

Nous contestons votre refus d'indemnisation concernant le colis n° {numero_suivi} (commande {commande}, réclamation {reference_reclamation}).

[Expliquer ici pourquoi le refus n'est pas fondé : réserves émises à la livraison, photos, poids constaté, preuve de livraison absente…]

Nous vous demandons de réexaminer ce dossier et de procéder à l'indemnisation de {montant} TTC.

Notre référence de dossier : {reference_litige}.${SIGN}`,
  },
];

const euros = (v) =>
  v || v === 0
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(v))
    : '';
const day = (v) => {
  const d = new Date(v || '');
  return Number.isNaN(+d) ? '' : d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
};

// Valeurs des champs pour un dossier
export function placeholderValues(record, me) {
  return {
    transporteur: record?.carrier && record.carrier !== '—' ? record.carrier : '',
    numero_suivi: String(record?.bt || '').trim(),
    commande: record?.order || '',
    reference_litige: record?.ref || '',
    reference_reclamation: record?.carrierCaseRef || '',
    date_declaration: day(record?.created),
    date_envoi_reclamation: day(record?.carrierSentAt),
    montant: euros(stakeOf(record)),
    indemnisation: euros(record?.compensation) || euros(stakeOf(record)),
    client: record?.customer && !/^non renseign/i.test(record.customer) ? record.customer : '',
    produit: record?.productType || '',
    reference_produit: record?.productRef || '',
    description: String(record?.description || '').trim(),
    agent: me?.name || '',
  };
}

// Remplit un texte ; un champ vide devient « [à compléter : …] »
export function fillTemplate(text, values) {
  return String(text || '').replace(/\{(\w+)\}/g, (all, k) => {
    if (!(k in PLACEHOLDERS)) return all;
    return values[k] || '[à compléter : ' + PLACEHOLDERS[k].toLowerCase() + ']';
  });
}

// Modèle le plus adapté au type du dossier (mots-clés), sinon le premier
export function suggestTemplate(templates, record) {
  const t = String(record?.type || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  const norm = (k) => k.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return (
    (templates || []).find((m) => (m.keywords || []).some((k) => k && t.includes(norm(k)))) ||
    (templates || [])[0]
  );
}

// Contrôle les modèles envoyés ; renvoie { templates } ou { error }
export function normalizeTemplates(input) {
  if (!Array.isArray(input) || input.length > 40) return { error: '40 modèles au maximum.' };
  const ids = new Set();
  const templates = [];
  for (const m of input) {
    const title = String(m?.title || '')
      .trim()
      .slice(0, 120);
    const subject = String(m?.subject || '')
      .trim()
      .slice(0, 300);
    const body = String(m?.body || '').slice(0, 6000);
    if (!title) return { error: 'Chaque modèle doit avoir un titre.' };
    if (!body.trim()) return { error: 'Le modèle « ' + title + ' » est vide.' };
    let id =
      String(m?.id || '')
        .replace(/[^\w-]/g, '')
        .slice(0, 40) || 'modele';
    while (ids.has(id)) id += '-2';
    ids.add(id);
    const keywords = (
      Array.isArray(m?.keywords) ? m.keywords : String(m?.keywords || '').split(',')
    )
      .map((k) => String(k).trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 12);
    templates.push({ id, title, keywords, subject, body });
  }
  return { templates };
}
