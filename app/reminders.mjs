// Rappels personnels : « Me rappeler le… » dans la fiche d'un dossier. Chaque agent a sa liste
// (settings « reminders:<e-mail> ») ; le jour venu, le rappel arrive dans la cloche (onglet
// « Rappels ») et dans « Ma journée ». Il reste affiché tant qu'il n'est pas marqué comme fait.

export const MAX_REMINDERS = 300;
export const remindersKey = (email) => 'reminders:' + String(email || '').toLowerCase();
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Jour à Paris : « 2026-11-12 »
export const parisToday = (now = Date.now()) =>
  new Date(now).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });

// Ajoute un rappel ; renvoie { list, reminder } ou { error }
/**
 * @param {any[]} list
 * @param {{ recordId?: unknown, date?: unknown, note?: unknown }} input
 * @param {{ id?: string, now?: string }} [options]
 */
export function addReminder(list, input, { id, now = new Date().toISOString() } = {}) {
  const items = Array.isArray(list) ? list : [];
  const recordId = String(input?.recordId || '');
  const date = String(input?.date || '');
  const note = String(input?.note || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
  if (!recordId || recordId.length > 200) return { error: 'Dossier invalide.' };
  if (!DAY.test(date) || Number.isNaN(Date.parse(date))) return { error: 'Choisissez une date.' };
  if (date < parisToday(Date.parse(now))) return { error: 'La date du rappel est déjà passée.' };
  if (items.length >= MAX_REMINDERS)
    return { error: 'Vous avez déjà ' + MAX_REMINDERS + ' rappels : supprimez-en d’abord.' };
  const reminder = { id: String(id || ''), recordId, date, note, createdAt: now };
  if (!reminder.id) return { error: 'Identifiant manquant.' };
  return { list: [...items, reminder].sort((a, b) => a.date.localeCompare(b.date)), reminder };
}

export function removeReminder(list, id) {
  const items = Array.isArray(list) ? list : [];
  const kept = items.filter((r) => r.id !== id);
  if (kept.length === items.length) return { error: 'Rappel introuvable.' };
  return { list: kept };
}

// Rappels arrivés à échéance (aujourd'hui ou en retard) → notifications « Rappels »
export function dueReminders(list, records, { now = Date.now(), read = new Set() } = {}) {
  const today = parisToday(now);
  const byId = new Map((records || []).map((r) => [r.id, r]));
  return (list || [])
    .filter((r) => r.date <= today && byId.has(r.recordId))
    .map((r) => {
      const record = byId.get(r.recordId);
      const key = 'reminder:' + r.id;
      return {
        key,
        reminderId: r.id,
        record,
        date: r.date + 'T08:00:00',
        title: (r.date < today ? 'Rappel en retard : ' : 'Rappel : ') + record.ref,
        text: r.note || record.title,
        unread: !read.has(key),
        late: r.date < today,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
