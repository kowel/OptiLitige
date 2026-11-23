// Envoi des pièces jointes vers /api/attachments, partagé par l'onglet « Pièces jointes »
// d'un dossier (app/attachments.tsx) et par le formulaire de création (app/new-attachments.tsx).
//
// En ligne (Vercel : 4,5 Mo par requête au plus), le fichier part directement vers Supabase
// Storage : le serveur vérifie d'abord les droits et les limites et donne une adresse d'envoi
// signée (« prepare »), puis contrôle le fichier reçu et l'ajoute au dossier (« confirm »).
// En local (pas d'envoi direct), le fichier est envoyé au serveur dans un formulaire.

import { contentTypeOf } from './attachment-rules.mjs';

type Reply = { error?: string; direct?: boolean; attachmentId?: string; url?: string };

const post = async (body: Record<string, unknown>) => {
  const res = await fetch('/api/attachments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, d: (await res.json().catch(() => ({}))) as Reply };
};

// Envoie un fichier ; renvoie le message d'erreur, ou null si l'envoi a réussi
// (contentieux : pièce d'un contentieux de l'espace des admins)
export async function sendAttachment(
  recordId: string,
  file: File,
  contentieux = false,
): Promise<string | null> {
  const base = { id: recordId, ct: contentieux ? '1' : null, name: file.name, size: file.size };
  try {
    const prepared = await post({ ...base, step: 'prepare' });
    if (!prepared.ok) return prepared.d.error || 'Envoi impossible : ' + file.name;
    if (prepared.d.direct && prepared.d.url && prepared.d.attachmentId) {
      const put = await fetch(prepared.d.url, {
        method: 'PUT',
        // Type déduit du nom, comme au contrôle du serveur ; jamais de remplacement d'un fichier
        headers: { 'Content-Type': contentTypeOf(file.name) },
        body: file,
      });
      if (!put.ok) return 'Envoi impossible vers le stockage : ' + file.name;
      const done = await post({ ...base, step: 'confirm', attachmentId: prepared.d.attachmentId });
      return done.ok ? null : done.d.error || 'Envoi impossible : ' + file.name;
    }
    // Serveur local : fichier envoyé dans un formulaire
    const body = new FormData();
    body.append('id', recordId);
    if (contentieux) body.append('ct', '1');
    body.append('file', file);
    const res = await fetch('/api/attachments', { method: 'POST', body });
    const d = (await res.json().catch(() => ({}))) as Reply;
    return res.ok ? null : d.error || 'Envoi impossible : ' + file.name;
  } catch {
    return 'Connexion interrompue pendant l’envoi de ' + file.name + '.';
  }
}

// Nom parlant pour les photos prises sur place : « Photo LIT-2026-AB12CD 06-11-2026 14h05.jpg »
// (sans référence à la création : « Photo 06-11-2026 14h05.jpg »)
export function namePhotos(files: File[], reference = ''): File[] {
  const stamp = new Date()
    .toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
    .replace(/\//g, '-')
    .replace(':', 'h');
  const types: Record<string, string> = {
    'image/png': 'png',
    'image/heic': 'heic',
    'image/webp': 'webp',
  };
  return files.map((f, i) => {
    const ext = /\.([a-z0-9]+)$/i.exec(f.name)?.[1] || types[f.type] || 'jpg';
    const name =
      'Photo ' + (reference ? reference + ' ' : '') + stamp + (i ? ' (' + (i + 1) + ')' : '');
    return new File([f], name + '.' + ext, { type: f.type });
  });
}
