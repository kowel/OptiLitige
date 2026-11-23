// Période d'ouverture des dossiers utilisée par les filtres (liste, analyses, statistiques).
// Valeurs possibles : '7', '30', '90' (derniers jours), '99999' (toute la période) ou
// 'custom:AAAA-MM-JJ:AAAA-MM-JJ' (dates choisies, bornes incluses, jours à l'heure de Paris).

export const PERIOD_PRESETS = [
  ['7', '7 derniers jours'],
  ['30', '30 derniers jours'],
  ['90', '90 derniers jours'],
  ['99999', 'Toute la période'],
];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// Jour calendaire à Paris d'une date ISO : « 2026-11-09 »
export function parisDay(value) {
  const d = new Date(value);
  return isNaN(+d) ? '' : d.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
}

export const customPeriod = (from, to) => 'custom:' + (from || '') + ':' + (to || '');

export function parsePeriod(period) {
  const p = String(period ?? '');
  if (p.startsWith('custom:')) {
    const [, from = '', to = ''] = p.split(':');
    return {
      kind: 'custom',
      from: ISO_DAY.test(from) ? from : '',
      to: ISO_DAY.test(to) ? to : '',
    };
  }
  if (p === '99999' || !Number(p)) return { kind: 'all' };
  return { kind: 'days', days: Number(p) };
}

// Le dossier créé à `created` est-il dans la période ?
export function inPeriod(created, period, now = Date.now()) {
  const p = parsePeriod(period);
  if (p.kind === 'all') return true;
  if (p.kind === 'days') return (now - new Date(created).getTime()) / 86400000 <= p.days;
  const day = parisDay(created);
  if (!day) return false;
  // Une borne vide laisse la période ouverte de ce côté ; des bornes inversées sont remises
  // dans l'ordre
  const [from, to] = p.from && p.to && p.from > p.to ? [p.to, p.from] : [p.from, p.to];
  return (!from || day >= from) && (!to || day <= to);
}

// Libellé lisible : « du 01/11/2026 au 09/11/2026 »
export function periodLabel(period) {
  const p = parsePeriod(period);
  if (p.kind !== 'custom') return PERIOD_PRESETS.find(([v]) => v === String(period))?.[1] || '';
  const fr = (d) => d.split('-').reverse().join('/');
  if (p.from && p.to) return 'du ' + fr(p.from) + ' au ' + fr(p.to);
  if (p.from) return 'depuis le ' + fr(p.from);
  if (p.to) return 'jusqu’au ' + fr(p.to);
  return 'toutes les dates';
}
