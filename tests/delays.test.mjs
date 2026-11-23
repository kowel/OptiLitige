import test from 'node:test';
import assert from 'node:assert/strict';
import { delayAverages, stampMilestones } from '../app/delays.mjs';

test('délais client, transporteur et dossier', () => {
  const r = {
    created: '2026-11-01T10:00:00.000Z',
    carrierSentAt: '2026-11-03T10:00:00.000Z',
    clientStage: 'Solution apportée',
    carrierStatus: 'Clos',
  };
  stampMilestones(r, '2026-11-05T10:00:00.000Z');
  assert.equal(r.clientSolvedAt, '2026-11-05T10:00:00.000Z');
  assert.equal(r.carrierClosedAt, '2026-11-05T10:00:00.000Z');
  // Date gardée tant que l'étape reste atteinte ; retirée si le dossier en ressort
  stampMilestones(r, '2026-11-09T10:00:00.000Z');
  assert.equal(r.clientSolvedAt, '2026-11-05T10:00:00.000Z');
  const d = delayAverages([
    { ...r, status: 'Résolu', closed: '2026-11-11T10:00:00.000Z' },
    { created: '2026-11-01T10:00:00.000Z', status: 'Nouveau' },
  ]);
  assert.deepEqual(d.client, { days: 4, count: 1 });
  assert.deepEqual(d.carrier, { days: 2, count: 1 });
  assert.deepEqual(d.common, { days: 10, count: 1 });
  stampMilestones(r, '2026-11-12T10:00:00.000Z');
  r.clientStage = 'À contacter';
  stampMilestones(r, '2026-11-12T10:00:00.000Z');
  assert.equal(r.clientSolvedAt, null);
});
