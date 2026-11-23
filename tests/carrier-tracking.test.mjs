import test from 'node:test';
import assert from 'node:assert/strict';
import {
  carrierSide,
  clientSide,
  indemnityGap,
  isAnticipatedCredit,
  mergeShipments,
  nextCarrierStep,
  normalizeShipments,
  shipmentsFor,
  trackingCsv,
  trackingRow,
} from '../app/carrier-tracking.mjs';
import { groupStats } from '../app/stats.mjs';

const base = { origin: 'Transport', carrier: 'COLISSIMO', status: 'Pris en charge' };

test('statuts côté client et côté transporteur', () => {
  assert.equal(clientSide({ status: 'Résolu' }), 'Terminé');
  assert.equal(clientSide({ status: 'En attente RC' }), 'En cours');
  assert.equal(carrierSide({ ...base }), 'À transmettre');
  assert.equal(carrierSide({ ...base, carrierSentAt: '2026-11-01' }), 'En cours');
  assert.equal(carrierSide({ ...base, carrierDecision: 'Refusé' }), 'Refusé');
  assert.equal(carrierSide({ origin: 'Interne' }), 'Sans objet');
});

test('écart d’indemnisation', () => {
  assert.equal(indemnityGap({ disputeValue: 649.94, compensation: 400 }), 249.94);
  assert.equal(indemnityGap({ disputeValue: 100, compensation: 100 }), 0);
  // Imputation interne : la faute est de notre côté, pas d'écart à réclamer au transporteur
  assert.equal(
    indemnityGap({ disputeValue: 649.94, compensation: 0, imputation: 'Interne' }),
    null,
  );
  // Autre (point relais…) : pas non plus d'écart à réclamer au transporteur
  assert.equal(indemnityGap({ disputeValue: 649.94, compensation: 0, imputation: 'Autre' }), null);
  assert.equal(
    indemnityGap({ disputeValue: 649.94, compensation: 0, imputation: 'Transporteur' }),
    649.94,
  );
  assert.equal(indemnityGap({ disputeValue: 0, compensation: 50 }), null);
});

test('avoir anticipé : émis avant la réponse du transporteur ou sans réponse', () => {
  const credit = { ...base, creditIssued: true, creditCreated: '2026-01-17' };
  assert.equal(isAnticipatedCredit(credit), true);
  assert.equal(isAnticipatedCredit({ ...credit, carrierReplyAt: '2026-01-20' }), true);
  assert.equal(isAnticipatedCredit({ ...credit, carrierReplyAt: '2026-01-10' }), false);
  assert.equal(isAnticipatedCredit({ ...base }), false);
  assert.equal(isAnticipatedCredit({ ...credit, origin: 'Interne' }), false);
  // Avoir émis par le circuit des demandes d'avoir
  assert.equal(
    isAnticipatedCredit({
      ...base,
      carrierReplyAt: '2026-02-20',
      credits: [{ status: 'issued', issue: { date: '2026-02-01' } }],
    }),
    true,
  );
});

test('prochaine étape côté transporteur', () => {
  assert.equal(
    nextCarrierStep({ ...base, carrierFollowupAt: '2026-01-17' }),
    'Relance le 17/01/2026',
  );
  assert.equal(
    nextCarrierStep({ ...base, carrierResponseDue: '2026-01-20' }),
    'Réponse prévue le 20/01/2026',
  );
  assert.equal(nextCarrierStep({ ...base, carrierDecision: 'Accepté' }), 'Décision : accepté');
});

test('ligne et export du suivi de bout en bout', () => {
  const r = {
    ...base,
    order: '5870522',
    brand: 'GB',
    created: '2026-01-02T09:00:00Z',
    disputeValue: 79.94,
    compensation: 0,
    creditNumber: '160043',
    creditCreated: '2026-01-17',
    creditIssued: true,
    carrierSentAt: '2026-01-03',
  };
  const row = trackingRow(r);
  assert.equal(row.clientSide, 'En cours');
  assert.equal(row.carrierSide, 'En cours');
  assert.equal(row.gap, 79.94);
  assert.equal(row.anticipated, true);
  const csv = trackingCsv([r]);
  assert.ok(csv.includes('"N° de commande"'));
  assert.ok(csv.includes('"79,94"'));
  assert.ok(csv.includes('"02/01/2026"'));
});

test('expéditions : contrôle, fusion, totaux', () => {
  assert.ok(normalizeShipments([{ month: '2026-13', carrier: 'X', count: 1 }]).error);
  assert.ok(normalizeShipments([{ month: '2026-11', carrier: 'X', count: -1 }]).error);
  const { months } = normalizeShipments([
    { month: '2026-11', carrier: 'Colissimo', count: 1000 },
    { month: '2026-11', carrier: 'TNT', count: 200 },
  ]);
  assert.deepEqual(months, { '2026-11': { COLISSIMO: 1000, TNT: 200 } });
  const merged = mergeShipments(
    { '2026-10': { COLISSIMO: 900 }, '2026-11': { COLISSIMO: 1, FEDEX: 5 } },
    months,
  );
  assert.deepEqual(merged['2026-11'], { COLISSIMO: 1000, FEDEX: 5, TNT: 200 });
  assert.equal(shipmentsFor(merged, 'colissimo'), 1900);
  assert.equal(
    shipmentsFor(merged, 'COLISSIMO', (m) => m === '2026-11'),
    1000,
  );
  assert.equal(shipmentsFor(merged, 'GEODIS'), null);
});

test('statistiques : acceptés / refusés, écart, avoirs anticipés, litiges / expéditions', () => {
  const records = [
    { ...base, carrierDecision: 'Accepté', disputeValue: 100, compensation: 100 },
    { ...base, carrierDecision: 'Refusé', disputeValue: 50, compensation: 0 },
    { ...base, carrierDecision: 'Partiel', disputeValue: 80, compensation: 30 },
    { ...base, creditIssued: true, creditCreated: '2026-11-01' },
  ];
  const { rows } = groupStats(records, 'carrier', {
    shipments: { '2026-11': { COLISSIMO: 400 } },
  });
  const c = rows[0];
  assert.equal(c.acceptedRate, 67);
  assert.equal(c.refusedRate, 33);
  assert.equal(c.gap, 100);
  assert.equal(c.anticipated, 1);
  assert.equal(c.shipments, 400);
  assert.equal(c.disputeRate, 1);
});

test('avoir anticipé : jamais quand rien n’est attendu du transporteur', () => {
  const base = { origin: 'Transport', creditIssued: true, creditCreated: '2026-10-01' };
  assert.equal(isAnticipatedCredit(base), true);
  assert.equal(isAnticipatedCredit({ ...base, imputation: 'Interne' }), false);
  assert.equal(isAnticipatedCredit({ ...base, imputation: 'Autre' }), false);
  assert.equal(
    isAnticipatedCredit({ ...base, carrierDecision: 'Ne concerne pas le transporteur' }),
    false,
  );
  assert.equal(isAnticipatedCredit({ ...base, imputation: 'Transporteur' }), true);
});

test('rien à réclamer au transporteur : une seule règle partout', async () => {
  const { noCarrierClaimFor, carrierSide, nextCarrierStep } =
    await import('../app/carrier-tracking.mjs');
  const { lateRules, DEFAULT_SLA } = await import('../app/sla.mjs');
  const r = {
    origin: 'Transport',
    status: 'Pris en charge',
    imputation: 'Interne',
    carrierSentAt: '2026-01-01',
    disputeValue: 300,
  };
  assert.equal(noCarrierClaimFor(r), true);
  assert.equal(carrierSide(r), 'Sans objet');
  assert.equal(nextCarrierStep(r), '');
  assert.equal(indemnityGap({ origin: 'Interne', disputeValue: 300 }), null);
  const late = lateRules(r, DEFAULT_SLA, Date.parse('2026-11-16T12:00:00Z')).map(
    (l) => l.rule.kind,
  );
  assert.ok(!late.includes('carrier'));
  assert.equal(noCarrierClaimFor({ origin: 'Transport', imputation: 'Transporteur' }), false);
});
