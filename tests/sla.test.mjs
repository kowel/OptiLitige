import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SLA,
  formatHours,
  isLate,
  lateRules,
  normalizeSla,
  splitDuration,
} from '../app/sla.mjs';

const now = Date.parse('2026-11-10T12:00:00Z');
const h = (n) => new Date(now - n * 3600000).toISOString();

test('Prise en charge : un dossier « Nouveau » de plus de 24 h est en retard', () => {
  assert.equal(isLate({ status: 'Nouveau', created: h(23) }, DEFAULT_SLA, now), false);
  const late = lateRules({ status: 'Nouveau', created: h(30) }, DEFAULT_SLA, now);
  assert.equal(late.length, 1);
  assert.equal(late[0].rule.id, 'prise-en-charge');
  assert.equal(Math.round(late[0].overdueHours), 6);
  // Une fois pris en charge, la règle ne s'applique plus
  assert.equal(isLate({ status: 'Pris en charge', created: h(30) }, DEFAULT_SLA, now), false);
});

test('Le temps dans un statut part du dernier changement de statut', () => {
  const rules = [
    {
      id: 'rc',
      label: 'Réponse RC',
      kind: 'status',
      status: 'En attente RC',
      hours: 48,
      enabled: true,
    },
  ];
  assert.equal(
    isLate({ status: 'En attente RC', created: h(500), statusSince: h(10) }, rules, now),
    false,
  );
  assert.equal(
    isLate({ status: 'En attente RC', created: h(500), statusSince: h(50) }, rules, now),
    true,
  );
});

test('Réponse transporteur : 15 jours après la transmission, sauf réponse reçue', () => {
  const sent = { status: 'Pris en charge', created: h(800), carrierSentAt: h(16 * 24) };
  assert.equal(isLate(sent, DEFAULT_SLA, now), true);
  assert.equal(isLate({ ...sent, carrierReplyAt: h(1) }, DEFAULT_SLA, now), false);
  assert.equal(isLate({ ...sent, carrierSentAt: h(14 * 24) }, DEFAULT_SLA, now), false);
});

test('Dossiers résolus et règles désactivées ignorés', () => {
  assert.equal(isLate({ status: 'Résolu', created: h(1000) }, DEFAULT_SLA, now), false);
  const off = DEFAULT_SLA.map((r) => ({ ...r, enabled: false }));
  assert.equal(isLate({ status: 'Nouveau', created: h(100) }, off, now), false);
});

test('Validation des règles envoyées par un responsable', () => {
  assert.deepEqual(normalizeSla(DEFAULT_SLA).rules, DEFAULT_SLA);
  assert.match(normalizeSla([{ label: '', kind: 'total', hours: 5 }]).error, /nom/);
  assert.match(normalizeSla([{ label: 'X', kind: 'autre', hours: 5 }]).error, /inconnue/);
  assert.match(
    normalizeSla([{ label: 'X', kind: 'status', status: 'Résolu', hours: 5 }]).error,
    /statut/,
  );
  assert.match(normalizeSla([{ label: 'X', kind: 'total', hours: 0 }]).error, /1 heure/);
  const dup = normalizeSla([
    { id: 'a', label: 'A', kind: 'total', hours: 10 },
    { id: 'a', label: 'B', kind: 'total', hours: 10.4 },
  ]).rules;
  assert.deepEqual(
    dup.map((r) => r.id),
    ['a', 'a-2'],
  );
  assert.equal(dup[1].hours, 10);
});

test('Affichage des durées', () => {
  assert.equal(formatHours(0.5), '30 min');
  assert.equal(formatHours(6.2), '6 h');
  assert.equal(formatHours(53), '2 j 5 h');
  assert.deepEqual(splitDuration(360), { value: 15, unit: 'jours' });
  assert.deepEqual(splitDuration(36), { value: 36, unit: 'heures' });
  assert.deepEqual(splitDuration(24), { value: 24, unit: 'heures' });
});
