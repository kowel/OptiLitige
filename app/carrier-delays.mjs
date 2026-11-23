// Relances transporteur : dates calculées automatiquement à partir de la transmission.
//  - Prochaine relance = transmission + N jours (7 par défaut), puis + N jours à chaque
//    « Relance faite ».
//  - Réponse attendue = transmission + M jours (15 par défaut, comme la règle de délai).
// Les dates restent modifiables par l'agent. Délais réglables par les responsables
// (settings « carrier-delays »).

export const DEFAULT_CARRIER_DELAYS = { followupDays: 7, responseDays: 15 };

export function normalizeCarrierDelays(input) {
  const f = Number(input?.followupDays),
    r = Number(input?.responseDays);
  if (!Number.isInteger(f) || f < 1 || f > 90)
    return { error: 'Délai de relance invalide (1 à 90 jours).' };
  if (!Number.isInteger(r) || r < 1 || r > 180)
    return { error: 'Délai de réponse invalide (1 à 180 jours).' };
  return { delays: { followupDays: f, responseDays: r } };
}

// « 2026-11-12 » + n jours (calcul en jours calendaires, sans décalage horaire)
export function addDays(day, n) {
  const d = new Date(String(day).slice(0, 10) + 'T12:00:00Z');
  if (Number.isNaN(+d)) return '';
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Nouvelle date de transmission saisie : relance et réponse attendue remplies automatiquement,
 * sauf si l'agent les a déjà changées à la main (on ne remplace que des dates vides ou celles
 * calculées à partir de l'ancienne transmission).
 * @param {{ carrierSentAt?: string|null, carrierFollowupAt?: string|null, carrierResponseDue?: string|null }} current
 * @param {string} sentAt
 * @param {{ followupDays: number, responseDays: number }} delays
 */
export function autoCarrierDates(current, sentAt, delays = DEFAULT_CARRIER_DELAYS) {
  const patch = { carrierSentAt: sentAt };
  if (!sentAt) return patch;
  const before = String(current?.carrierSentAt || '').slice(0, 10);
  const follow = String(current?.carrierFollowupAt || '').slice(0, 10);
  const due = String(current?.carrierResponseDue || '').slice(0, 10);
  if (!follow || (before && follow === addDays(before, delays.followupDays)))
    patch.carrierFollowupAt = addDays(sentAt, delays.followupDays);
  if (!due || (before && due === addDays(before, delays.responseDays)))
    patch.carrierResponseDue = addDays(sentAt, delays.responseDays);
  return patch;
}

// « Relance faite » aujourd'hui : prochaine relance dans N jours
export const nextFollowup = (today, delays = DEFAULT_CARRIER_DELAYS) =>
  addDays(today, delays.followupDays);
