import test from 'node:test';
import assert from 'node:assert/strict';
import { carrierCostOf, carrierCostStats, carrierFault } from '../app/carrier-cost.mjs';

const lost = {
  id: 'a',
  ref: 'IMP-1',
  origin: 'Transport',
  carrier: 'CHRONOPOST',
  disputeValue: 3000,
  creditIssued: true,
  credit: 3000,
  compensation: 250,
};

test('PC de 3 000 € perdu, indemnisé 250 € au forfait : 2 750 € à notre charge', () => {
  assert.deepEqual(carrierCostOf(lost), {
    refunded: 3000,
    compensated: 250,
    netLoss: 2750,
    value: 3000,
  });
});

test('Périmètre : faute du transporteur uniquement', () => {
  assert.equal(carrierFault(lost), true);
  assert.equal(carrierFault({ ...lost, origin: 'Interne' }), false);
  assert.equal(carrierFault({ ...lost, imputation: 'Interne' }), false);
  assert.equal(carrierFault({ ...lost, imputation: 'Autre' }), false);
  assert.equal(
    carrierFault({ ...lost, carrierDecision: 'Ne concerne pas le transporteur' }),
    false,
  );
});

test('Par transporteur : remboursé, indemnisé, reste à charge, couverture, plus gros écarts', () => {
  const records = [
    lost,
    // Avoir émis par le circuit des demandes, sans indemnisation
    {
      id: 'b',
      ref: 'IMP-2',
      origin: 'Transport',
      carrier: 'CHRONOPOST',
      credits: [{ status: 'issued', amount: 100, approvedAmount: 80 }],
    },
    // Indemnisé sans avoir (produit renvoyé) : hors couverture, pas de « gain »
    { id: 'c', ref: 'IMP-3', origin: 'Transport', carrier: 'TNT', compensation: 90 },
    // Indemnisation supérieure à l'avoir : reste à charge nul, jamais négatif
    {
      id: 'd',
      ref: 'IMP-4',
      origin: 'Transport',
      carrier: 'TNT',
      creditIssued: true,
      credit: 50,
      compensation: 70,
    },
    // Faute interne : exclu
    {
      id: 'e',
      origin: 'Transport',
      carrier: 'TNT',
      imputation: 'Interne',
      creditIssued: true,
      credit: 999,
    },
  ];
  const { rows, total, top } = carrierCostStats(records);
  assert.deepEqual(
    rows.map((r) => r.key),
    ['CHRONOPOST', 'TNT'],
  );
  const chrono = rows[0];
  assert.equal(chrono.dossiers, 2);
  assert.equal(chrono.refunded, 3080);
  assert.equal(chrono.covered, 250);
  assert.equal(chrono.netLoss, 2830);
  assert.equal(chrono.coverageRate, 8);
  assert.equal(chrono.avgCompensation, 250);
  const tnt = rows[1];
  assert.equal(tnt.dossiers, 2);
  assert.equal(tnt.refunded, 50);
  assert.equal(tnt.compensated, 160);
  assert.equal(tnt.covered, 70);
  assert.equal(tnt.netLoss, 0);
  assert.equal(total.dossiers, 4);
  assert.equal(total.netLoss, 2830);
  assert.deepEqual(
    top.map((t) => t.record.ref),
    ['IMP-1', 'IMP-2'],
  );
});
