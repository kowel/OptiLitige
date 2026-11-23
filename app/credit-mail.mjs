// E-mail « Nouvelle demande d'avoir » (destinataire réglé dans Paramètres → Avoirs, Pierre
// Mazeaud par défaut). Comme pour les invitations, l'outil n'envoie rien lui-même : il ouvre un
// message tout prêt dans la messagerie de l'agent (lien mailto:), qui le relit et l'envoie.
import { CREDIT_FAMILIES, CREDIT_KINDS } from './credit-requests.mjs';

export const DEFAULT_CREDIT_NOTIFY = { name: 'Pierre Mazeaud', email: '' };

const euros = (v) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(v) || 0);
const firstName = (name) =>
  String(name || '')
    .trim()
    .split(/\s+/)[0] || '';

/**
 * Objet, texte et lien mailto: du message (null sans adresse de destinataire).
 * @param {any} record dossier
 * @param {any} request demande d'avoir (famille, motif, type, montant, imputation, commentaire)
 * @param {{ name?: string, email?: string }} notify destinataire
 * @param {string} origin adresse de l'outil
 * @param {string} senderName agent qui fait la demande
 */
export function creditRequestMail(record, request, notify, origin, senderName) {
  const to = String(notify?.email || '').trim();
  if (!to) return null;
  const hello = firstName(notify?.name);
  const subject =
    'Nouvelle demande d’avoir – ' + (record.ref || '') + ' – ' + euros(request.amount);
  const line = (label, value) => (String(value ?? '').trim() ? label + ' : ' + value : '');
  const body = [
    'Bonjour' + (hello ? ' ' + hello : '') + ',',
    '',
    'Une nouvelle demande d’avoir vient d’être faite dans OptiLitige :',
    '',
    line('Dossier', [record.ref, record.title].filter(Boolean).join(' – ')),
    line('Client', [record.customer, record.customerAccount].filter(Boolean).join(' – ')),
    line('Commande', record.order),
    line('Enseigne', record.brand),
    line('Type de litige', record.type),
    '',
    line('Montant demandé', euros(request.amount)),
    line('Type d’avoir', CREDIT_KINDS[request.kind] || request.kind),
    line(
      'Motif',
      [CREDIT_FAMILIES[request.family] || request.family, request.reason]
        .filter(Boolean)
        .join(' – '),
    ),
    line('Imputation', request.imputation),
    line('Commentaire', request.comment),
    '',
    'Le dossier est dans OptiLitige : ' + String(origin || '').replace(/\/+$/, '') + '/',
    '',
    'Bonne journée,',
    String(senderName || '').trim(),
  ]
    .filter((l, i, all) => l !== '' || (all[i - 1] !== '' && i > 0))
    .join('\r\n')
    .trimEnd();
  const href =
    'mailto:' +
    encodeURIComponent(to).replace(/%40/g, '@') +
    '?subject=' +
    encodeURIComponent(subject) +
    '&body=' +
    encodeURIComponent(body);
  return { to, subject, body, href };
}

/** Destinataire vérifié (nom et adresse, vides acceptés) ; null si l'adresse est invalide */
export function normalizeCreditNotify(input) {
  const name = String(input?.name ?? DEFAULT_CREDIT_NOTIFY.name)
    .trim()
    .slice(0, 100);
  const email = String(input?.email ?? '')
    .trim()
    .toLowerCase();
  if (email && (email.length > 200 || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)))
    return null;
  return { name, email };
}
