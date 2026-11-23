import test from 'node:test';
import assert from 'node:assert/strict';
import { dateTime, importInfo } from '../app/datetime.mjs';

test('Date et heure affichées à l’heure de Paris', () => {
  assert.equal(dateTime('2026-11-06T12:34:00.000Z'), '06/11/2026 à 13:34'); // heure d'hiver
  assert.equal(dateTime('2026-07-01T06:05:00.000Z'), '01/07/2026 à 08:05'); // heure d'été
  assert.equal(dateTime('2026-12-31T23:30:00.000Z'), '01/01/2027 à 00:30');
  assert.equal(dateTime(''), '—');
  assert.equal(dateTime('pas une date'), '—');
});

test('Date d’import : champ dédié, sinon ligne d’historique', () => {
  assert.deepEqual(importInfo({ importedAt: '2026-11-06T10:00:00Z', importFile: 'SAV.xlsx' }), {
    date: '2026-11-06T10:00:00Z',
    file: 'SAV.xlsx',
  });
  assert.deepEqual(
    importInfo({
      history: [
        { date: '2025-01-01T00:00:00Z', text: 'Ouverture selon la source Microsoft Lists' },
        {
          date: '2026-10-02T08:15:00Z',
          text: 'Import depuis Litiges 2025.xlsx · statut repris : Résolu',
        },
      ],
    }),
    { date: '2026-10-02T08:15:00Z', file: 'Litiges 2025.xlsx' },
  );
  assert.equal(importInfo({ history: [{ date: 'x', text: 'Dossier créé' }] }), null);
});
