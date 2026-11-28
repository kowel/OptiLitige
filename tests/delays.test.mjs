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

test('dossiers repris de SharePoint : fin estimée à la clôture (ou réponse transporteur)', () => {
  const base = { importedAt: '2026-11-01T00:00:00Z', created: '2026-10-01T00:00:00Z' };
  const rows = [
    // solution client et transporteur clos, dossier résolu : fin = clôture
    {
      ...base,
      status: 'Résolu',
      closed: '2026-10-11T00:00:00Z',
      clientStage: 'Solution apportée',
      carrierStatus: 'Clos',
      carrierSentAt: '2026-10-03T00:00:00Z',
    },
    // transporteur clos, dossier encore ouvert : fin = réponse du transporteur
    {
      ...base,
      status: 'Pris en charge',
      carrierStatus: 'Clos',
      carrierSentAt: '2026-10-03T00:00:00Z',
      carrierReplyAt: '2026-10-07T00:00:00Z',
    },
    // créé dans l'outil, sans date posée : pas d'estimation
    {
      created: '2026-10-01T00:00:00Z',
      status: 'Résolu',
      closed: '2026-10-05T00:00:00Z',
      clientStage: 'Solution apportée',
      carrierStatus: 'Clos',
      carrierSentAt: '2026-10-02T00:00:00Z',
    },
  ];
  const a = delayAverages(rows);
  assert.deepEqual(a.client, { days: 10, count: 1 });
  assert.deepEqual(a.carrier, { days: 6, count: 2 }); // (8 + 4) / 2
});
