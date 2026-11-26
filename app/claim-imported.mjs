// Dossiers repris de SharePoint : le demandeur n'y est qu'un nom (colonne « Détenteur »). À
// l'import, il est rattaché au compte du même nom s'il existe ; sinon le dossier reste sans
// adresse de demandeur. Quand un admin ajoute ensuite le compte de cet agent (Paramètres →
// Équipe), ses dossiers lui sont rattachés : même règle de nom (sans accents ni majuscules).
import { fold } from './search.mjs';

/**
 * Dossier mis à jour pour ce compte, ou null s'il ne le concerne pas.
 * @param {any} record dossier
 * @param {{ email: string, name: string }} account compte ajouté (actif)
 * @param {string} [by] nom de l'admin, pour l'historique
 */
export function claimImported(record, account, by = '') {
  const name = fold(account?.name);
  const email = String(account?.email || '')
    .trim()
    .toLowerCase();
  if (!name || !email || !record?.importedAt) return null;
  if (String(record.requesterEmail || '').trim()) return null;
  if (fold(record.requester) !== name) return null;
  const date = new Date().toISOString();
  return {
    ...record,
    requester: String(account.name).trim(),
    requesterEmail: email,
    creator: email,
    rev: (Number(record.rev) || 0) + 1,
    history: [
      ...(record.history || []),
      { date, text: 'Dossier rattaché au compte de ' + String(account.name).trim(), author: by },
    ],
  };
}
