// Notifications « à traiter », rangées par catégorie pour ne pas se noyer les unes dans les
// autres. Les mentions gardent leur propre logique (app/notifications.mjs) ; les autres
// catégories sont calculées à partir de l'état des dossiers : une notification disparaît
// d'elle-même quand la situation est réglée (dossier pris en charge, réponse donnée…).
//
// Chaque notification a une clé stable ; la marquer comme lue enregistre cette clé. Si la
// situation se reproduit (nouvelle attribution, nouveau retour « En attente RC »), la clé
// change et la notification revient.
import { lateRules } from './sla.mjs';
import { buildWatchAlerts } from './watch.mjs';
import { dueReminders } from './reminders.mjs';
import { buildReportAlerts } from './reports.mjs';
import { treatsDisputes } from './roles.mjs';

export const ALERT_CATEGORIES = [
  // Dossiers ouverts en « Inversion » : prévenir tout le monde, en premier
  { id: 'priority', label: 'Prioritaires' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'reminders', label: 'Rappels' },
  { id: 'assignments', label: 'Attributions' },
  { id: 'rc', label: 'Retours RC' },
  { id: 'late', label: 'Hors délai' },
  { id: 'credits', label: 'Avoirs' },
  { id: 'watch', label: 'Abonnements' },
  { id: 'reports', label: 'Rapports' },
];

export const ALERT_KEY_PATTERN =
  /^(priority|assign|rc|late|credit|watch|reminder|report):[\w.:@+-]{1,300}$/;

const open = (r) => r && r.status !== 'Résolu';

// Types de litige qui préviennent tout le monde dès l'ouverture (cloche « Prioritaires » et
// e-mail à toute l'équipe)
export const PRIORITY_TYPES = ['Inversion'];
export const isPriorityType = (type) => PRIORITY_TYPES.includes(String(type || ''));

/**
 * @param {object[]} records
 * @param {object} me
 * @param {{ rules?: object[], readKeys?: string[], now?: number, watching?: { id: string, since: string }[], reminders?: object[], reports?: object[] }} [options]
 */
export function buildAlerts(
  records,
  me,
  { rules = [], readKeys = [], now = Date.now(), watching = [], reminders = [], reports = [] } = {},
) {
  const read = new Set(readKeys);
  const email = String(me?.email || '').toLowerCase();
  const role = me?.role;
  const out = {
    priority: [],
    assignments: [],
    rc: [],
    late: [],
    credits: [],
    // Dossiers suivis : modifications et messages des autres (app/watch.mjs)
    watch: buildWatchAlerts(records, me, watching, read),
    // Rappels personnels arrivés à échéance (app/reminders.mjs)
    reminders: dueReminders(reminders, records, { now, read }),
    // Rapports programmés reçus (app/reports.mjs)
    reports: buildReportAlerts(reports, me, { now, read }),
  };

  const litige = treatsDisputes(role);
  for (const r of records || []) {
    // Avoirs : à décider / à émettre pour le service litige, à valider pour les responsables,
    // et décision prise pour l'agent qui a fait la demande (y compris sur un dossier résolu)
    for (const c of r?.credits || []) {
      const mine = String(c.requestedBy || '').toLowerCase() === email;
      let title = '';
      if (c.status === 'requested' && litige) title = 'Avoir à traiter : ' + r.ref;
      else if (c.status === 'manager' && role === 'Admin')
        title = 'Avoir à valider (admin) : ' + r.ref;
      else if (c.status === 'accepted' && litige) title = 'Avoir à émettre dans l’ERP : ' + r.ref;
      if (mine && ['accepted', 'refused', 'issued'].includes(c.status) && !title)
        title =
          {
            accepted: 'Votre demande d’avoir est acceptée : ',
            refused: 'Votre demande d’avoir est refusée : ',
            issued: 'Votre avoir est émis : ',
          }[c.status] + r.ref;
      if (!title) continue;
      const key = 'credit:' + r.id + ':' + c.id + ':' + c.status;
      out.credits.push({
        key,
        record: r,
        date: c.statusAt || c.requestedAt,
        title,
        text:
          Number(c.approvedAmount ?? c.amount)
            .toFixed(2)
            .replace('.', ',') +
          ' € · ' +
          c.reason,
        unread: !read.has(key),
      });
    }
    if (!open(r)) continue;

    // Litige ouvert en « Inversion » : notification prioritaire pour tous les comptes
    if (isPriorityType(r.type)) {
      const key = 'priority:' + r.id;
      out.priority.push({
        key,
        record: r,
        date: r.created,
        title: 'Prioritaire · ' + r.type + ' : ' + r.ref,
        text: r.title,
        unread: !read.has(key),
      });
    }

    // Dossier attribué à l'agent (par quelqu'un d'autre ou par lui-même)
    if (r.assignee && String(r.assignee).toLowerCase() === email && r.assignedAt) {
      const key = 'assign:' + r.id + ':' + r.assignedAt;
      out.assignments.push({
        key,
        record: r,
        date: r.assignedAt,
        title: 'Dossier attribué : ' + r.ref,
        text: r.title,
        unread: !read.has(key),
      });
    }

    // Le service litige attend une réponse sur un dossier créé par l'agent (RC ou SAV)
    if (r.status === 'En attente RC' && String(r.creator || '').toLowerCase() === email) {
      const since = r.statusSince || r.created;
      const key = 'rc:' + r.id + ':' + since;
      out.rc.push({
        key,
        record: r,
        date: since,
        title: 'Réponse attendue de votre part : ' + r.ref,
        text: r.title,
        unread: !read.has(key),
      });
    }

    // Hors délai : tout le service litige (qui traite les dossiers en équipe) et les
    // responsables voient tous les dossiers. Les autres rôles ne reçoivent pas cette catégorie.
    const concerned = treatsDisputes(role);
    if (concerned) {
      const late = lateRules(r, rules, now);
      if (late.length) {
        const ids = late.map((l) => l.rule.id).sort();
        const since = late.map((l) => l.since).sort()[0];
        const key = 'late:' + r.id + ':' + ids.join('+') + ':' + since;
        out.late.push({
          key,
          record: r,
          date: since,
          title: 'Hors délai : ' + r.ref,
          text: late.map((l) => l.rule.label).join(' · '),
          unread: !read.has(key),
        });
      }
    }
  }
  for (const list of Object.values(out)) list.sort((a, b) => String(b.date).localeCompare(a.date));
  return out;
}
