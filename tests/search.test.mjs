import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSearch, sameOrderRecords } from '../app/search.mjs';
import { dateValue } from '../app/import-logic.mjs';

const dossier = {
  id: 'a',
  title: 'Écran fissuré à réception',
  ref: 'LIT-2026-ABC123',
  order: 'CMD-84752',
  customer: 'Léa Bernard',
  type: 'Casse',
  ticket: 'TK-5521',
  bt: 'BT998',
  creditNumber: 'AV-2026-0042',
  invoice: 'FA-77810',
  carrierCaseRef: 'DPD-RECL-3141',
  carrier: 'DPD',
};

test('Recherche sur ticket, BT, avoir, facture et réclamation transporteur', () => {
  for (const q of ['TK-5521', 'bt998', 'AV-2026-0042', 'fa-77810', 'DPD-RECL-3141'])
    assert.equal(matchesSearch(dossier, q), true, q);
  assert.equal(matchesSearch(dossier, 'INCONNU-1'), false);
});

test('Recherche sans accents, en plusieurs mots', () => {
  assert.equal(matchesSearch(dossier, 'ecran fissure'), true);
  assert.equal(matchesSearch(dossier, 'lea 84752'), true);
  assert.equal(matchesSearch(dossier, 'dpd colissimo'), false);
  assert.equal(matchesSearch(dossier, '   '), true);
});

test('Doublons de commande', () => {
  const records = [
    dossier,
    { id: 'b', order: 'cmd 84752' },
    { id: 'c', order: 'CMD-11111' },
    { id: 'd', order: 'Non renseigné (import)' },
    { id: 'e', order: 'Non renseigné (import)' },
  ];
  assert.deepEqual(
    sameOrderRecords(records, ' CMD-84752 ').map((r) => r.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    sameOrderRecords(records, 'CMD-84752', 'a').map((r) => r.id),
    ['b'],
  );
  assert.deepEqual(sameOrderRecords(records, 'Non renseigné (import)'), []);
  assert.deepEqual(sameOrderRecords(records, 'C'), []);
});

test('Dates Excel : cellule date, texte et numéro de série donnent la même valeur', () => {
  const attendu = '2025-04-02T00:00:00.000Z';
  assert.equal(dateValue(new Date(2025, 3, 2)), attendu); // cellule date (heure locale)
  assert.equal(dateValue('02/04/2025'), attendu); // texte
  assert.equal(dateValue(45749), attendu); // numéro de série
  assert.equal(dateValue(new Date(2025, 2, 14, 9, 30)), '2025-03-14T09:30:00.000Z');
});
