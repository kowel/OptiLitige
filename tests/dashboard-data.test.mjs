import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardData, topGroups } from '../app/dashboard-data.mjs';
const now = new Date('2026-10-28T12:00:00Z');
test('empty dashboards have finite zero metrics', () => {
  const d = buildDashboardData([], [], now);
  assert.equal(d.total, 0);
  assert.equal(d.average, 0);
  assert.equal(d.resolutionRate, 0);
  assert.equal(d.activity.length, 14);
  assert.equal(d.finance[0].value, 0);
});
test('reopened cases stay active; closure dates and amounts are counted', () => {
  const rows = [
    {
      status: 'Résolu',
      created: '2026-10-20T12:00:00Z',
      closed: '2026-10-22T12:00:00Z',
      amount: 100.5,
      credit: 40.25,
      compensation: 20,
    },
    { status: 'Réouvert', created: '2026-10-25T12:00:00Z', amount: '200', credit: 10 },
    { status: 'Résolu', created: 'bad', amount: undefined },
  ];
  const d = buildDashboardData(rows, [], now);
  assert.equal(d.active, 1);
  assert.equal(d.resolved, 2);
  assert.equal(d.datedClosed, 1);
  assert.equal(d.average, 2);
  assert.equal(d.orderTotal, 300.5);
  assert.equal(d.finance[0].value, 50.25);
  assert.equal(d.activity.find((x) => x.key === '2026-10-22').closed, 1);
});
test('age boundaries, assignments and overdue transport followups', () => {
  const rows = [0, 2, 3, 7, 8, 14, 15].map((n, i) => ({
    status: 'Nouveau',
    created: new Date(+now - n * 86400000).toISOString(),
    assignee: i ? 'agent@test.fr' : '',
    origin: 'Transport',
    carrierFollowupAt: '2026-10-28',
    carrierStatus: i ? 'En attente réponse' : 'Clos',
  }));
  const d = buildDashboardData(rows, [{ email: 'agent@test.fr', name: 'Agent' }], now);
  assert.deepEqual(
    d.ages.map((x) => x.value),
    [2, 2, 2, 1],
  );
  assert.equal(d.workload[0].label, 'Agent');
  assert.equal(d.workload[0].value, 6);
  assert.equal(d.relances, 6);
});
test('grouping retains every dossier in other bucket', () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ label: String(i), value: i + 1 }));
  const grouped = topGroups(rows, 3);
  assert.equal(grouped.length, 4);
  assert.equal(grouped.at(-1).label, 'Autres');
  assert.equal(
    grouped.reduce((n, x) => n + x.value, 0),
    36,
  );
});

test('Dossiers ouverts selon le service qui les a créés', async () => {
  const { buildDashboardData } = await import('../app/dashboard-data.mjs');
  const members = [
    { email: 'rc@x.fr', role: 'RC' },
    { email: 'sav@x.fr', role: 'SAV' },
  ];
  const d = buildDashboardData(
    [
      { id: 'a', status: 'Nouveau', creator: 'rc@x.fr', created: '2026-11-01T00:00:00Z' },
      { id: 'b', status: 'Nouveau', creator: 'rc@x.fr', created: '2026-11-01T00:00:00Z' },
      { id: 'c', status: 'Pris en charge', creator: 'sav@x.fr', created: '2026-11-01T00:00:00Z' },
      { id: 'import-x', status: 'Nouveau', creator: 'chef@x.fr', created: '2026-11-01T00:00:00Z' },
      { id: 'd', status: 'Résolu', creator: 'sav@x.fr', created: '2026-11-01T00:00:00Z' },
    ],
    members,
  );
  assert.deepEqual(
    d.sources.map((s) => [s.label, s.value]),
    [
      ['Relation client', 2],
      ['Repris de l’ancienne liste', 1],
      ['SAV', 1],
    ],
  );
});

test('rythme par semaine : 12 semaines du lundi au dimanche', async () => {
  const { buildDashboardData } = await import('../app/dashboard-data.mjs');
  const now = new Date('2026-11-12T10:00:00Z'); // jeudi
  const records = [
    { id: 'a', status: 'Nouveau', created: '2026-11-10T09:00:00Z' },
    { id: 'b', status: 'Résolu', created: '2026-11-03T09:00:00Z', closed: '2026-11-09T20:00:00Z' },
    { id: 'c', status: 'Nouveau', created: '2026-08-01T09:00:00Z' },
  ];
  const d = buildDashboardData(records, [], now);
  assert.equal(d.activityWeeks.length, 12);
  const last = d.activityWeeks[11];
  assert.equal(last.key, '2026-11-09');
  assert.equal(last.opened, 1);
  assert.equal(last.closed, 1);
  assert.equal(d.activityWeeks[10].key, '2026-11-02');
  assert.equal(d.activityWeeks[10].opened, 1);
  assert.equal(
    d.activityWeeks.reduce((n, w) => n + w.opened, 0),
    2,
  );
});
