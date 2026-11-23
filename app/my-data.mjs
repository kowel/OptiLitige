// « Ma data » (Relation client et SAV) : chiffres des dossiers créés par l'agent.
import { buildDashboardData } from './dashboard-data.mjs';
import { delayAverages } from './delays.mjs';

const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

export function myData(records) {
  const d = buildDashboardData(records);
  const byMonth = new Map();
  for (const r of records) {
    const k = String(r.created || '').slice(0, 7);
    if (k) byMonth.set(k, (byMonth.get(k) || 0) + 1);
  }
  return {
    total: d.total,
    open: d.active,
    resolved: d.resolved,
    waitingRc: records.filter((r) => r.status === 'En attente RC').length,
    clientDays: delayAverages(records).client.days,
    statuses: d.statuses,
    types: d.types,
    brands: d.brands,
    months: [...byMonth.keys()].sort().map((k) => ({
      label: MONTHS[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(2, 4),
      value: byMonth.get(k),
    })),
  };
}
