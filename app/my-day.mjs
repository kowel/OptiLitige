// « Ma journée » : tout ce que l'agent a à faire aujourd'hui, rangé par priorité, au même endroit.
// Les éléments viennent des dossiers (délais, relances, prises en charge) et des notifications
// (rappels, avoirs, retours RC, mentions, abonnements).
import { lateRules, soonRules, formatHours } from './sla.mjs';
import { parisToday } from './reminders.mjs';
import { noCarrierClaimFor } from './carrier-tracking.mjs';
import { treatsDisputes } from './roles.mjs';

const open = (r) => r && r.status !== 'Résolu';
const mineOrFree = (r, email) => !r.assignee || String(r.assignee).toLowerCase() === email;

// Relance transporteur à faire aujourd'hui ou en retard (même règle que la liste)
export function carrierFollowupDue(r, today) {
  return (
    open(r) &&
    r.carrierStatus !== 'Clos' &&
    r.carrierStatus !== 'Réponse reçue' &&
    !noCarrierClaimFor(r) &&
    !!r.carrierFollowupAt &&
    String(r.carrierFollowupAt).slice(0, 10) <= today
  );
}

/**
 * Sections de « Ma journée ». Chaque élément : { key, record, title, text, kind, ... }.
 * @param {any[]} records
 * @param {{ email: string, name: string, role: string }} me
 * @param {{ rules?: any[], now?: number, alerts?: Record<string, any[]>, mentions?: any[] }} options
 */
export function buildMyDay(
  records,
  me,
  { rules = [], now = Date.now(), alerts = {}, mentions = [] } = {},
) {
  const email = String(me?.email || '').toLowerCase();
  const litige = treatsDisputes(me?.role);
  const today = parisToday(now);
  const sections = [];
  const add = (id, title, hint, items) => sections.push({ id, title, hint, items });

  // 1. Rappels personnels arrivés à échéance
  add(
    'reminders',
    'Mes rappels',
    'Les rappels que vous avez programmés dans les dossiers.',
    (alerts.reminders || []).map((a) => ({ ...a, kind: 'reminder' })),
  );

  if (litige) {
    // 2. Hors délai : dossiers en retard (attribués à l'agent ou à personne)
    const late = [];
    const soon = [];
    for (const r of records || []) {
      if (!open(r) || !mineOrFree(r, email)) continue;
      const l = lateRules(r, rules, now);
      if (l.length) {
        late.push({
          key: 'late:' + r.id,
          record: r,
          kind: 'late',
          title: r.ref + ' · ' + r.title,
          text: l
            .map((x) => x.rule.label + ' : dépassé de ' + formatHours(x.overdueHours))
            .join(' · '),
          sort: -Math.max(...l.map((x) => x.overdueHours)),
        });
        continue;
      }
      const s = soonRules(r, rules, now, 24);
      if (s.length)
        soon.push({
          key: 'soon:' + r.id,
          record: r,
          kind: 'soon',
          title: r.ref + ' · ' + r.title,
          text: s
            .map((x) => x.rule.label + ' : reste ' + formatHours(x.remainingHours))
            .join(' · '),
          sort: Math.min(...s.map((x) => x.remainingHours)),
        });
    }
    add(
      'late',
      'Hors délai',
      'À traiter en premier.',
      late.sort((a, b) => a.sort - b.sort),
    );
    add(
      'soon',
      'Délai dépassé dans moins de 24 h',
      'À traiter aujourd’hui pour rester dans les temps.',
      soon.sort((a, b) => a.sort - b.sort),
    );

    // 3. Nouveaux dossiers à prendre en charge
    add(
      'new',
      'À prendre en charge',
      'Nouveaux dossiers ou dossiers réouverts, non attribués ou attribués à vous.',
      (records || [])
        .filter((r) => (r.status === 'Nouveau' || r.status === 'Réouvert') && mineOrFree(r, email))
        .sort((a, b) => String(a.created).localeCompare(String(b.created)))
        .map((r) => ({
          key: 'new:' + r.id,
          record: r,
          kind: 'take',
          title: r.ref + ' · ' + r.title,
          text:
            r.status +
            ' · ' +
            (r.type || '') +
            (r.carrier && r.carrier !== '—' ? ' · ' + r.carrier : ''),
        })),
    );

    // 4. Relances transporteur à faire
    add(
      'followups',
      'Relances transporteur à faire',
      'Date de relance atteinte : relancez le transporteur (modèles dans l’onglet Transporteur).',
      (records || [])
        .filter((r) => carrierFollowupDue(r, today) && mineOrFree(r, email))
        .sort((a, b) => String(a.carrierFollowupAt).localeCompare(String(b.carrierFollowupAt)))
        .map((r) => ({
          key: 'followup:' + r.id,
          record: r,
          kind: 'followup',
          title: r.ref + ' · ' + (r.carrier || 'Transporteur'),
          text:
            (r.carrierStatus || '') +
            (String(r.carrierFollowupAt).slice(0, 10) < today
              ? ' · relance en retard'
              : ' · relance prévue aujourd’hui'),
        })),
    );
  }

  // 5. Avoirs (à traiter, à valider, ou réponse à vos demandes)
  add(
    'credits',
    'Avoirs',
    litige ? 'Demandes à traiter ou à valider.' : 'Réponses à vos demandes d’avoir.',
    (alerts.credits || []).filter((a) => litige || a.unread).map((a) => ({ ...a, kind: 'alert' })),
  );

  // 6. Réponses attendues de l'agent (dossiers « En attente RC » qu'il a créés)
  add(
    'rc',
    'Réponses attendues de vous',
    'Le Service Litige attend une information de votre part.',
    (alerts.rc || []).map((a) => ({ ...a, kind: 'alert' })),
  );

  // 7. Messages non lus : mentions et nouveautés des dossiers suivis
  add('messages', 'Messages non lus', 'Mentions et nouveautés des dossiers que vous suivez.', [
    ...(mentions || [])
      .filter((m) => m.unread)
      .map((m) => ({
        key: 'mention:' + m.key,
        record: m.record,
        kind: 'mention',
        title: 'Mention : ' + m.record.ref,
        text: (m.author ? m.author + ' · ' : '') + String(m.text || '').slice(0, 160),
        mention: m,
      })),
    ...(alerts.watch || []).filter((a) => a.unread).map((a) => ({ ...a, kind: 'alert' })),
  ]);

  const total = sections.reduce((n, s) => n + s.items.length, 0);
  return { sections, total, today };
}
