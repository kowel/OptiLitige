// Actions groupées sur plusieurs dossiers de la liste (cocher puis agir) :
// attribuer à un agent, changer de statut (sans clôture), suivre / ne plus suivre, exporter.
// Les changements de statut respectent les passages autorisés ; la clôture reste dans la fiche
// (elle demande un verdict, un motif et, le cas échéant, un avoir).

export const MAX_BULK = 200;
export const BULK_STATUSES = ['Pris en charge', 'En attente RC'];
const FROM = {
  'Pris en charge': ['Nouveau', 'En attente RC', 'Réouvert'],
  'En attente RC': ['Pris en charge', 'Réouvert'],
};

// Contrôle la demande ; renvoie { ids, op, value } ou { error }
export function normalizeBulk(b) {
  const ids = Array.isArray(b?.ids) ? [...new Set(b.ids.map(String))].filter(Boolean) : [];
  if (!ids.length) return { error: 'Aucun dossier sélectionné.' };
  if (ids.length > MAX_BULK) return { error: MAX_BULK + ' dossiers au maximum par action.' };
  const op = String(b?.op || '');
  const value = String(b?.value ?? '');
  if (op === 'status' && !BULK_STATUSES.includes(value)) return { error: 'Statut non proposé.' };
  if (!['assign', 'status'].includes(op)) return { error: 'Action groupée inconnue.' };
  return { ids, op, value };
}

/**
 * Applique l'action à un dossier (modifié sur place). Renvoie un motif si le dossier est
 * ignoré, sinon null.
 * @param {any} r
 * @param {{ op: string, value: string }} action
 * @param {{ now: string, author: string, assigneeName?: string }} ctx
 */
export function applyBulk(r, { op, value }, { now, author, assigneeName }) {
  r.history = r.history || [];
  if (op === 'assign') {
    if (r.status === 'Résolu') return 'dossier résolu';
    if (String(r.assignee || '') === value) return 'déjà attribué';
    r.assignee = value;
    r.assignedAt = now;
    r.history.push({
      date: now,
      text: value
        ? 'Attribué à ' + (assigneeName || value) + ' (action groupée)'
        : 'Attribution retirée (action groupée)',
      author,
    });
    return null;
  }
  if (op === 'status') {
    if (r.status === value) return 'déjà dans ce statut';
    if (!FROM[value].includes(r.status))
      return 'passage ' + r.status + ' → ' + value + ' non autorisé';
    if (r.status === 'Nouveau' && value === 'Pris en charge') r.takenAt = now;
    r.history.push({ date: now, text: r.status + ' → ' + value + ' (action groupée)', author });
    r.status = value;
    r.statusSince = now;
    return null;
  }
  return 'action inconnue';
}
