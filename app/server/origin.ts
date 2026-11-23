// Adresse publique de l'outil et contrôle anti-falsification des écritures.
//
// En ligne, APP_ORIGIN (ex. « https://litiges.cybertek.fr ») fixe l'adresse : les redirections de
// connexion ne dépendent alors d'aucun en-tête envoyé par le navigateur. Sans APP_ORIGIN (poste
// local, aperçus), l'adresse est lue dans Host / X-Forwarded-Host : le serveur de développement de
// Next.js réécrit l'adresse de la requête en « localhost ».
export function requestOrigin(req: Request): string {
  const fixed = String(process.env.APP_ORIGIN || '')
    .trim()
    .replace(/\/+$/, '');
  if (fixed) return fixed;
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host;
  const proto = (req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')).split(
    ',',
  )[0];
  return proto.trim() + '://' + host.split(',')[0].trim();
}

/** Écriture acceptée seulement depuis une page de l'outil (en-tête Origin du navigateur) */
export function sameOrigin(req: Request): boolean {
  return req.headers.get('origin') === requestOrigin(req);
}

/**
 * Page de retour après connexion : toujours une page de l'outil. « /\t/autre-site » ou
 * « /\autre-site » sont lus comme une autre adresse par les navigateurs : refusés.
 */
export function safeReturnPath(path: string | null | undefined, origin: string): string {
  const p = String(path || '');
  if (!p.startsWith('/') || p.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(p)) return '/';
  try {
    const u = new URL(p, origin);
    return u.origin === new URL(origin).origin ? u.pathname + u.search + u.hash : '/';
  } catch {
    return '/';
  }
}
