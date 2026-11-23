// Données Power BI (GET /api/powerbi) : lignes des litiges et des expéditions, jeton
import test from 'node:test';
import assert from 'node:assert/strict';
import { expeditionRows, hashToken, litigeRows, newToken, powerbiStatus } from '../app/powerbi.mjs';

test('Power BI : une ligne par litige, volet transport, sans donnée personnelle', () => {
  const [row, internal] = litigeRows([
    {
      ref: 'LIT-1',
      created: '2026-11-01T08:00:00Z',
      takenAt: '2026-11-01T20:00:00Z',
      closed: '2026-11-11T08:00:00Z',
      status: 'Résolu',
      origin: 'Transport',
      carrier: 'COLISSIMO',
      type: 'Colis perdu',
      outcome: 'Colis perdu',
      imputation: 'Transporteur',
      resolution: { verdict: 'Avéré' },
      customer: 'Paul Durand',
      customerAccount: 'C123',
      disputeValue: 200,
      compensation: 150,
      carrierSentAt: '2026-11-02',
      carrierReplyAt: '2026-11-09',
      carrierDecision: 'Partiel',
      credits: [{ status: 'issued', amount: 200 }],
      creditIssued: true,
      credit: 230,
      reopened: [],
    },
    { ref: 'LIT-2', created: '2026-11-03', status: 'Nouveau', origin: 'Interne', carrier: 'FEDEX' },
  ]);
  assert.equal(row.Reference, 'LIT-1');
  assert.equal(row.Transporteur, 'COLISSIMO');
  assert.equal(row.MontantLitige, 200);
  assert.equal(row.EcartIndemnisation, 50);
  assert.equal(row.DelaiReponseTransporteurJours, 7);
  assert.equal(row.DelaiPriseEnChargeJours, 0.5);
  assert.equal(row.DelaiResolutionJours, 10);
  assert.equal(row.AvoirsEmis, 230); // 200 par le circuit + 30 saisis à l'ancienne
  assert.equal(row.ConcerneTransporteur, true);
  const text = JSON.stringify(row);
  assert.ok(!text.includes('Durand') && !text.includes('C123'));
  // Litige interne : pas de transporteur ni de délai de réponse
  assert.equal(internal.Transporteur, '');
  assert.equal(internal.ConcerneTransporteur, false);
  assert.equal(internal.DelaiReponseTransporteurJours, null);
  assert.equal(internal.Cloture, null);
});

test('Power BI : expéditions par mois et transporteur', () => {
  assert.deepEqual(
    expeditionRows({
      months: { '2026-11': { FEDEX: 3, COLISSIMO: 10 }, '2026-10': { COLISSIMO: 8 } },
    }),
    [
      { Mois: '2026-10-01', Transporteur: 'COLISSIMO', Expeditions: 8 },
      { Mois: '2026-11-01', Transporteur: 'COLISSIMO', Expeditions: 10 },
      { Mois: '2026-11-01', Transporteur: 'FEDEX', Expeditions: 3 },
    ],
  );
  assert.deepEqual(expeditionRows(null), []);
});

test('Power BI : jeton aléatoire, empreinte stable, état sans secret', async () => {
  const a = newToken(),
    b = newToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 40 && /^olpbi_[A-Za-z0-9_-]+$/.test(a));
  assert.equal(await hashToken(a), await hashToken(a));
  assert.notEqual(await hashToken(a), await hashToken(b));
  const status = powerbiStatus({ hash: 'x'.repeat(64), hint: '…abcd', createdBy: 'Lydia' });
  assert.equal(status.active, true);
  assert.ok(!JSON.stringify(status).includes('xxxx'));
  assert.equal(powerbiStatus(null).active, false);
});
