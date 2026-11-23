import test from 'node:test';
import assert from 'node:assert/strict';
import { isFraud, outcomeStats } from '../app/outcomes.mjs';
import { groupStats } from '../app/stats.mjs';

const records = [
  { type: 'Produit manquant', outcome: 'Fraude étiquette', status: 'Résolu', disputeValue: 120 },
  { type: 'Produit manquant', outcome: 'Fraude étiquette', status: 'Résolu', amount: 80 },
  { type: 'Livraison endommagé', outcome: 'Colis perdu', status: 'Résolu' },
  {
    type: 'Contestation de livraison',
    outcome: 'Contestation de livraison',
    status: 'Résolu',
  },
  { type: 'Transport', outcome: '', status: 'Résolu' },
  { type: 'Transport', outcome: '', status: 'Nouveau' },
];

test('une fraude est reconnue quel que soit le libellé', () => {
  assert.equal(isFraud('Fraude mauvais produit reçu'), true);
  assert.equal(isFraud('FRAUDE au retour'), true);
  assert.equal(isFraud('Colis perdu'), false);
  assert.equal(isFraud(''), false);
});

test('résultats des litiges : fraudes, requalifications, répartition', () => {
  const s = outcomeStats(records);
  assert.equal(s.qualified, 4);
  assert.equal(s.toQualify, 1); // clôturé sans résultat ; le dossier « Nouveau » ne compte pas
  assert.equal(s.fraud, 2);
  assert.equal(s.fraudRate, 50);
  assert.equal(s.fraudValue, 200); // valeur du litige, sinon montant de la commande
  assert.equal(s.requalified, 3); // « Contestation de livraison » garde son type
  assert.deepEqual(s.byOutcome[0], {
    outcome: 'Fraude étiquette',
    count: 2,
    share: 50,
    fraud: true,
  });
  assert.deepEqual(s.moves[0], { from: 'Produit manquant', to: 'Fraude étiquette', count: 2 });
});

test('aucun dossier qualifié : taux vides', () => {
  const s = outcomeStats([]);
  assert.equal(s.qualified, 0);
  assert.equal(s.fraudRate, null);
  assert.deepEqual(s.moves, []);
});

test('statistiques par magasin : enseigne MAGASIN uniquement', () => {
  const { rows } = groupStats(
    [
      { brand: 'MAGASIN', store: 'NANTES' },
      { brand: 'MAGASIN', store: 'NANTES' },
      { brand: 'MAGASIN', store: 'PAU' },
      { brand: 'CYBERTEK' },
    ],
    'store',
  );
  assert.deepEqual(
    rows.map((r) => [r.key, r.total]),
    [
      ['NANTES', 2],
      ['PAU', 1],
    ],
  );
});

test('statistiques regroupées par résultat du litige', () => {
  const { rows } = groupStats(records, 'outcome');
  assert.equal(rows[0].key, 'À qualifier');
  assert.equal(rows[0].total, 2);
  assert.equal(rows.find((r) => r.key === 'Fraude étiquette').total, 2);
});
