import { stakeOf } from './advanced-filters.mjs';
import { creditToday } from './credit.mjs';
import { delayAverages } from './delays.mjs';
export const dashboardStatuses = [
  'Nouveau',
  'Pris en charge',
  'En attente RC',
  'Résolu',
  'Réouvert',
];
export const dashboardColors = [
  '#7857e8',
  '#3983ee',
  '#eeaa35',
  '#17b399',
  '#ef6f83',
  '#4babc4',
  '#a47be8',
];
function amount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
// Regroupe les dossiers : nombre (par défaut) ou somme d'une valeur (weight, en euros)
function group(rows, pick, weight = () => 1) {
  const counts = new Map();
  for (const row of rows) {
    const label = String(pick(row) || 'Non renseigné').trim() || 'Non renseigné';
    counts.set(label, Math.round(((counts.get(label) || 0) + weight(row)) * 100) / 100);
  }
  return [...counts]
    .map(([label, value], i) => ({
      label,
      value,
      color: dashboardColors[i % dashboardColors.length],
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'fr'));
}
export function topGroups(rows, limit = 5) {
  if (rows.length <= limit) return rows;
  return [
    ...rows.slice(0, limit),
    {
      label: 'Autres',
      value: rows.slice(limit).reduce((n, r) => n + r.value, 0),
      color: '#a4adbd',
    },
  ];
}
export function buildDashboardData(records, members = [], now = new Date()) {
  const today = creditToday(now),
    base = new Date(today + 'T12:00:00Z');
  const active = records.filter((r) => r.status !== 'Résolu'),
    resolved = records.filter((r) => r.status === 'Résolu'),
    transport = active.filter((r) => r.origin === 'Transport');
  const dateKey = (value) => {
    if (!value || !Number.isFinite(+new Date(value))) return null;
    return creditToday(new Date(value));
  };
  // Ouvertures et clôtures par jour : la date de chaque dossier est calculée une seule fois
  // (auparavant 28 fois par dossier, soit plus d'une seconde pour 1 000 dossiers)
  const openedByDay = new Map(),
    closedByDay = new Map();
  // Lundi de la semaine en cours, puis 12 semaines en arrière (vue « par semaine »)
  const weekday = (base.getUTCDay() + 6) % 7; // lundi = 0
  const monday = new Date(+base - weekday * 86400000);
  const firstMonday = new Date(+monday - 11 * 7 * 86400000);
  // Veille du premier jour affiché (marge pour le décalage horaire de Paris)
  const since = new Date(Math.min(+base - 14 * 86400000, +firstMonday - 86400000))
    .toISOString()
    .slice(0, 10);
  for (const r of records) {
    // Dates trop anciennes ignorées sans conversion (comparaison de texte ISO)
    if (r.created && String(r.created) >= since) {
      const k = dateKey(r.created);
      if (k) openedByDay.set(k, (openedByDay.get(k) || 0) + 1);
    }
    if (r.closed && String(r.closed) >= since) {
      const k = dateKey(r.closed);
      if (k) closedByDay.set(k, (closedByDay.get(k) || 0) + 1);
    }
  }
  // Par semaine : somme des 7 jours, du lundi au dimanche
  const sumWeek = (map, start) => {
    let n = 0;
    for (let j = 0; j < 7; j++)
      n += map.get(new Date(+start + j * 86400000).toISOString().slice(0, 10)) || 0;
    return n;
  };
  const dm = (d) => d.toISOString().slice(8, 10) + '/' + d.toISOString().slice(5, 7);
  const activityWeeks = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(+firstMonday + i * 7 * 86400000),
      end = new Date(+start + 6 * 86400000);
    return {
      key: start.toISOString().slice(0, 10),
      label: dm(start),
      title:
        i === 11
          ? 'Semaine en cours (depuis le ' + dm(start) + ')'
          : 'Semaine du ' + dm(start) + ' au ' + dm(end),
      opened: sumWeek(openedByDay, start),
      closed: sumWeek(closedByDay, start),
    };
  });
  const activity = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(+base + (i - 13) * 86400000),
      key = d.toISOString().slice(0, 10);
    return {
      key,
      label: key.slice(8, 10) + '/' + key.slice(5, 7),
      opened: openedByDay.get(key) || 0,
      closed: closedByDay.get(key) || 0,
    };
  });
  const statuses = dashboardStatuses.map((label, i) => ({
    label,
    value: records.filter((r) => r.status === label).length,
    color: dashboardColors[i],
  }));
  const origins = ['Transport', 'Interne'].map((label, i) => ({
    label,
    value: records.filter((r) => r.origin === label).length,
    color: i ? '#7857e8' : '#3983ee',
  }));
  const ageRows = [
    { label: '0 à 2 jours', value: 0, color: '#17b399' },
    { label: '3 à 7 jours', value: 0, color: '#3983ee' },
    { label: '8 à 14 jours', value: 0, color: '#eeaa35' },
    { label: '15 jours et plus', value: 0, color: '#ef6f83' },
  ];
  let unknownAge = 0;
  for (const r of active) {
    if (!r.created || !Number.isFinite(+new Date(r.created))) {
      unknownAge++;
      continue;
    }
    const age = Math.max(0, Math.floor((+new Date(now) - +new Date(r.created)) / 86400000));
    ageRows[age <= 2 ? 0 : age <= 7 ? 1 : age <= 14 ? 2 : 3].value++;
  }
  if (unknownAge) ageRows.push({ label: 'Date inconnue', value: unknownAge, color: '#a4adbd' });
  const memberByEmail = new Map(members.map((m) => [m.email, m]));
  const workload = topGroups(
    group(active, (r) =>
      r.assignee ? memberByEmail.get(r.assignee)?.name || r.assignee : 'Non attribué',
    ),
    5,
  );
  // Dossiers ouverts selon le service de leur propriétaire (créateur du dossier)
  const sources = group(active, (r) => {
    const role = memberByEmail.get(r.creator)?.role;
    return role === 'RC'
      ? 'Relation client'
      : role === 'SAV'
        ? 'SAV'
        : role
          ? role
          : String(r.id || '').startsWith('import-')
            ? 'Repris de l’ancienne liste'
            : 'Autre';
  });
  const brandOf = (r) => (r.brand || 'Non renseignée').toUpperCase(),
    carrierOf = (r) => (r.carrier || 'Non renseigné').toUpperCase(),
    fromTransport = records.filter((r) => r.origin === 'Transport');
  const brands = topGroups(group(records, brandOf), 6),
    // Mêmes répartitions en valeur : montant en jeu des dossiers (stakeOf)
    brandsValue = topGroups(group(records, brandOf, stakeOf), 6),
    typesValue = topGroups(
      group(records, (r) => r.type, stakeOf),
      5,
    ),
    carriersValue = topGroups(group(fromTransport, carrierOf, stakeOf), 5),
    brandsTop3 = topGroups(group(records, brandOf), 3),
    carriersTop3 = topGroups(group(fromTransport, carrierOf), 3),
    types = topGroups(
      group(records, (r) => r.type),
      5,
    ),
    activeTypes = topGroups(
      group(active, (r) => r.type),
      5,
    ),
    carriers = topGroups(
      group(
        records.filter((r) => r.origin === 'Transport'),
        (r) => (r.carrier || 'Non renseigné').toUpperCase(),
      ),
      5,
    ),
    transportStages = topGroups(
      group(transport, (r) => r.carrierStatus || 'Non renseigné'),
      5,
    );
  const relances = transport.filter(
    (r) =>
      r.carrierStatus !== 'Clos' &&
      r.carrierStatus !== 'Réponse reçue' &&
      r.carrierFollowupAt &&
      String(r.carrierFollowupAt).slice(0, 10) <= today,
  ).length;
  const datedClosed = resolved.filter(
    (r) =>
      r.closed &&
      r.created &&
      Number.isFinite(+new Date(r.closed)) &&
      Number.isFinite(+new Date(r.created)) &&
      new Date(r.closed) >= new Date(r.created),
  );
  const average = datedClosed.length
    ? datedClosed.reduce((n, r) => n + (new Date(r.closed) - new Date(r.created)) / 86400000, 0) /
      datedClosed.length
    : 0;
  const finance = [
    {
      label: 'Avoirs enregistrés',
      value: records.reduce((n, r) => n + amount(r.credit), 0),
      color: '#7857e8',
    },
    {
      label: 'Indemnisations reçues',
      value: records.reduce((n, r) => n + amount(r.compensation), 0),
      color: '#17b399',
    },
  ];
  // Montant des avoirs : avoirs émis (circuit des demandes), ou montant saisi sur le dossier
  const creditTotal = records.reduce((n, r) => {
    const issued = (r.credits || []).filter((c) => c.status === 'issued');
    return (
      n +
      (issued.length
        ? issued.reduce((s, c) => s + amount(c.approvedAmount ?? c.amount), 0)
        : r.creditIssued
          ? amount(r.credit)
          : 0)
    );
  }, 0);
  return {
    total: records.length,
    brandsValue,
    typesValue,
    carriersValue,
    brandsTop3,
    carriersTop3,
    creditTotal: Math.round(creditTotal * 100) / 100,
    averageStake: records.length ? records.reduce((n, r) => n + stakeOf(r), 0) / records.length : 0,
    delays: delayAverages(records),
    active: active.length,
    resolved: resolved.length,
    resolutionRate: records.length ? Math.round((resolved.length / records.length) * 100) : 0,
    statuses,
    origins,
    activity,
    activityWeeks,
    ages: ageRows,
    workload,
    sources,
    brands,
    types,
    activeTypes,
    carriers,
    transportStages,
    relances,
    average,
    datedClosed: datedClosed.length,
    finance,
    orderTotal: records.reduce((n, r) => n + stakeOf(r), 0),
    creditCount: records.filter((r) => r.creditIssued).length,
  };
}
