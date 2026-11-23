// Signatures des e-mails écrits dans l'onglet Transporteur (réglées par les admins dans
// Paramètres → Signatures d'e-mail). Une signature = un texte (avec {agent}…), un logo
// facultatif affiché en grand, et les enseignes pour lesquelles elle est proposée d'office.
// Tant qu'Outlook n'est pas connecté, le message est copié avec sa signature (texte + HTML) et
// collé dans la messagerie : le logo n'apparaît qu'avec ce copier-coller.

import { fillTemplate } from './claim-templates.mjs';

export const MAX_SIGNATURES = 10;
/** Taille maximale du logo (image encodée dans le réglage) */
export const MAX_LOGO_BYTES = 150 * 1024;
export const LOGO_WIDTHS = { min: 80, max: 600, default: 320 };

export const DEFAULT_SIGNATURES = [
  {
    id: 'cybertek',
    name: 'Service Litiges — Groupe Cybertek',
    brands: [],
    text: 'Cordialement,\n{agent}\nService Litiges — Groupe Cybertek',
    logo: '',
    logoWidth: LOGO_WIDTHS.default,
  },
];

const LOGO = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;

/** Vérifie et nettoie la liste envoyée par l'écran : { signatures } ou { error } */
export function normalizeSignatures(input) {
  if (!Array.isArray(input) || input.length > MAX_SIGNATURES)
    return { error: MAX_SIGNATURES + ' signatures au maximum.' };
  const ids = new Set();
  const signatures = [];
  for (const s of input) {
    const name = String(s?.name || '')
      .trim()
      .slice(0, 80);
    if (!name) return { error: 'Chaque signature doit avoir un nom.' };
    const text = String(s?.text || '').slice(0, 2000);
    const logo = String(s?.logo || '');
    if (logo && !LOGO.test(logo))
      return { error: 'Logo de « ' + name + ' » : image PNG, JPEG, GIF ou WebP attendue.' };
    // Taille réelle de l'image (base64 → octets)
    if (logo && Math.floor(((logo.length - logo.indexOf(',') - 1) * 3) / 4) > MAX_LOGO_BYTES)
      return { error: 'Logo de « ' + name + ' » trop lourd (150 Ko au maximum).' };
    if (!text.trim() && !logo) return { error: 'La signature « ' + name + ' » est vide.' };
    const width = Math.round(Number(s?.logoWidth) || LOGO_WIDTHS.default);
    let id =
      String(s?.id || '')
        .replace(/[^\w-]/g, '')
        .slice(0, 40) || 'signature';
    while (ids.has(id)) id += '-2';
    ids.add(id);
    const brands = (Array.isArray(s?.brands) ? s.brands : String(s?.brands || '').split(','))
      .map((b) => String(b).trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 20);
    signatures.push({
      id,
      name,
      brands,
      text,
      logo,
      logoWidth: Math.min(LOGO_WIDTHS.max, Math.max(LOGO_WIDTHS.min, width)),
    });
  }
  return { signatures };
}

/** Signature proposée pour un dossier : celle de son enseigne, sinon la première */
export function pickSignature(signatures, record) {
  const brand = String(record?.brand || '').toLowerCase();
  return (
    (signatures || []).find((s) => (s.brands || []).some((b) => b.toLowerCase() === brand)) ||
    (signatures || [])[0] ||
    null
  );
}

const escape = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const lines = (s) => escape(s).replace(/\r?\n/g, '<br>');

/** Message + signature en texte simple (copie de secours, lien vers la messagerie) */
export function composeText(body, signature, values) {
  const sig = signature ? fillTemplate(signature.text, values).trim() : '';
  return sig ? String(body || '').replace(/\s+$/, '') + '\n\n' + sig : String(body || '');
}

/** Message + signature en HTML (logo en grand), à coller dans Outlook */
export function composeHtml(body, signature, values) {
  const parts = ['<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt">'];
  parts.push('<p>' + lines(String(body || '').replace(/\s+$/, '')) + '</p>');
  if (signature) {
    const sig = fillTemplate(signature.text, values).trim();
    if (sig) parts.push('<p>' + lines(sig) + '</p>');
    if (signature.logo)
      parts.push(
        '<p><img src="' +
          signature.logo +
          '" alt="' +
          escape(signature.name) +
          '" width="' +
          signature.logoWidth +
          '" style="width:' +
          signature.logoWidth +
          'px;height:auto"></p>',
      );
  }
  parts.push('</div>');
  return parts.join('');
}
