// E-mail d'invitation d'un agent (Équipe & accès → « Inviter ») : l'outil n'envoie rien lui-même,
// il ouvre un message tout prêt dans la messagerie du responsable (lien mailto:), qui le relit et
// l'envoie depuis sa propre boîte. Aucun réglage Microsoft n'est nécessaire.

const ROLE_TEXT = {
  RC: 'Relation client : vous créez les litiges des clients et suivez leur avancement.',
  SAV: 'SAV : vous créez les litiges liés aux retours et au service après-vente et suivez leur avancement.',
  'Service Litige':
    'Service Litige : vous traitez les litiges, les réclamations transporteurs et les avoirs.',
  Responsable:
    'Responsable : vous traitez les litiges comme le Service Litige et suivez les analyses des litiges.',
  Admin: 'Admin : vous voyez tous les litiges, les tableaux de bord, l’équipe et les paramètres.',
};

const firstName = (name) =>
  String(name || '')
    .trim()
    .split(/\s+/)[0] || '';

/** Objet, texte et lien mailto: de l'invitation (null pour un compte désactivé ou sans adresse) */
export function invitationMail(member, origin, senderName) {
  const email = String(member?.email || '').trim();
  if (!email || member?.role === 'Désactivé') return null;
  const hello = firstName(member.name);
  const subject = 'Votre accès à OptiLitige';
  const body = [
    'Bonjour' + (hello ? ' ' + hello : '') + ',',
    '',
    'Vous avez désormais accès à OptiLitige, l’outil de suivi des litiges SAV et transport.',
    '',
    'Votre service : ' + (ROLE_TEXT[member.role] || member.role || ''),
    '',
    'Pour vous connecter :',
    '1. Ouvrez ce lien : ' + String(origin || '').replace(/\/+$/, '') + '/',
    '2. Saisissez votre adresse professionnelle : ' + email,
    '3. Suivez les instructions (code de connexion reçu par e-mail ou compte Microsoft).',
    '',
    'Pensez à garder l’outil ouvert dans un onglet : la cloche en haut de l’écran vous signale les litiges où l’on vous mentionne.',
    '',
    'Bonne journée,',
    String(senderName || '').trim(),
  ]
    .join('\r\n')
    .trimEnd();
  const href =
    'mailto:' +
    encodeURIComponent(email).replace(/%40/g, '@') +
    '?subject=' +
    encodeURIComponent(subject) +
    '&body=' +
    encodeURIComponent(body);
  return { to: email, subject, body, href };
}
