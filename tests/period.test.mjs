import test from 'node:test';
import assert from 'node:assert/strict';
import { customPeriod, inPeriod, parsePeriod, periodLabel } from '../app/period.mjs';

const now = Date.parse('2026-11-09T12:00:00Z');

test('Périodes prédéfinies', () => {
  assert.equal(inPeriod('2026-11-05T10:00:00Z', '7', now), true);
  assert.equal(inPeriod('2026-10-01T10:00:00Z', '7', now), false);
  assert.equal(inPeriod('2020-01-01T10:00:00Z', '99999', now), true);
  assert.equal(parsePeriod('30').days, 30);
});

test('Dates personnalisées : bornes incluses, à l’heure de Paris', () => {
  const p = customPeriod('2026-11-01', '2026-11-05');
  assert.equal(inPeriod('2026-11-01T00:30:00+01:00', p), true); // 1er novembre à Paris
  assert.equal(inPeriod('2026-10-31T23:30:00Z', p), true); // déjà le 1er à Paris (00:30)
  assert.equal(inPeriod('2026-10-31T22:30:00Z', p), false); // encore le 31 à Paris
  assert.equal(inPeriod('2026-11-05T22:59:00Z', p), true); // 23:59 le 5 à Paris
  assert.equal(inPeriod('2026-11-05T23:00:00Z', p), false); // le 6 à Paris
});

test('Bornes vides ou inversées', () => {
  assert.equal(inPeriod('2026-01-01T12:00:00Z', customPeriod('', '2026-02-01')), true);
  assert.equal(inPeriod('2026-03-01T12:00:00Z', customPeriod('', '2026-02-01')), false);
  assert.equal(inPeriod('2026-03-01T12:00:00Z', customPeriod('2026-02-01', '')), true);
  assert.equal(inPeriod('2026-11-03T12:00:00Z', customPeriod('2026-11-05', '2026-11-01')), true);
  assert.equal(inPeriod('pas une date', customPeriod('2026-11-01', '2026-11-05')), false);
});

test('Libellés', () => {
  assert.equal(periodLabel('30'), '30 derniers jours');
  assert.equal(
    periodLabel(customPeriod('2026-11-01', '2026-11-09')),
    'du 01/11/2026 au 09/11/2026',
  );
  assert.equal(periodLabel(customPeriod('2026-11-01', '')), 'depuis le 01/11/2026');
});
