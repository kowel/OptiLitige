// Chiffres des statistiques et des rapports (analyse du code, points 12 à 18)
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupStats, statsCsv } from '../app/stats.mjs';
import { buildReport, monthPeriod } from '../app/reports.mjs';
import { indemnityGap } from '../app/carrier-tracking.mjs';
import { csvCell } from '../app/csv.mjs';

const now = Date.parse('2026-11-30T12:00:00Z');
const d = (day) => new Date(Date.UTC(2026, 10, day, 10)).toISOString();
const base = { origin: 'Transport', carrier: 'DPD', created: d(1) };

test('12. réponses dans le délai : un dossier sans réponse encore dans le délai ne compte pas', () => {
  const records = [
    { ...base, status: 'Pris en charge', carrierSentAt: d(25) }, // 5 jours, encore dans le délai
    { ...base, status: 'Pris en charge', carrierSentAt: d(2), carrierReplyAt: d(4) }, // à l'heure
    { ...base, status: 'Pris en charge', carrierSentAt: d(1) }, // 29 jours sans réponse : en retard
  ];
  const t = groupStats(records, 'carrier', { now }).total;
  assert.equal(t.sent, 3);
  assert.equal(t.onTimeRate, 50); // 1 à l'heure sur 2 jugeables (avant : 67 %)
  const pending = groupStats([records[0]], 'carrier', { now }).total;
  assert.equal(pending.onTimeRate, null); // rien de jugeable : pas de « 100 % »
});

test('13. taux de récupération : indemnisations et avoirs sur les mêmes dossiers', () => {
  const records = [
    // Ancien dossier : indemnisation sans demande d'avoir
    { ...base, status: 'Résolu', compensation: 500 },
    // Nouveau circuit : 100 € d'avoir imputé au transporteur, 60 € récupérés
    {
      ...base,
      status: 'Résolu',
      compensation: 60,
      credits: [{ status: 'issued', imputation: 'Transporteur', amount: 100 }],
    },
  ];
  const t = groupStats(records, 'carrier', { now }).total;
  assert.equal(t.compensation, 560); // le total des indemnisations reste complet
  assert.equal(t.recoveryRate, 60); // avant : 560 %
});

const november = monthPeriod('2026-11');

test('14. rapport : taux d’avérés parmi les dossiers qualifiés, comme les statistiques', () => {
  const closed = (verdict) => ({
    ...base,
    status: 'Résolu',
    closed: d(10),
    resolution: verdict ? { verdict } : null,
  });
  const records = [closed('Avéré'), closed('Non avéré'), closed(null), closed(null)];
  const report = buildReport(records, november);
  assert.equal(report.now.provenRate, 50); // avant : 25 %
  assert.equal(groupStats(records, 'brand', { now }).total.foundedRate, 50);
});

test('15. rapport : ancien avoir compté avec les demandes, mois de la date ERP', () => {
  const records = [
    {
      ...base,
      // 80 € saisis à l'ancienne en octobre, puis 50 € par le circuit, émis dans l'ERP le 3/11
      creditIssued: true,
      credit: 130,
      creditCreated: '2026-10-15',
      credits: [
        {
          status: 'issued',
          amount: 50,
          statusAt: '2026-12-01T09:00:00Z', // saisi dans l'outil en décembre
          issue: { at: '2026-12-01T09:00:00Z', date: '2026-11-03', number: 'AV1' },
        },
      ],
    },
  ];
  const nov = buildReport(records, november).now;
  assert.equal(nov.credits, 50);
  assert.equal(nov.creditCount, 1);
  const oct = buildReport(records, monthPeriod('2026-10')).now;
  assert.equal(oct.credits, 80); // avant : ignoré
  assert.equal(buildReport(records, monthPeriod('2026-12')).now.credits, 0);
});

test('16. écart d’indemnisation : aucun pour un litige interne, même sans imputation', () => {
  const internal = { ...base, origin: 'Interne', disputeValue: 200, compensation: 0 };
  assert.equal(indemnityGap(internal), null);
  assert.equal(groupStats([internal], 'brand', { now }).total.gap, 0);
  assert.equal(indemnityGap({ ...internal, origin: 'Transport' }), 200);
});

test('17. export CSV : les nombres négatifs restent des nombres', () => {
  assert.equal(csvCell('-12,5'), '"-12,5"');
  assert.equal(csvCell(-3), '"-3"');
  assert.equal(csvCell('-cmd'), '"\'-cmd"'); // formule toujours neutralisée
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  const csv = statsCsv(
    groupStats([{ ...base, status: 'Résolu', disputeValue: 100, compensation: 150 }], 'carrier', {
      now,
    }),
    'Transporteur',
  );
  assert.match(csv, /"-50"/); // écart négatif (indemnisation supérieure à la valeur)
});
