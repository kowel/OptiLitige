// Règles des pièces jointes, partagées par l'API (app/api/attachments/route.ts),
// l'écran (app/attachments.tsx) et les tests (tests/attachments.test.mjs).

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15 Mo par fichier
export const MAX_ATTACHMENTS_PER_RECORD = 30;
// Reprise de l'historique SharePoint (pièces jointes d'origine) : limites élargies, sous la
// taille maximale d'une requête Cloudflare Workers (100 Mo)
export const REPRISE_LIMITS = { maxBytes: 95 * 1024 * 1024, maxCount: 200 };

// Extensions acceptées → type envoyé au navigateur. Le type déclaré par le navigateur de
// l'agent n'est jamais repris : seul le nom du fichier compte. Les formats qui peuvent
// exécuter du code dans le navigateur (HTML, SVG, scripts) sont refusés.
export const ATTACHMENT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv',
  txt: 'text/plain',
  eml: 'message/rfc822',
  msg: 'application/vnd.ms-outlook',
  // Vidéos (colis filmé au déballage) : téléchargées, jamais lues dans la page
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};
export const ACCEPT_ATTRIBUTE = Object.keys(ATTACHMENT_TYPES)
  .map((ext) => '.' + ext)
  .join(',');

// Seules ces images s'affichent directement dans le navigateur ; le reste se télécharge.
const INLINE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export function extensionOf(name) {
  const match = /\.([a-z0-9]+)$/i.exec(String(name || ''));
  return match ? match[1].toLowerCase() : '';
}

// Nettoie le nom d'origine : pas de chemin, pas de caractères de contrôle, 150 caractères.
export function cleanFileName(name) {
  const base = String(name || '')
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f\u007f"<>|*?:]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base || base === '.' || base === '..') return '';
  if (base.length <= 150) return base;
  const ext = extensionOf(base);
  return base.slice(0, 150 - ext.length - 1) + '.' + ext;
}

// Renvoie un message d'erreur en français, ou '' si le fichier est accepté.
export function checkAttachment(
  { name, size },
  existingCount = 0,
  { maxBytes = MAX_ATTACHMENT_BYTES, maxCount = MAX_ATTACHMENTS_PER_RECORD } = {},
) {
  const clean = cleanFileName(name);
  if (!clean) return 'Nom de fichier invalide.';
  if (!ATTACHMENT_TYPES[extensionOf(clean)])
    return (
      'Format non accepté : ' +
      clean +
      '. Formats acceptés : photos, vidéos, PDF, Word, Excel, e-mails, texte.'
    );
  if (!Number.isFinite(size) || size <= 0) return 'Le fichier ' + clean + ' est vide.';
  if (size > maxBytes)
    return 'Le fichier ' + clean + ' dépasse ' + Math.round(maxBytes / 1024 / 1024) + ' Mo.';
  if (existingCount >= maxCount) return 'Ce dossier a déjà ' + maxCount + ' pièces jointes.';
  return '';
}

export function contentTypeOf(name) {
  return ATTACHMENT_TYPES[extensionOf(name)] || 'application/octet-stream';
}

export function isInline(contentType) {
  return INLINE_TYPES.has(contentType);
}

// En-tête Content-Disposition compatible avec les accents (RFC 6266 / 5987).
export function contentDisposition(name, inline) {
  const ascii = cleanFileName(name)
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/[\\"]/g, '_');
  return (
    (inline ? 'inline' : 'attachment') +
    '; filename="' +
    ascii +
    "\"; filename*=UTF-8''" +
    encodeURIComponent(cleanFileName(name))
  );
}

// L'auteur d'une pièce jointe et les responsables peuvent la supprimer.
export function canDeleteAttachment(attachment, member) {
  return (
    !!attachment &&
    !!member &&
    (member.role === 'Admin' ||
      String(attachment.email || '').toLowerCase() === String(member.email || '').toLowerCase())
  );
}

export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' Ko';
  return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo';
}
