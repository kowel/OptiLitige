// Corbeille des pièces jointes (Paramètres, admins) : une pièce jointe supprimée est rangée dans la
// corbeille du stockage, récupérable. Par défaut, rien n'est jamais effacé ; un admin peut choisir
// de vider automatiquement la corbeille après un nombre de jours (tâche de nuit
// /api/cron/corbeille).

export const TRASH_SETTINGS_KEY = 'trash-settings';
export const TRASH_DAYS_CHOICES = [30, 90, 180, 365];
export const DEFAULT_TRASH_SETTINGS = { autoPurge: false, days: 90 };

/** Réglage reçu de l'écran ou lu en base, ramené aux valeurs permises */
export function normalizeTrashSettings(value) {
  const v = value && typeof value === 'object' ? value : {};
  const days = Number(v.days);
  return {
    autoPurge: v.autoPurge === true,
    days: TRASH_DAYS_CHOICES.includes(days) ? days : DEFAULT_TRASH_SETTINGS.days,
  };
}

/** Texte de l'historique d'un dossier quand une pièce jointe est supprimée */
export function trashHistoryText(name, settings) {
  const s = normalizeTrashSettings(settings);
  return (
    'Pièce jointe supprimée (rangée dans la corbeille' +
    (s.autoPurge ? ', effacée après ' + s.days + ' jours' : '') +
    ') : ' +
    name
  );
}
