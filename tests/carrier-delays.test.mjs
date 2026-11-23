import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  autoCarrierDates,
  nextFollowup,
  normalizeCarrierDelays,
} from '../app/carrier-delays.mjs';

const D = { followupDays: 7, responseDays: 15 };

test('dates calculées à la saisie de la transmission', () => {
  assert.deepEqual(autoCarrierDates({}, '2026-11-12', D), {
    carrierSentAt: '2026-11-12',
    carrierFollowupAt: '2026-11-19',
    carrierResponseDue: '2026-11-27',
  });
  assert.equal(addDays('2026-12-28', 7), '2027-01-04');
});

test('une date modifiée à la main n’est pas écrasée', () => {
  const current = {
    carrierSentAt: '2026-11-12',
    carrierFollowupAt: '2026-11-17', // changée par l'agent
    carrierResponseDue: '2026-11-27', // calculée
  };
  const patch = autoCarrierDates(current, '2026-11-13', D);
  assert.equal(patch.carrierFollowupAt, undefined);
  assert.equal(patch.carrierResponseDue, '2026-11-28');
});

test('relance faite et réglages', () => {
  assert.equal(nextFollowup('2026-11-12', D), '2026-11-19');
  assert.ok(normalizeCarrierDelays({ followupDays: 0, responseDays: 15 }).error);
  assert.deepEqual(normalizeCarrierDelays({ followupDays: 5, responseDays: 21 }).delays, {
    followupDays: 5,
    responseDays: 21,
  });
});
