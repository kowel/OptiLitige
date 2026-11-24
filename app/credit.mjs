// Formateur créé une seule fois : le recréer à chaque appel coûtait cher (tableaux de bord)
const parisDayFormat = new Intl.DateTimeFormat('en', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function creditToday(now = new Date()) {
  const parts = parisDayFormat.formatToParts(new Date(now));
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type).value)
    .join('-');
}
export function normalizeCreditDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const source = String(value);
  if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(source))
    throw new Error('Date d’émission de l’avoir invalide.');
  const day = source.slice(0, 10),
    date = new Date(day + 'T00:00:00.000Z');
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== day)
    throw new Error('Date d’émission de l’avoir invalide.');
  return day;
}
export function resolveCredit(previous, input, now = new Date()) {
  const oldNumber = String(previous.creditNumber || '').trim();
  const number = String(input.creditNumber ?? oldNumber).trim();
  if (number.length > 200) throw new Error('Le numéro d’avoir est trop long.');
  if (!number) {
    if (!oldNumber && previous.creditIssued)
      return {
        creditNumber: '',
        creditIssued: true,
        credit: Number(previous.credit || 0),
        creditCreated: previous.creditCreated || null,
      };
    return { creditNumber: '', creditIssued: false, credit: 0, creditCreated: null };
  }
  const amount = Number(input.credit ?? previous.credit ?? 0);
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error('Le montant de l’avoir doit être un nombre positif ou nul.');
  const provided = normalizeCreditDate(input.creditCreated);
  const stored = normalizeCreditDate(previous.creditCreated);
  return {
    creditNumber: number,
    creditIssued: true,
    credit: amount,
    creditCreated: provided || stored || (number !== oldNumber ? creditToday(now) : null),
  };
}

// Moment où l'avoir du dossier est renseigné (n° et montant), pour prévenir la personne à qui
// le dossier est attribué (notification « Avoir émis », app/alerts.mjs). Un nouveau n° d'avoir
// ou un montant qui passe de 0 à un montant réel donne un nouveau moment ; les dossiers repris
// avec un avoir déjà renseigné n'en ont pas, pour ne pas inonder les notifications.
export function creditIssuedStamp(previous, next, now) {
  const number = String(next.creditNumber || '').trim();
  if (!number || !(Number(next.credit) > 0)) return null;
  const oldNumber = String(previous.creditNumber || '').trim();
  if (number !== oldNumber || !(Number(previous.credit) > 0)) return now;
  return previous.creditIssuedAt || null;
}
