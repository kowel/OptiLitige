import test from 'node:test';
import assert from 'node:assert/strict';
import { ALERT_KEY_PATTERN, buildAlerts } from '../app/alerts.mjs';
import { DEFAULT_SLA } from '../app/sla.mjs';

const now = Date.parse('2026-11-10T12:00:00Z');
const ago = (h) => new Date(now - h * 3600000).toISOString();
const litige = { email: 'litige@x.fr', role: 'Service Litige' };
const rc = { email: 'rc@x.fr', role: 'RC' };
const chef = { email: 'chef@x.fr', role: 'Admin' };

const records = [
  {
    id: 'a',
    ref: 'A',
    title: 'Attribué',
    status: 'Pris en charge',
    created: ago(5),
    assignee: 'litige@x.fr',
    assignedAt: ago(2),
    creator: 'rc@x.fr',
  },
  {
    id: 'b',
    ref: 'B',
    title: 'Attente RC',
    status: 'En attente RC',
    created: ago(50),
    statusSince: ago(3),
    creator: 'rc@x.fr',
  },
  {
    id: 'c',
    ref: 'C',
    title: 'Nouveau en retard',
    status: 'Nouveau',
    created: ago(30),
    creator: 'rc@x.fr',
  },
  {
    id: 'd',
    ref: 'D',
    title: 'Retard collègue',
    status: 'Nouveau',
    created: ago(40),
    assignee: 'autre@x.fr',
    assignedAt: ago(39),
  },
  {
    id: 'e',
    ref: 'E',
    title: 'Résolu',
    status: 'Résolu',
    created: ago(100),
    assignee: 'litige@x.fr',
    assignedAt: ago(90),
  },
];

test('Chaque catégorie ne contient que ce qui concerne l’agent', () => {
  const l = buildAlerts(records, litige, { rules: DEFAULT_SLA, now });
  assert.deepEqual(
    l.assignments.map((a) => a.record.id),
    ['a'],
  ); // pas le dossier résolu
  assert.deepEqual(l.rc, []);
  assert.deepEqual(l.late.map((a) => a.record.id).sort(), ['c', 'd']); // le service litige voit aussi les dossiers suivis par un collègue

  const r = buildAlerts(records, rc, { rules: DEFAULT_SLA, now });
  assert.deepEqual(
    r.rc.map((a) => a.record.id),
    ['b'],
  );
  assert.deepEqual(r.late, []); // la RC ne reçoit pas les retards
  assert.deepEqual(r.assignments, []);

  const c = buildAlerts(records, chef, { rules: DEFAULT_SLA, now });
  assert.deepEqual(c.late.map((a) => a.record.id).sort(), ['c', 'd']);
});

test('Lu / non lu, et retour de la notification si la situation se reproduit', () => {
  const first = buildAlerts(records, litige, { rules: DEFAULT_SLA, now }).assignments[0];
  assert.equal(first.unread, true);
  assert.match(first.key, ALERT_KEY_PATTERN);
  const read = buildAlerts(records, litige, { rules: DEFAULT_SLA, now, readKeys: [first.key] });
  assert.equal(read.assignments[0].unread, false);
  // Nouvelle attribution : nouvelle clé, de nouveau non lue
  const again = records.map((r) => (r.id === 'a' ? { ...r, assignedAt: ago(1) } : r));
  const back = buildAlerts(again, litige, { rules: DEFAULT_SLA, now, readKeys: [first.key] });
  assert.equal(back.assignments[0].unread, true);
});

test('Les clés refusent les valeurs inattendues', () => {
  assert.ok(ALERT_KEY_PATTERN.test('late:abc:prise-en-charge:2026-11-10T12:00:00.000Z'));
  assert.ok(!ALERT_KEY_PATTERN.test('autre:abc'));
  assert.ok(!ALERT_KEY_PATTERN.test('rc:<script>'));
});

test('Avoirs : à traiter, à valider, à émettre, et décision pour le demandeur', () => {
  const credit = (status) => ({
    id: 'k-' + status,
    status,
    amount: 50,
    reason: 'Retard de livraison',
    requestedBy: 'rc@x.fr',
    requestedAt: ago(1),
    statusAt: ago(1),
  });
  const recs = [
    {
      id: 'z',
      ref: 'Z',
      title: 'Avoirs',
      status: 'Résolu',
      created: ago(100),
      credits: ['requested', 'manager', 'accepted', 'refused'].map(credit),
    },
  ];
  const titles = (who) =>
    buildAlerts(recs, who, { rules: [], now }).credits.map((a) => a.title.split(' :')[0]);
  assert.deepEqual(titles(litige).sort(), ['Avoir à traiter', 'Avoir à émettre dans l’ERP'].sort());
  assert.deepEqual(
    titles(chef).sort(),
    ['Avoir à traiter', 'Avoir à valider (admin)', 'Avoir à émettre dans l’ERP'].sort(),
  );
  // Le demandeur (RC) est prévenu des décisions, même sur un dossier résolu
  assert.deepEqual(titles(rc).sort(), [
    'Votre demande d’avoir est acceptée',
    'Votre demande d’avoir est refusée',
  ]);
  const key = buildAlerts(recs, rc, { rules: [], now }).credits[0].key;
  assert.match(key, ALERT_KEY_PATTERN);
});

test('inversion : notification prioritaire pour tous les comptes, jusqu’à lecture ou résolution', () => {
  const inv = {
    id: 'i1',
    ref: 'LIT-1',
    type: 'Inversion',
    status: 'Nouveau',
    created: '2026-11-13T09:00:00Z',
    title: 'x',
  };
  for (const role of ['Relation client', 'SAV', 'Service Litige', 'Responsable', 'Admin']) {
    const a = buildAlerts([inv], { email: 'a@c.fr', role });
    assert.equal(a.priority.length, 1);
    assert.equal(a.priority[0].unread, true);
  }
  assert.match('priority:i1', ALERT_KEY_PATTERN);
  const read = buildAlerts([inv], { email: 'a@c.fr', role: 'SAV' }, { readKeys: ['priority:i1'] });
  assert.equal(read.priority[0].unread, false);
  assert.equal(
    buildAlerts([{ ...inv, status: 'Résolu' }], { email: 'a@c.fr', role: 'SAV' }).priority.length,
    0,
  );
  assert.equal(
    buildAlerts([{ ...inv, type: 'Transport' }], { email: 'a@c.fr', role: 'SAV' }).priority.length,
    0,
  );
});
