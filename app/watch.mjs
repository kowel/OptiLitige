// Abonnement à un dossier : l'agent abonné est prévenu (cloche → « Abonnements ») de chaque
// modification ou message posté par quelqu'un d'autre sur ce dossier. La liste des dossiers
// suivis est propre à chaque compte (settings « watch:<e-mail> »).

export const MAX_WATCHED = 500;
export const watchKey = (email) => 'watch:' + String(email || '').toLowerCase();

// Liste enregistrée : [{ id, since }] (since = date d'abonnement : seules les nouveautés
// postérieures sont signalées)
export const watchedIds = (list) =>
  Array.isArray(list) ? list.map((x) => x?.id).filter(Boolean) : [];

// Ajoute ou retire un dossier de la liste ; renvoie { list } ou { error }
export function toggleWatch(list, id, on, now = new Date().toISOString()) {
  const entries = Array.isArray(list)
    ? list.filter((x) => x && typeof x.id === 'string' && typeof x.since === 'string')
    : [];
  const clean = String(id || '');
  if (!clean || clean.length > 200) return { error: 'Dossier invalide.' };
  const without = entries.filter((x) => x.id !== clean);
  if (!on) return { list: without };
  if (without.length >= MAX_WATCHED)
    return { error: 'Vous suivez déjà ' + MAX_WATCHED + ' dossiers : désabonnez-vous d’un autre.' };
  return { list: [...without, { id: clean, since: now }] };
}

const time = (d) => Date.parse(d || '') || 0;
const short = (t, max = 160) => {
  const s = String(t || '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
};

// Dernière activité d'un dossier : { kind: 'comment' | 'change', date, author, email, text }.
// La liste allégée fournit `record.activity` (calculé par la base pour les dossiers suivis) ;
// en démonstration, le dossier complet est lu directement.
export function latestActivity(record) {
  const a = record?.activity;
  let history = a ? a.history : null;
  let comment = a ? a.comment : null;
  if (!a) {
    const h = record?.history || [];
    const c = record?.comments || [];
    history = h.reduce((best, x) => (!best || time(x.date) >= time(best.date) ? x : best), null);
    comment = c.reduce((best, x) => (!best || time(x.date) >= time(best.date) ? x : best), null);
  }
  const fromComment = comment
    ? {
        kind: 'comment',
        date: comment.date,
        author: comment.author,
        email: comment.email,
        text: comment.text,
      }
    : null;
  const fromHistory = history
    ? { kind: 'change', date: history.date, author: history.author, email: '', text: history.text }
    : null;
  if (!fromComment) return fromHistory;
  if (!fromHistory) return fromComment;
  return time(fromComment.date) >= time(fromHistory.date) ? fromComment : fromHistory;
}

// Notifications « Abonnements » : une par dossier suivi dont la dernière activité vient de
// quelqu'un d'autre. La clé suit la date de cette activité : elle revient à chaque nouveauté.
export function buildWatchAlerts(records, me, watching = [], read = new Set()) {
  const since = new Map((watching || []).filter((x) => x?.id).map((x) => [x.id, x.since]));
  const email = String(me?.email || '').toLowerCase();
  const name = String(me?.name || '');
  const out = [];
  for (const r of records || []) {
    if (!since.has(r.id)) continue;
    const act = latestActivity(r);
    if (!act?.date || time(act.date) <= time(since.get(r.id))) continue;
    const mine = act.email ? String(act.email).toLowerCase() === email : act.author === name;
    if (mine) continue;
    const key = 'watch:' + r.id + ':' + act.date;
    out.push({
      key,
      record: r,
      date: act.date,
      title: (act.kind === 'comment' ? 'Nouveau message : ' : 'Modification : ') + r.ref,
      text: (act.author ? act.author + ' · ' : '') + short(act.text),
      unread: !read.has(key),
    });
  }
  return out;
}
