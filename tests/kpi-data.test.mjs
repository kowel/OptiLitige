import test from 'node:test';
import assert from 'node:assert/strict';
import { kpiRows, kpiCards } from '../app/kpi-data.mjs';
const rows = [
  { id: 'a', status: 'En attente RC', creator: 'rc', amount: 100 },
  { id: 'b', status: 'Nouveau', creator: 'other', amount: 50 },
  { id: 'c', status: 'Pris en charge', creator: 'rc', assignee: 'agent', amount: 200 },
  {
    id: 'd',
    status: 'Résolu',
    creator: 'rc',
    created: '2026-10-01',
    closed: '2026-10-04',
    creditIssued: true,
    credit: 20.5,
    amount: 70,
  },
  {
    id: 'e',
    status: 'Réouvert',
    creator: 'other',
    created: '2026-10-01',
    closed: '2026-10-05',
    creditNumber: 'AV1',
    credit: 0,
    amount: 30,
  },
  { id: 'f', status: 'Résolu', created: 'invalid', closed: '2026-10-05', credit: 5, amount: 10 },
];
test('RC cards use exact status and creator rather than assigned agent', () => {
  const c = kpiCards(rows, 'RC', 'rc');
  assert.deepEqual(
    c[0].rows.map((r) => r.id),
    ['a'],
  );
  assert.deepEqual(
    c[1].rows.map((r) => r.id),
    ['a', 'c'],
  );
  assert.equal(c[0].value, 1);
  assert.equal(c[1].value, 2);
});
test('litige cards exclude resolved and assigned cases correctly', () => {
  const c = kpiCards(rows, 'Service Litige', 'agent');
  assert.deepEqual(
    c[0].rows.map((r) => r.id),
    ['b'],
  );
  // Deuxième carte : demandes d'avoir en cours (le service litige travaille en équipe,
  // sans attribution)
  assert.equal(c[1].scope, 'Avoirs à traiter');
  const withCredits = [
    ...rows,
    { id: 'z1', status: 'Résolu', credits: [{ status: 'accepted' }] },
    { id: 'z2', status: 'Nouveau', credits: [{ status: 'issued' }] },
  ];
  assert.deepEqual(
    kpiCards(withCredits, 'Service Litige', 'agent')[1].rows.map((r) => r.id),
    ['z1'],
  );
});
test('responsables see all active cases and every command contributing to total', () => {
  const c = kpiCards(rows, 'Admin', 'boss');
  assert.equal(c[0].value, 4);
  assert.equal(c[1].value, 460);
  assert.equal(c[1].rows.length, 6);
});
test('RC : nombre d’avoirs en attente ; Service Litige : montant moyen des litiges', () => {
  const withCredits = [
    { id: 'x', status: 'Nouveau', credits: [{ status: 'requested' }, { status: 'manager' }] },
    { id: 'y', status: 'Résolu', credits: [{ status: 'issued' }] },
    { id: 'w', status: 'Nouveau', amount: 100 },
  ];
  const rc = kpiCards(withCredits, 'SAV', 'rc')[2];
  assert.equal(rc.label, 'Avoirs en attente');
  assert.equal(rc.value, 2);
  assert.equal(rc.kind, 'count');
  const litige = kpiCards(rows, 'Service Litige', 'agent')[2];
  assert.equal(litige.label, 'Montant moyen des litiges');
  assert.equal(litige.kind, 'money');
  assert.equal(litige.value, 460 / 6);
});
test('credit drilldown includes historical credits and zero amount numbered credits', () => {
  const c = kpiCards(rows, 'Admin', 'boss')[2];
  assert.deepEqual(
    c.rows.map((r) => r.id),
    ['d', 'e', 'f'],
  );
  assert.equal(c.value, 25.5);
});
test('average drilldown only includes valid dated resolutions', () => {
  const c = kpiCards(rows, 'RC', 'rc')[3];
  assert.deepEqual(
    c.rows.map((r) => r.id),
    ['d'],
  );
  assert.equal(c.value, 3);
});
test('all cards and dropdown share same live selection across roles', () => {
  for (const role of ['RC', 'Service Litige', 'Responsable', 'Admin'])
    for (const c of kpiCards(rows, role, 'rc'))
      assert.deepEqual(c.rows, kpiRows(rows, c.scope, 'rc'));
  assert.equal(kpiRows(rows, 'Tous les dossiers', 'rc').length, 6);
  for (const c of kpiCards([], 'RC', 'rc')) assert.equal(c.value, 0);
});
