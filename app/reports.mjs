// Rapports : synthèse d'une période (mois ou semaine) comparée à la précédente, imprimable en PDF.
//  - À la demande : bouton « Rapport (PDF) » dans Analyses & rapports (filtres de l'écran).
//  - Programmés : les responsables créent dans Paramètres des rapports ciblés (filtres), avec un
//    rythme (mensuel / hebdomadaire) et des destinataires (agents ou services). À la fin de chaque
//    période, le rapport arrive aux destinataires dans la cloche (onglet « Rapports ») ; l'envoi par
//    e-mail viendra avec la connexion Microsoft 365 (voir le document « à finaliser avec l'IT »).
import { EMPTY_ANALYTICS, filterAnalytics, ANALYTICS_LABELS } from './analytics-filters.mjs';
import { hasCredit, stakeOf } from './advanced-filters.mjs';
import { isFraud } from './outcomes.mjs';

export const FREQUENCIES = { monthly: 'Mensuel', weekly: 'Hebdomadaire' };
export const REPORT_ROLES = ['RC', 'SAV', 'Service Litige', 'Responsable', 'Admin'];
export const MAX_REPORTS = 30;

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

// Période d'un mois « 2026-10 » : { key, from, to (exclu), label }
export function monthPeriod(key) {
  const [y, m] = key.split('-').map(Number);
  const from = new Date(y, m - 1, 1),
    to = new Date(y, m, 1);
  return {
    key,
    kind: 'monthly',
    from: isoDay(from),
    to: isoDay(to),
    label: MONTHS[m - 1] + ' ' + y,
  };
}
// Semaine commençant le lundi « 2026-11-02 »
export function weekPeriod(monday) {
  const from = new Date(monday + 'T12:00:00');
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  const last = new Date(to);
  last.setDate(last.getDate() - 1);
  const f = (d) => pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
  return {
    key: monday,
    kind: 'weekly',
    from: isoDay(from),
    to: isoDay(to),
    label: 'semaine du ' + f(from) + ' au ' + f(last) + '/' + last.getFullYear(),
  };
}
// Période choisie par dates (du … au …, bornes comprises)
export function rangePeriod(from, toIncluded) {
  const start = new Date(from + 'T12:00:00'),
    last = new Date(toIncluded + 'T12:00:00');
  const end = new Date(last);
  end.setDate(end.getDate() + 1);
  const f = (d) => pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  return {
    key: 'range:' + from + ':' + toIncluded,
    kind: 'range',
    from: isoDay(start),
    to: isoDay(end),
    days: Math.round((+end - +start) / 86400e3),
    label: 'du ' + f(start) + ' au ' + f(last),
  };
}
// Contrôle des dates choisies ; renvoie un message d'erreur ou ''
export function rangeError(from, toIncluded) {
  const ok = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(Date.parse(v));
  if (!ok(from) || !ok(toIncluded)) return 'Choisissez une date de début et une date de fin.';
  if (from > toIncluded) return 'La date de début doit précéder la date de fin.';
  if ((Date.parse(toIncluded) - Date.parse(from)) / 86400e3 > 366 * 3)
    return 'Choisissez une période de 3 ans au plus.';
  return '';
}

export function previousPeriod(p) {
  if (p.kind === 'range') {
    // Même durée, juste avant
    const end = new Date(p.from + 'T12:00:00');
    end.setDate(end.getDate() - 1);
    const start = new Date(p.from + 'T12:00:00');
    start.setDate(start.getDate() - p.days);
    return rangePeriod(isoDay(start), isoDay(end));
  }
  if (p.kind === 'weekly') {
    const d = new Date(p.from + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    return weekPeriod(isoDay(d));
  }
  const [y, m] = p.key.split('-').map(Number);
  return monthPeriod(m === 1 ? y - 1 + '-12' : y + '-' + pad(m - 1));
}
// Dernière période terminée à la date `now` (mois précédent, ou semaine précédente)
export function lastClosedPeriod(kind, now = Date.now()) {
  const d = new Date(
    new Date(now).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }) + 'T12:00:00',
  );
  if (kind === 'weekly') {
    const day = (d.getDay() + 6) % 7; // lundi = 0
    d.setDate(d.getDate() - day - 7);
    return weekPeriod(isoDay(d));
  }
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return monthPeriod(d.getFullYear() + '-' + pad(d.getMonth() + 1));
}

const dayOf = (v) =>
  v ? new Date(v).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }) : '';
const inside = (v, p) => {
  const d = dayOf(v);
  return !!d && d >= p.from && d < p.to;
};
const amountOf = (c) => Number(c.approvedAmount ?? c.amount) || 0;

// Chiffres d'une période
export function periodFigures(records, p) {
  const opened = records.filter((r) => inside(r.created, p));
  const closed = records.filter((r) => r.status === 'Résolu' && inside(r.closed, p));
  // Même calcul que les statistiques : avérés parmi les dossiers qualifiés (avéré ou non avéré)
  const proven = closed.filter((r) => r.resolution?.verdict === 'Avéré').length;
  const qualified = proven + closed.filter((r) => r.resolution?.verdict === 'Non avéré').length;
  const days = closed
    .map((r) => (Date.parse(r.closed) - Date.parse(r.created)) / 86400e3)
    .filter((n) => Number.isFinite(n) && n >= 0);
  const frauds = closed.filter((r) => isFraud(r.outcome));
  let credits = 0,
    creditCount = 0;
  for (const r of records) {
    let issued = 0;
    for (const c of r.credits || [])
      if (c.status === 'issued') {
        issued += amountOf(c);
        // Mois de l'avoir = date d'émission dans l'ERP, sinon date de saisie
        if (inside(c.issue?.date || c.issue?.at || c.statusAt, p)) {
          credits += amountOf(c);
          creditCount++;
        }
      }
    // Avoir saisi à l'ancienne (suivi financier, reprise SharePoint) : la part du montant
    // « avoir » du dossier qui ne vient pas du circuit des demandes
    const legacy = Math.round(((Number(r.credit) || 0) - issued) * 100) / 100;
    if (r.creditIssued && legacy > 0 && inside(r.creditCreated, p)) {
      credits += legacy;
      creditCount++;
    }
  }
  const compensation = closed.reduce((n, r) => n + (Number(r.compensation) || 0), 0);
  const decisions = { Accepté: 0, Partiel: 0, Refusé: 0 };
  for (const r of closed) if (r.carrierDecision in decisions) decisions[r.carrierDecision]++;
  const group = (list, key) => {
    const m = new Map();
    for (const r of list) {
      const k = String(r[key] || '').trim() || 'Non renseigné';
      if (k === '—') continue;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  return {
    opened: opened.length,
    closed: closed.length,
    openAtEnd: records.filter(
      (r) => dayOf(r.created) < p.to && (r.status !== 'Résolu' || dayOf(r.closed) >= p.to),
    ).length,
    provenRate: qualified ? Math.round((proven / qualified) * 100) : 0,
    avgDays: days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0,
    orderValue: opened.reduce((n, r) => n + stakeOf(r), 0),
    frauds: frauds.length,
    fraudValue: frauds.reduce((n, r) => n + (Number(r.disputeValue) || Number(r.amount) || 0), 0),
    credits,
    creditCount,
    compensation,
    decisions,
    withCredit: closed.filter(hasCredit).length,
    byCarrier: group(opened, 'carrier').slice(0, 8),
    byBrand: group(opened, 'brand').slice(0, 8),
    byType: group(opened, 'type').slice(0, 6),
  };
}

// Rapport complet : période, période précédente, filtres appliqués
/** @param {any[]} records @param {any} period @param {Record<string, string>} [filters] @param {any[]} [members] */
export function buildReport(records, period, filters = EMPTY_ANALYTICS, members = []) {
  const rows = filterAnalytics(records, filters, members);
  const previous = previousPeriod(period);
  const active = Object.entries({ ...EMPTY_ANALYTICS, ...(filters || {}) })
    .filter(([, v]) => v)
    .map(([k, v]) => {
      const label = ANALYTICS_LABELS[k];
      if (k === 'assignee')
        return (
          label +
          ' : ' +
          (v === 'none' ? 'auteur sans compte' : members.find((m) => m.email === v)?.name || v)
        );
      if (k === 'priority') return label + ' : ' + (v === 'urgent' ? 'urgents' : 'hors urgents');
      if (k === 'credit') return label + ' : ' + (v === 'with' ? 'avec avoir' : 'sans avoir');
      return label + ' : ' + v;
    });
  return {
    period,
    previous,
    filters: active,
    now: periodFigures(rows, period),
    before: periodFigures(rows, previous),
  };
}

// --- Présentation commune à l'écran et au fichier PDF ------------------------------------
const money0 = (n) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
const num = (n, d = 0) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);

// Évolution par rapport à la période précédente : { dir: 'up'|'down'|'', text, tone }
// tone = 'better' (favorable), 'worse' ou '' ; `good` = sens favorable
export function delta(now, before, good, unit = '') {
  const diff = now - before;
  if (!before && !now) return { dir: '', text: '—', tone: '' };
  if (Math.abs(diff) < 0.05) return { dir: '', text: '= stable', tone: '' };
  const better = good === 'up' ? diff > 0 : diff < 0;
  const pct = before ? Math.round((diff / before) * 100) : null;
  const text =
    pct !== null && unit !== '%' && unit !== 'j'
      ? Math.abs(pct) + ' %'
      : num(Math.abs(diff), unit === 'j' ? 1 : 0) +
        (unit === '%' ? ' pts' : unit ? ' ' + unit : '');
  return { dir: diff > 0 ? 'up' : 'down', text, tone: better ? 'better' : 'worse' };
}

// Les 9 indicateurs du rapport : { label, value, delta }
export function reportTiles(data) {
  const n = data.now,
    b = data.before;
  return [
    { label: 'Dossiers ouverts', value: num(n.opened), delta: delta(n.opened, b.opened, 'down') },
    { label: 'Dossiers résolus', value: num(n.closed), delta: delta(n.closed, b.closed, 'up') },
    {
      label: 'En cours en fin de période',
      value: num(n.openAtEnd),
      delta: delta(n.openAtEnd, b.openAtEnd, 'down'),
    },
    {
      label: 'Taux de litiges avérés',
      value: n.provenRate + ' %',
      delta: delta(n.provenRate, b.provenRate, 'down', '%'),
    },
    {
      label: 'Délai moyen de résolution',
      value: num(n.avgDays, 1) + ' j',
      delta: delta(n.avgDays, b.avgDays, 'down', 'j'),
    },
    {
      label: 'Valeur des commandes concernées',
      value: money0(n.orderValue),
      delta: delta(n.orderValue, b.orderValue, 'down'),
    },
    {
      label: 'Fraudes détectées',
      value: num(n.frauds) + (n.fraudValue ? ' · ' + money0(n.fraudValue) : ''),
      delta: delta(n.frauds, b.frauds, 'down'),
    },
    {
      label: 'Avoirs émis',
      value: money0(n.credits) + ' (' + n.creditCount + ')',
      delta: delta(n.credits, b.credits, 'down'),
    },
    {
      label: 'Indemnisations transporteur',
      value: money0(n.compensation),
      delta: delta(n.compensation, b.compensation, 'up'),
    },
  ];
}

// Les 4 classements du rapport : { title, rows: [[libellé, nombre]], total }
export function reportRanks(data) {
  const n = data.now;
  return [
    { title: 'Dossiers ouverts par transporteur', rows: n.byCarrier, total: n.opened },
    { title: 'Dossiers ouverts par enseigne', rows: n.byBrand, total: n.opened },
    { title: 'Types de litige les plus fréquents', rows: n.byType, total: n.opened },
    {
      title: 'Décisions des transporteurs (dossiers résolus)',
      rows: Object.entries(n.decisions),
      total: n.closed,
    },
  ];
}

export const REPORT_NOTE =
  'Ouverts = déclarés pendant la période ; résolus, délais, fraudes et indemnisations = dossiers clôturés pendant la période ; avoirs = avoirs émis pendant la période. Flèches : évolution par rapport à la période précédente (vert = favorable).';

// Nom du fichier PDF : « OptiLitige - Rapport des litiges - octobre 2026.pdf »
export const reportFileName = (title, data) =>
  ('OptiLitige - ' + title + ' - ' + data.period.label)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim() + '.pdf';

// --- Rapports programmés (Paramètres, responsables) -------------------------------------
export function normalizeReports(input, memberEmails = []) {
  if (!Array.isArray(input) || input.length > MAX_REPORTS)
    return { error: MAX_REPORTS + ' rapports programmés au maximum.' };
  const known = new Set(memberEmails.map((e) => String(e).toLowerCase()));
  const ids = new Set();
  const reports = [];
  for (const r of input) {
    const name = String(r?.name || '')
      .trim()
      .slice(0, 80);
    if (!name) return { error: 'Donnez un nom à chaque rapport.' };
    const frequency = r?.frequency === 'weekly' ? 'weekly' : 'monthly';
    const filters = { ...EMPTY_ANALYTICS };
    for (const k of Object.keys(EMPTY_ANALYTICS))
      filters[k] = String(r?.filters?.[k] || '').slice(0, 120);
    const emails = [...new Set((r?.recipients?.emails || []).map((e) => String(e).toLowerCase()))];
    if (emails.some((e) => !known.has(e)))
      return { error: 'Un destinataire de « ' + name + ' » n’a pas de compte.' };
    const roles = [...new Set((r?.recipients?.roles || []).map(String))].filter((x) =>
      REPORT_ROLES.includes(x),
    );
    if (!emails.length && !roles.length)
      return { error: 'Choisissez au moins un destinataire pour « ' + name + ' ».' };
    let id =
      String(r?.id || '')
        .replace(/[^\w-]/g, '')
        .slice(0, 40) || 'rapport';
    while (ids.has(id)) id += '-2';
    ids.add(id);
    reports.push({
      id,
      name,
      frequency,
      filters,
      recipients: { emails, roles },
      active: r?.active !== false,
    });
  }
  return { reports };
}

export const isRecipient = (report, me) =>
  report.active !== false &&
  (report.recipients.emails.includes(String(me?.email || '').toLowerCase()) ||
    report.recipients.roles.includes(me?.role));

// Notifications « Rapports » : le dernier rapport terminé de chaque rapport programmé reçu
export function buildReportAlerts(reports, me, { now = Date.now(), read = new Set() } = {}) {
  return (reports || [])
    .filter((r) => isRecipient(r, me))
    .map((r) => {
      const period = lastClosedPeriod(r.frequency, now);
      const key = 'report:' + r.id + ':' + period.key;
      return {
        key,
        reportId: r.id,
        period,
        record: null,
        date: period.to + 'T07:00:00',
        title: 'Rapport disponible : ' + r.name,
        text: FREQUENCIES[r.frequency] + ' · ' + period.label,
        unread: !read.has(key),
      };
    });
}
