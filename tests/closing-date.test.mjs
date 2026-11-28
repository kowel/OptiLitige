import test from 'node:test';
import assert from 'node:assert/strict';
import { closedDay, closedDayError, closedFromDay } from '../app/closing-date.mjs';

test('date de clôture choisie : format, pas avant l’ouverture, pas dans le futur', () => {
  const created = '2025-08-21T00:00:00.000Z';
  const now = '2026-11-28T15:00:00.000Z';
  assert.equal(closedDayError('2025-09-03', created, now), null);
  assert.equal(closedDayError('2026-11-28', created, now), null);
  assert.match(closedDayError('2025-08-20', created, now), /précéder/);
  assert.match(closedDayError('2026-11-29', created, now), /futur/);
  assert.match(closedDayError('03/09/2025', created, now), /invalide/);
  assert.match(closedDayError('', created, now), /invalide/);
  // Enregistrée à midi (Paris) : le jour reste le même à l'affichage
  assert.equal(closedDay({ closed: closedFromDay('2025-09-03') }), '2025-09-03');
  assert.equal(closedDay({ closed: null }), '');
});
