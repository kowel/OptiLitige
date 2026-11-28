// « Client qui s'impatiente » : repère posé ou retiré par la RC ou le SAV sur un dossier.
// Il compte comme sentiment dans l'analyse des relances au Service Litige (app/relances.mjs) :
// une relance faite pendant que le repère est posé compte « client qui s'impatiente ».
import { createsDisputes, isAdmin } from './roles.mjs';

export const IMPATIENT_LABEL = 'Client qui s’impatiente';
const MAX_LOG = 50;

/** Peut poser ou retirer le repère : la RC, le SAV (et les admins) */
export const canFlagImpatience = (role) => createsDisputes(role) || isAdmin(role);

/**
 * Pose (on = true) ou retire le repère, avec l'historique (modifie le dossier sur place).
 * Renvoie un message d'erreur, ou null.
 * @param {any} r dossier
 * @param {boolean} on
 * @param {{ email: string, name: string, role: string }} member
 * @param {string} now date ISO
 */
export function setImpatience(r, on, member, now) {
  if (!canFlagImpatience(member?.role)) return 'Réservé à la Relation client et au SAV.';
  on = !!on;
  if (!!r.clientImpatient === on) return null;
  if (on && r.status === 'Résolu') return 'Le dossier est résolu.';
  r.clientImpatient = on;
  r.impatienceLog = [
    ...(Array.isArray(r.impatienceLog) ? r.impatienceLog : []),
    { on, date: now, by: String(member.email || '').toLowerCase(), name: member.name },
  ].slice(-MAX_LOG);
  r.history = [
    ...(r.history || []),
    { date: now, text: IMPATIENT_LABEL + (on ? ' : signalé' : ' : retiré'), author: member.name },
  ];
  return null;
}

/**
 * Le repère était-il posé à cette date ? (journal des poses et retraits). Une pose faite dans
 * l'heure qui suit compte aussi : l'agent relance souvent puis coche, ou l'inverse.
 */
export function impatientAt(r, date, graceMs = 3600000) {
  const log = Array.isArray(r?.impatienceLog) ? r.impatienceLog : [];
  const t = Date.parse(date);
  if (!Number.isFinite(t)) return false;
  const limit = new Date(t + graceMs).toISOString();
  let on = false;
  for (const e of [...log].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    if (String(e.date) > limit) break;
    on = !!e.on;
  }
  return on;
}
